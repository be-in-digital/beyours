/// <reference types="vite/client" />

/**
 * A webhook 500 has to reach a tracker, not an expiring log window.
 *
 * The Stripe webhook's entire failure record was one `console.error` into the
 * Convex dashboard, which rolls over. A renewal charge that fails to record
 * there leaves the subscription row stale, Stripe retries for three days and
 * gives up, and by the time anyone thinks to look the log is gone.
 *
 * The seam under test is the `fetch` to Sentry's ingest endpoint: the mock
 * below IS Sentry, and every assertion is about what actually left the process.
 * The two things that must never be true are asserted alongside the happy path
 * — a deployment with no DSN must be silent and free, and the reporter must
 * never throw back into the handler it was called from.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { internal } from "../../convex/_generated/api";
import { drainScheduled, scheduledCount } from "./helpers/scheduled";
import { post, postSigned, stubWebhookSecrets } from "./helpers/stripeWebhook";

const modules = import.meta.glob("../../convex/**/*.ts");

const DSN = "https://abc123@o1.ingest.sentry.io/4505";
const SECRET = "whsec_test_error_reporting";

/** Every envelope the reporter POSTed, in order. */
let sent: Array<{ url: string; headers: Record<string, string>; body: string }>;
let restoreSecrets: () => void;
const savedDsn = process.env.SENTRY_DSN;

beforeEach(() => {
  sent = [];
  restoreSecrets = stubWebhookSecrets({ account: SECRET });
  process.env.SENTRY_DSN = DSN;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      sent.push({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: String(init?.body ?? ""),
      });
      return new Response("", { status: 200 });
    }),
  );
});

