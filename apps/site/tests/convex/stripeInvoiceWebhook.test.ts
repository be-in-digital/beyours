/// <reference types="vite/client" />

/**
 * A renewal must be booked against the right subscription, on the right plan,
 * and it must move the maintenance period forward.
 *
 * The SDK pins API version 2026-02-25.clover. On that version
 * `invoice.subscription` no longer exists — it moved to
 * `parent.subscription_details.subscription` — and
 * `subscription.current_period_*` moved to `items.data[].current_period_*`.
 * `http.ts` read the old shape through `Record<string, unknown>` and `as`
 * casts, so `tsc` saw nothing, and no test named these events. Measured
 * through the real route with a valid HMAC, before the fix:
 *
 *     invoice row after a PREMIUM renewal:
 *       [{"plan":"essentielle","subscriptionId":null,"amountCents":240000}]
 *     currentPeriodEnd before = 1731536000000  after renewal = 1731536000000
 *
 * So every renewal invoice was orphaned from its subscription and labelled
 * `essentielle` — a Premium client's 2 400 € renewal booked and receipted as
 * an Essentielle one — and /maintenance/status told a paying client their
 * maintenance had expired a year ago.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { postSigned, stubWebhookSecrets } from "./helpers/stripeWebhook";
import { drainScheduled } from "./helpers/scheduled";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

const SECRET = "whsec_test_account_scope";
const ROUTE = "/webhooks/stripe";

/** A year, in Stripe's seconds. */
const YEAR = 365 * 24 * 60 * 60;
const PERIOD_END = 1731536000;

let restoreSecrets: () => void;
let harness: ReturnType<typeof convexTest> | null = null;

beforeEach(() => {
  restoreSecrets = stubWebhookSecrets({ account: SECRET });
});

afterEach(async () => {
  /* A renewal schedules a receipt, a failed one a dunning mail. Undrained,
     they run against a harness being torn down and fail the run without
     failing a test. See ./helpers/scheduled. */
  if (harness) await drainScheduled(harness);
  harness = null;
  restoreSecrets();
  vi.restoreAllMocks();
});

/** `convexTest`, registered so afterEach can drain what it scheduled. */
function testConvex() {
  harness = convexTest(schema, modules);
  return harness;
}

let eventCounter = 0;
function event(type: string, object: unknown, apiVersion = "2026-02-25.clover") {
  return JSON.stringify({
    id: `evt_${type}_${++eventCounter}`,
    type,
    api_version: apiVersion,
    data: { object },
  });
}

async function seedPremiumSubscription(
  t: ReturnType<typeof convexTest>,
  over: { currentPeriodEnd?: number; plan?: "essentielle" | "premium" } = {},
) {
  return await t.run(async (ctx) => {
    const orderId = await ctx.db.insert("orders", {
      customerEmail: "chef@trattoria.fr",
      customerFirstName: "Giulia",
      customerLastName: "Rossi",
      customerPhone: "+33612345678",
      restaurantName: "Trattoria Rossi",
      city: "Lyon",
      buyerType: "business" as const,
      plan: over.plan ?? ("premium" as const),
      orderType: "creation" as const,
      billingPeriod: "yearly" as const,
      amountCents: 950000,
      status: "paid" as const,
      createdAt: Date.now(),
    });
    const subscriptionId = await ctx.db.insert("subscriptions", {
      orderId,
      stripeSubscriptionId: "sub_premium_1",
      stripeCustomerId: "cus_1",
      customerEmail: "chef@trattoria.fr",
      plan: over.plan ?? ("premium" as const),
      billingPeriod: "yearly" as const,
      status: "active" as const,
      currentPeriodStart: (PERIOD_END - YEAR) * 1000,
      currentPeriodEnd: (over.currentPeriodEnd ?? PERIOD_END) * 1000,
      createdAt: Date.now(),
    });
    return { orderId, subscriptionId };
  });
}

/** A renewal invoice in the shape Stripe actually sends on clover. */
function renewalInvoice(over: Record<string, unknown> = {}) {
  return {
    id: "in_renewal_1",
    object: "invoice",
    number: "BID-0042",
    customer: "cus_1",
    customer_email: "chef@trattoria.fr",
    amount_paid: 240000,
    amount_due: 240000,
    billing_reason: "subscription_cycle",
    period_start: PERIOD_END,
    period_end: PERIOD_END + YEAR,
    invoice_pdf: "https://stripe.test/i.pdf",
    hosted_invoice_url: "https://stripe.test/i",
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: "sub_premium_1",
        metadata: { plan: "premium", billingPeriod: "yearly" },
      },
    },
    ...over,
  };
}

