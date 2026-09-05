/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach } from "vitest";
import schema from "../../convex/schema";
import { post, sign } from "./helpers/stripeWebhook";

const modules = import.meta.glob("../../convex/**/*.ts");

/* Stripe splits webhooks into two scopes and signs each endpoint with its own
   secret. Affiliates are `express` CONNECTED accounts, so their events only ever
   reach a Connect-scoped endpoint — which is why `account.updated` sat unused on
   the account-scoped one for a while (#230).

   These tests hold that separation in place. The interesting one is not that a
   correct event works; it is that an event signed with the *other* scope's
   secret is refused. That is the shape of the original bug. */

const ACCOUNT_SECRET = "whsec_test_account_scope";
const CONNECT_SECRET = "whsec_test_connect_scope";

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
  process.env.STRIPE_WEBHOOK_SECRET = ACCOUNT_SECRET;
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT_SECRET;
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function connectEvent(type: string, account: string, object: unknown = {}) {
  return JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type,
    account, // top-level on Connect events; data.object is not the account
    data: { object },
  });
}

async function seedAffiliate(
  t: ReturnType<typeof convexTest>,
  stripeConnectAccountId: string,
  stripeConnectStatus: "not_started" | "pending" | "active" | "disabled" = "active",
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: `${stripeConnectAccountId}@example.test`,
    });
    return await ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status: "active" as const,
      stripeConnectAccountId,
      stripeConnectStatus,
      createdAt: Date.now(),
    });
  });
}

describe("the Connect-scoped webhook route", () => {
  test("an event signed with the ACCOUNT secret is refused", async () => {
    const t = convexTest(schema, modules);
    await seedAffiliate(t, "acct_wrongscope");
    const body = connectEvent("account.application.deauthorized", "acct_wrongscope");

    const res = await post(t, "/webhooks/stripe-connect", body, await sign(body, ACCOUNT_SECRET));

    // This is the regression guard: the two scopes must not share a secret.
    expect(res.status).toBe(400);
    const affiliate = await t.run(async (ctx) => ctx.db.query("affiliateUsers").first());
    expect(affiliate?.stripeConnectStatus).toBe("active");
  });

  test("an unsigned request is refused", async () => {
    const t = convexTest(schema, modules);
    const body = connectEvent("payout.failed", "acct_unsigned");
    const res = await post(t, "/webhooks/stripe-connect", body);
    expect(res.status).toBe(400);
  });

  test("account.application.deauthorized disables the affiliate", async () => {
    const t = convexTest(schema, modules);
    const id = await seedAffiliate(t, "acct_gone", "active");
    const body = connectEvent("account.application.deauthorized", "acct_gone", {
      id: "ca_123",
      object: "application",
    });

    const res = await post(t, "/webhooks/stripe-connect", body, await sign(body, CONNECT_SECRET));

    expect(res.status).toBe(200);
    const affiliate = await t.run(async (ctx) => ctx.db.get(id));
    expect(affiliate?.stripeConnectStatus).toBe("disabled");
  });

  test("payout.failed disables the affiliate — paying again would only fail again", async () => {
    const t = convexTest(schema, modules);
    const id = await seedAffiliate(t, "acct_bounced", "active");
    const body = connectEvent("payout.failed", "acct_bounced", {
      id: "po_123",
      failure_code: "account_closed",
      failure_message: "The bank account has been closed",
    });

    const res = await post(t, "/webhooks/stripe-connect", body, await sign(body, CONNECT_SECRET));

    expect(res.status).toBe(200);
    const affiliate = await t.run(async (ctx) => ctx.db.get(id));
    expect(affiliate?.stripeConnectStatus).toBe("disabled");
  });

  test("an event for an account we do not know is accepted, not retried", async () => {
    const t = convexTest(schema, modules);
    const body = connectEvent("account.application.deauthorized", "acct_stranger");

    const res = await post(t, "/webhooks/stripe-connect", body, await sign(body, CONNECT_SECRET));

    // 200, so Stripe stops. A 500 here would have it retry an event that can
    // never match anything.
    expect(res.status).toBe(200);
  });

  test("the account-scoped route still refuses a Connect-signed event", async () => {
    const t = convexTest(schema, modules);
    const body = connectEvent("account.application.deauthorized", "acct_x");
    const res = await post(t, "/webhooks/stripe", body, await sign(body, CONNECT_SECRET));
    expect(res.status).toBe(400);
  });
});