afterEach(() => {
  restoreSecrets();
  if (savedDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = savedDsn;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The three JSON lines of an envelope: header, item header, item. */
function parseEnvelope(raw: string) {
  const [header, itemHeader, item] = raw.split("\n");
  return {
    header: JSON.parse(header) as { event_id: string; dsn: string; sent_at: string },
    itemHeader: JSON.parse(itemHeader) as { type: string; length: number },
    event: JSON.parse(item) as {
      event_id: string;
      environment: string;
      level: string;
      tags: Record<string, string>;
      extra?: Record<string, unknown>;
      exception: { values: Array<{ type: string; value: string }> };
    },
  };
}

describe("reportError", () => {
  test("POSTs a well-formed envelope to the project's ingest endpoint", async () => {
    const t = convexTest(schema, modules);

    const outcome = await t.action(internal.errorReporting.reportError, {
      source: "stripeWebhook",
      name: "TypeError",
      message: "Cannot read properties of undefined",
      stack: "Error: boom\n    at handleInvoiceSucceeded (convex/http.ts:610:5)",
      tags: { eventType: "invoice.payment_succeeded" },
    });

    expect(outcome).toEqual({ reported: true, eventId: expect.any(String) });
    expect(sent).toHaveLength(1);

    const [request] = sent;
    expect(request.url).toBe("https://o1.ingest.sentry.io/api/4505/envelope/");
    expect(request.headers["Content-Type"]).toBe("application/x-sentry-envelope");
    expect(request.headers["X-Sentry-Auth"]).toContain("sentry_key=abc123");

    const { header, itemHeader, event } = parseEnvelope(request.body);
    expect(header.event_id).toBe(event.event_id);
    expect(header.dsn).toBe(DSN);
    expect(itemHeader.type).toBe("event");
    expect(event.exception.values[0]).toMatchObject({
      type: "TypeError",
      value: "Cannot read properties of undefined",
    });
    expect(event.tags).toMatchObject({
      runtime: "convex",
      source: "stripeWebhook",
      eventType: "invoice.payment_succeeded",
    });
  });

  test("declares the envelope length in BYTES, so an accented message is not truncated", async () => {
    const t = convexTest(schema, modules);

    /* Every refusal string this backend throws is in French. `String.length`
       counts UTF-16 code units, so a message holding `é` would declare one byte
       fewer than it sends and Sentry would be handed truncated JSON — ASCII
       errors reported, accented ones rejected with a 400 nobody reads. */
    await t.action(internal.errorReporting.reportError, {
      source: "stripeWebhook",
      name: "Error",
      message: "Commande déjà réglée — paiement refusé",
    });

    const { itemHeader, event } = parseEnvelope(sent[0].body);
    const body = sent[0].body.split("\n")[2];
    expect(itemHeader.length).toBe(new TextEncoder().encode(body).length);
    expect(itemHeader.length).toBeGreaterThan(body.length);
    expect(event.exception.values[0].value).toContain("déjà réglée");
  });

  test("redacts a credential a call site attached by name", async () => {
    const t = convexTest(schema, modules);

    await t.action(internal.errorReporting.reportError, {
      source: "stripeWebhook",
      name: "Error",
      message: "signature mismatch",
      extra: {
        eventId: "evt_123",
        stripe_signature_header: "t=1,v1=deadbeef",
        apiKey: "sk_live_should_never_leave",
        statusCode: 500,
      },
    });

    const { event } = parseEnvelope(sent[0].body);
    expect(event.extra).toMatchObject({
      eventId: "evt_123",
      stripe_signature_header: "[Filtered]",
      apiKey: "[Filtered]",
      // `statusCode` is an ordinary word, not a credential. Redacting it is the
      // over-eager failure that makes an issue stream useless.
      statusCode: 500,
    });
  });

  test("sends nothing, and says so, when the deployment has no Sentry project", async () => {
    delete process.env.SENTRY_DSN;
    const t = convexTest(schema, modules);

    const outcome = await t.action(internal.errorReporting.reportError, {
      source: "stripeWebhook",
      name: "Error",
      message: "boom",
    });

    expect(outcome).toEqual({ reported: false, reason: "no-dsn" });
    expect(sent).toHaveLength(0);
  });

  test("a DSN that is set but unusable turns reporting off rather than crashing", async () => {
    process.env.SENTRY_DSN = "https://sentry.io/my-project";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = convexTest(schema, modules);

    const outcome = await t.action(internal.errorReporting.reportError, {
      source: "stripeWebhook",
      name: "Error",
      message: "boom",
    });

    expect(outcome).toEqual({ reported: false, reason: "no-dsn" });
    expect(sent).toHaveLength(0);
    // Loud, because the operator believes monitoring is live.
    expect(warn.mock.calls.flat().join(" ")).toContain("SENTRY_DSN");
  });

  test("never throws — a rejected ingest is a returned reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("over quota", { status: 429 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = convexTest(schema, modules);

    await expect(
      t.action(internal.errorReporting.reportError, {
        source: "stripeWebhook",
        name: "Error",
        message: "boom",
      }),
    ).resolves.toEqual({ reported: false, reason: "rejected" });
  });
});

describe("the Stripe webhook", () => {
  /** An event whose handler is guaranteed to throw: no order for the session. */
  function failingBody(): string {
    return JSON.stringify({
      id: "evt_reporting_1",
      type: "checkout.session.completed",
      api_version: "2026-02-25.clover",
      livemode: true,
      /* `data.object` deliberately omitted: the handler dereferences it, which
         is a TypeError inside the try/catch — the 500 path this covers. */
      data: {},
    });
  }

  test("reports the failure that produced its 500", async () => {
    const t = convexTest(schema, modules);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postSigned(t, "/webhooks/stripe", failingBody(), SECRET);
    expect(response.status).toBe(500);

    /* Scheduled, not awaited: Stripe must get its answer before Sentry gets
       ours. The report is therefore still pending when the response returns,
       which is the behaviour being asserted here. */
    expect(await scheduledCount(t, "errorReporting")).toBe(1);

    await drainScheduled(t);

    expect(sent).toHaveLength(1);
    const { event } = parseEnvelope(sent[0].body);
    expect(event.tags).toMatchObject({
      source: "stripeWebhook",
      eventType: "checkout.session.completed",
    });
    // The two handles that make the incident replayable from the Stripe
    // dashboard. The signature and the raw body are deliberately not attached.
    expect(event.extra).toMatchObject({ eventId: "evt_reporting_1", livemode: true });
  });

  test("reports the unset-secret outage, which fails every delivery at once", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const t = convexTest(schema, modules);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(t, "/webhooks/stripe", failingBody(), "t=1,v1=nope");
    expect(response.status).toBe(500);

    await drainScheduled(t);

    expect(sent).toHaveLength(1);
    const { event } = parseEnvelope(sent[0].body);
    // Fatal, not error: no delivery can succeed until someone sets the
    // variable, so this is not one failed event, it is all of them.
    expect(event.level).toBe("fatal");
    expect(event.tags).toMatchObject({ stage: "configuration" });
    expect(event.exception.values[0].value).toContain("STRIPE_WEBHOOK_SECRET");
  });
});