/** A subscription update in the shape Stripe actually sends on clover. */
function updatedSubscription(
  items: Array<{ start: number; end: number }>,
  over: Record<string, unknown> = {},
) {
  return {
    id: "sub_premium_1",
    object: "subscription",
    status: "active",
    items: {
      object: "list",
      data: items.map((i, n) => ({
        id: `si_${n}`,
        object: "subscription_item",
        current_period_start: i.start,
        current_period_end: i.end,
      })),
    },
    ...over,
  };
}

describe("a renewal invoice finds its subscription", () => {
  test("a PREMIUM renewal is booked as premium, linked to its subscription", async () => {
    const t = testConvex();
    const { subscriptionId } = await seedPremiumSubscription(t);

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", renewalInvoice()),
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices).toHaveLength(1);
    // Was "essentielle" with a null subscriptionId — a 2 400 € Premium renewal
    // booked and receipted under the wrong plan.
    expect(invoices[0]!.plan).toBe("premium");
    expect(invoices[0]!.subscriptionId).toBe(subscriptionId);
    expect(invoices[0]!.amountCents).toBe(240000);
    expect(invoices[0]!.invoiceNumber).toBe("BID-0042");
    expect(invoices[0]!.periodEnd).toBe((PERIOD_END + YEAR) * 1000);
  });

  test("a failed renewal is booked on the right plan too", async () => {
    // A dunning email naming the wrong plan is the same mis-statement.
    const t = testConvex();
    const { subscriptionId } = await seedPremiumSubscription(t);

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_failed", renewalInvoice({ id: "in_failed_1" })),
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices[0]!.plan).toBe("premium");
    expect(invoices[0]!.subscriptionId).toBe(subscriptionId);
    expect(invoices[0]!.status).toBe("open");
  });

  test("a replay in the pre-clover shape still links, and says so", async () => {
    /* Stripe renders each delivery at the API version set on the ENDPOINT, and
       replays re-send the payload as first rendered — so an old shape can
       still arrive. It must be read, and it must be noisy: a silent fallback
       would hide an endpoint that is on the wrong version. */
    const t = testConvex();
    const { subscriptionId } = await seedPremiumSubscription(t);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const legacy = renewalInvoice();
    delete (legacy as Record<string, unknown>).parent;
    (legacy as Record<string, unknown>).subscription = "sub_premium_1";

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", legacy, "2024-06-20"),
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices[0]!.subscriptionId).toBe(subscriptionId);
    expect(invoices[0]!.plan).toBe("premium");
    expect(logged.mock.calls.flat().join(" ")).toContain("2024-06-20");
  });

  test("no Convex row: the plan comes off the invoice's own metadata", async () => {
    const t = testConvex();
    // No subscriptions row at all — the link that used to fail silently.
    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", renewalInvoice()),
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices[0]!.plan).toBe("premium");
  });

  test("nothing to go on: it falls back to essentielle, loudly", async () => {
    const t = testConvex();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const orphan = renewalInvoice();
    delete (orphan as Record<string, unknown>).parent;

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", orphan),
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    // The default still exists — but it is no longer silent, which is the
    // whole difference between a bug and a known unknown.
    expect(invoices[0]!.plan).toBe("essentielle");
    expect(logged.mock.calls.flat().join(" ")).toContain("plan inconnu");
  });
});

describe("the plan on a renewal follows the invoice, not a stale row", () => {
  test("an upgraded client's renewal is booked on the new plan", async () => {
    /* Nothing in this codebase ever patches `subscriptions.plan` — it is
       written once at creation. A client who upgrades essentielle → premium at
       Stripe therefore has a correct invoice and a stale row, and reading the
       row first booked their 2 400 € renewal as an Essentielle one. Same
       symptom as the unreadable subscription id, reached another way, and
       silent because it never touched the default. */
    const t = testConvex();
    await seedPremiumSubscription(t, { plan: "essentielle" });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", renewalInvoice()), // metadata says premium
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices[0]!.plan).toBe("premium");
    expect(invoices[0]!.amountCents).toBe(240000);
    // And the divergence is reported, because every other read of that
    // subscription is still answering with the old plan.
    expect(logged.mock.calls.flat().join(" ")).toContain("est à corriger");
  });

  test("the row is still used when the invoice carries no plan", async () => {
    const t = testConvex();
    const { subscriptionId } = await seedPremiumSubscription(t);

    const noMeta = renewalInvoice();
    (noMeta.parent as { subscription_details: Record<string, unknown> })
      .subscription_details.metadata = {};

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", noMeta),
      SECRET,
    );
    expect(res.status).toBe(200);

    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices[0]!.plan).toBe("premium");
    expect(invoices[0]!.subscriptionId).toBe(subscriptionId);
  });
});

describe("duplicate subscription rows are not a poison pill", () => {
  /* Two rows sharing one Stripe id made `.unique()` throw, which returned 500,
     which made Stripe retry the renewal for three days and never record it —
     the same self-sustaining shape `subscriptions.getByOrderId` already
     carries a comment about. A duplicate is a bookkeeping fault; refusing to
     read is a billing one. */
  async function duplicate(t: ReturnType<typeof convexTest>) {
    await t.run(async (ctx) => {
      const sub = (await ctx.db.query("subscriptions").first())!;
      const { _id, _creationTime, ...rest } = sub;
      void _id;
      void _creationTime;
      await ctx.db.insert("subscriptions", rest);
    });
  }

  test("a renewal is still recorded", async () => {
    const t = testConvex();
    await seedPremiumSubscription(t);
    await duplicate(t);

    const res = await postSigned(
      t,
      ROUTE,
      event("invoice.payment_succeeded", renewalInvoice()),
      SECRET,
    );

    expect(res.status).toBe(200);
    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.plan).toBe("premium");
  });

  test("a period update reaches every duplicate, not whichever is read first", async () => {
    const t = testConvex();
    await seedPremiumSubscription(t);
    await duplicate(t);

    const newEnd = PERIOD_END + YEAR;
    const res = await postSigned(
      t,
      ROUTE,
      event(
        "customer.subscription.updated",
        updatedSubscription([{ start: PERIOD_END, end: newEnd }]),
      ),
      SECRET,
    );
    expect(res.status).toBe(200);

    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs).toHaveLength(2);
    // Both, so the two rows cannot answer differently afterwards.
    expect(subs.every((s) => s.currentPeriodEnd === newEnd * 1000)).toBe(true);
  });
});

describe("a renewal moves the maintenance period forward", () => {
  test("currentPeriodEnd advances from items.data", async () => {
    const t = testConvex();
    await seedPremiumSubscription(t);

    const before = await t.run(
      async (ctx) => (await ctx.db.query("subscriptions").first())!.currentPeriodEnd,
    );
    expect(before).toBe(PERIOD_END * 1000);

    const newEnd = PERIOD_END + YEAR;
    const res = await postSigned(
      t,
      ROUTE,
      event(
        "customer.subscription.updated",
        updatedSubscription([{ start: PERIOD_END, end: newEnd }]),
      ),
      SECRET,
    );
    expect(res.status).toBe(200);

    const after = await t.run(
      async (ctx) => (await ctx.db.query("subscriptions").first())!.currentPeriodEnd,
    );
    expect(after).toBe(newEnd * 1000);
    expect(after).not.toBe(before);
  });

  test("an empty item list leaves the period untouched, never zeroed", async () => {
    /* A 0 here would set coveredUntil to the epoch and expire a client who is
       paying — strictly worse than a stale value. */
    const t = testConvex();
    await seedPremiumSubscription(t);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postSigned(
      t,
      ROUTE,
      event("customer.subscription.updated", updatedSubscription([])),
      SECRET,
    );
    expect(res.status).toBe(200);

    const after = await t.run(
      async (ctx) => (await ctx.db.query("subscriptions").first())!,
    );
    expect(after.currentPeriodEnd).toBe(PERIOD_END * 1000);
    expect(after.status).toBe("active");
  });

  test("a pre-clover subscription update still advances the period", async () => {
    /* The REAL pre-basil shape: `items.data` is non-empty — items have always
       existed — and the period sits at the top level. An earlier version of
       this case sent no `items` key at all, which Stripe never does, and so
       passed while the production shape wrote NaN. */
    const t = testConvex();
    await seedPremiumSubscription(t);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const newEnd = PERIOD_END + YEAR;
    const res = await postSigned(
      t,
      ROUTE,
      event(
        "customer.subscription.updated",
        {
          id: "sub_premium_1",
          object: "subscription",
          status: "active",
          items: {
            object: "list",
            data: [{ id: "si_1", object: "subscription_item" }],
          },
          current_period_start: PERIOD_END,
          current_period_end: newEnd,
        },
        "2024-06-20",
      ),
      SECRET,
    );
    expect(res.status).toBe(200);

    const after = await t.run(
      async (ctx) => (await ctx.db.query("subscriptions").first())!.currentPeriodEnd,
    );
    expect(after).toBe(newEnd * 1000);
    expect(Number.isNaN(after)).toBe(false);
    expect(logged.mock.calls.flat().join(" ")).toContain("2024-06-20");
  });

  test("an item with a null period leaves the stored one alone", async () => {
    // Never a zero: that is the epoch, and it expires a paying client.
    const t = testConvex();
    await seedPremiumSubscription(t);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postSigned(
      t,
      ROUTE,
      event("customer.subscription.updated", {
        id: "sub_premium_1",
        object: "subscription",
        status: "active",
        items: {
          object: "list",
          data: [
            {
              id: "si_1",
              object: "subscription_item",
              current_period_start: null,
              current_period_end: null,
            },
          ],
        },
      }),
      SECRET,
    );
    expect(res.status).toBe(200);

    const after = await t.run(
      async (ctx) => (await ctx.db.query("subscriptions").first())!,
    );
    expect(after.currentPeriodEnd).toBe(PERIOD_END * 1000);
    expect(after.currentPeriodEnd).not.toBe(0);
  });
});

describe("what the paying client is told", () => {
  test("/maintenance/status stops reporting an expired contract after a renewal", async () => {
    /* The user-visible symptom the two field reads produced: a client who has
       just paid for another year is told their maintenance ran out. */
    const t = testConvex();
    const expired = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const { orderId } = await seedPremiumSubscription(t, {
      currentPeriodEnd: expired,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("saDeployments", {
        customerEmail: "chef@trattoria.fr",
        restaurantName: "Trattoria Rossi",
        city: "Lyon",
        orderId,
        name: "Trattoria Rossi",
        domain: "trattoria.example",
        environment: "production" as const,
        status: "live" as const,
        health: "healthy" as const,
        region: "eu-west-1",
        plan: "premium" as const,
        uptime30d: 100,
        storeCount: 1,
        provisionedAt: Date.now(),
        integrations: [],
        maintenance: { status: "active" as const, autoRenew: true },
        licenseKey: "bys_test_key",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Stripe says the money stopped, so coveredUntil is what decides.
      const sub = await ctx.db.query("subscriptions").first();
      await ctx.db.patch(sub!._id, { status: "canceled" as const });
    });

    const beforeStatus = await t.fetch("/maintenance/status?key=bys_test_key");
    const before = (await beforeStatus.json()) as {
      entitled: boolean;
      reason: string;
    };
    expect(before.entitled).toBe(false);
    expect(before.reason).toBe("cancelled");

    // A renewal lands: the period moves a year out.
    const newEnd = Math.floor(Date.now() / 1000) + YEAR;
    await postSigned(
      t,
      ROUTE,
      event(
        "customer.subscription.updated",
        updatedSubscription([{ start: expired, end: newEnd }], {
          status: "canceled",
        }),
      ),
      SECRET,
    );

    const afterStatus = await t.fetch("/maintenance/status?key=bys_test_key");
    const after = (await afterStatus.json()) as {
      entitled: boolean;
      reason: string;
      coveredUntil: number | null;
    };
    expect(after.entitled).toBe(true);
    expect(after.reason).toBe("cancelled_covered");
    expect(after.coveredUntil).toBe(newEnd * 1000);
  });
});

describe("a null where Convex wants an absent key", () => {
  test("an invoice with null number, pdf and customer is recorded, not 500", async () => {
    /* Stripe returns `null`; `v.optional(v.string())` rejects it. The `as`
       casts laundered it into the mutation, which threw, which returned 500,
       which made Stripe retry the event forever. */
    const t = testConvex();
    await seedPremiumSubscription(t);

    const res = await postSigned(
      t,
      ROUTE,
      event(
        "invoice.payment_succeeded",
        renewalInvoice({
          number: null,
          invoice_pdf: null,
          hosted_invoice_url: null,
          customer: null,
          customer_email: null,
        }),
      ),
      SECRET,
    );

    expect(res.status).toBe(200);
    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.invoiceNumber).toBeUndefined();
    expect(invoices[0]!.stripeCustomerId).toBe("");
  });

  test("an expanded customer object is stored as its id", async () => {
    const t = testConvex();
    await seedPremiumSubscription(t);

    const res = await postSigned(
      t,
      ROUTE,
      event(
        "invoice.payment_succeeded",
        renewalInvoice({ customer: { id: "cus_expanded", object: "customer" } }),
      ),
      SECRET,
    );

    expect(res.status).toBe(200);
    const invoices = await t.run((ctx) => ctx.db.query("invoices").collect());
    expect(invoices[0]!.stripeCustomerId).toBe("cus_expanded");
  });
});
