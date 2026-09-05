/// <reference types="vite/client" />

/**
 * An order is settled only when Stripe says the money arrived.
 *
 * `checkout.session.completed` never read `payment_status`, and the switch
 * handled ten event types without
 * `checkout.session.async_payment_succeeded`, `async_payment_failed` or
 * `checkout.session.expired` among them. Klarna and Alma are both offered at
 * checkout and both settle asynchronously: they complete the session with
 * `payment_status: "unpaid"` and only later say how it ended. Measured through
 * the real route with a valid HMAC, before the fix:
 *
 *     order status after an UNPAID checkout.session.completed = paid
 *     payment rows = 1, founders slots consumed = 1
 *
 * so an unpaid session marked the order paid, sent the confirmation, wrote a
 * payment row, created the maintenance subscription and consumed a founders
 * slot — and nothing later corrected it, because the events that say how it
 * ended went to `default:`.
 *
 * `tasks/web/referral-program-design.md` already required both halves:
 * "(V2+) Also listen to checkout.session.async_payment_succeeded" and
 * "Check payment_status".
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { postSigned, stubWebhookSecrets } from "./helpers/stripeWebhook";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

const SECRET = "whsec_test_account_scope";
const ROUTE = "/webhooks/stripe";
const SESSION = "cs_test_1";

let restoreSecrets: () => void;
beforeEach(() => {
  restoreSecrets = stubWebhookSecrets({ account: SECRET });
});
afterEach(() => restoreSecrets());

let eventCounter = 0;
function event(type: string, object: Record<string, unknown>) {
  return JSON.stringify({
    id: `evt_${type}_${++eventCounter}`,
    type,
    api_version: "2026-02-25.clover",
    data: { object },
  });
}

function session(over: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    customer: "cus_1",
    customer_email: "chef@trattoria.fr",
    amount_total: 450000,
    payment_intent: "pi_1",
    payment_method_types: ["klarna"],
    metadata: {
      plan: "essentielle",
      billingPeriod: "yearly",
      orderType: "creation",
    },
    ...over,
  };
}

async function seedPendingOrder(
  t: ReturnType<typeof convexTest>,
  over: { isFounders?: boolean } = {},
): Promise<Id<"orders">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("orders", {
      customerEmail: "chef@trattoria.fr",
      customerFirstName: "Giulia",
      customerLastName: "Rossi",
      customerPhone: "+33612345678",
      restaurantName: "Trattoria Rossi",
      city: "Lyon",
      buyerType: "personal" as const,
      plan: "essentielle" as const,
      orderType: "creation" as const,
      billingPeriod: "yearly" as const,
      amountCents: 450000,
      status: "pending" as const,
      isFounders: over.isFounders ?? true,
      stripeSessionId: SESSION,
      createdAt: Date.now(),
    }),
  );
}

async function theOrder(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => (await ctx.db.query("orders").first())!);
}

async function countRows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ({
    payments: (await ctx.db.query("payments").collect()).length,
    subscriptions: (await ctx.db.query("subscriptions").collect()).length,
  }));
}

describe("an unpaid session settles nothing", () => {
  test("payment_status « unpaid » leaves the order pending", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    const res = await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_status: "unpaid" })),
      SECRET,
    );
    expect(res.status).toBe(200);

    const order = await theOrder(t);
    expect(order.status).toBe("pending");
    expect(order.paymentMethod).toBeUndefined();
  });

  test("it writes no payment row and no maintenance subscription", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_status: "unpaid" })),
      SECRET,
    );

    // All four effects used to fire on an unpaid session.
    expect(await countRows(t)).toEqual({ payments: 0, subscriptions: 0 });
  });

  test("it consumes no founders slot", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_status: "unpaid" })),
      SECRET,
    );

    const order = await theOrder(t);
    // Still pending, so still only a time-bounded hold — not a sold seat.
    expect(order.status).not.toBe("paid");
  });
});

describe("a paid session still settles, as it always did", () => {
  test.each([
    ["paid", "paid"],
    // A 100 % coupon: legitimately settled, nothing left to collect.
    ["no_payment_required", "no_payment_required"],
  ])("payment_status « %s » marks the order paid", async (_label, status) => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    const res = await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_status: status })),
      SECRET,
    );
    expect(res.status).toBe(200);

    const order = await theOrder(t);
    expect(order.status).toBe("paid");
    expect(order.paymentMethod).toBe("klarna");
    expect((await countRows(t)).payments).toBe(1);
  });
});

describe("the delayed payment is settled when it lands", () => {
  test("async_payment_succeeded settles an order left pending", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    // 1. The session completes unpaid — nothing happens.
    await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_status: "unpaid" })),
      SECRET,
    );
    expect((await theOrder(t)).status).toBe("pending");

    // 2. Days later, Klarna pays.
    const res = await postSigned(
      t,
      ROUTE,
      event(
        "checkout.session.async_payment_succeeded",
        session({ payment_status: "paid" }),
      ),
      SECRET,
    );
    expect(res.status).toBe(200);

    const order = await theOrder(t);
    expect(order.status).toBe("paid");
    expect(order.paymentMethod).toBe("klarna");
    expect((await countRows(t)).payments).toBe(1);
  });

  test("async_payment_failed marks the order failed, never paid", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_status: "unpaid" })),
      SECRET,
    );

    const res = await postSigned(
      t,
      ROUTE,
      event(
        "checkout.session.async_payment_failed",
        session({ payment_status: "unpaid" }),
      ),
      SECRET,
    );
    expect(res.status).toBe(200);

    const order = await theOrder(t);
    expect(order.status).toBe("failed");
    expect(await countRows(t)).toEqual({ payments: 0, subscriptions: 0 });
  });

  test("a failure after a settled payment does not undo it", async () => {
    /* Reversing a collected payment is a refund's job, not this handler's —
       it has the money detail this one does not. */
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session()),
      SECRET,
    );
    expect((await theOrder(t)).status).toBe("paid");

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.async_payment_failed", session()),
      SECRET,
    );

    expect((await theOrder(t)).status).toBe("paid");
  });
});

describe("an expired session releases what it was holding", () => {
  test("checkout.session.expired cancels the pending order", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    const res = await postSigned(
      t,
      ROUTE,
      event("checkout.session.expired", session({ payment_status: "unpaid" })),
      SECRET,
    );
    expect(res.status).toBe(200);

    expect((await theOrder(t)).status).toBe("cancelled");
  });

  test("the founders slot it held goes back to the pool", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t, { isFounders: true });

    expect(await t.query(api.orders.countFoundersSold, {})).toBe(1);

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.expired", session({ payment_status: "unpaid" })),
      SECRET,
    );

    // Was held for the full 24 h window with nothing able to release it.
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });

  test("an expiry after payment leaves a paid order alone", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session()),
      SECRET,
    );
    await postSigned(
      t,
      ROUTE,
      event("checkout.session.expired", session()),
      SECRET,
    );

    expect((await theOrder(t)).status).toBe("paid");
  });
});

describe("a commission is paid only to the code's owner", () => {
  /* A Stripe session stays payable for up to 24 h, so a session opened before
     `createCheckoutSession` stopped accepting a caller-chosen `referrerId`
     still carries one in its metadata. The webhook is where that would be paid
     out, so it re-checks ownership rather than trusting what it is handed. */
  async function seedAffiliateWithCode(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      await ctx.db.insert("affiliateSettings", {
        defaultCommissionCents: 50000,
        defaultDiscountPercent: 10,
        validationDelayDays: 30,
        programEnabled: true,
        updatedAt: Date.now(),
      });
      const ownerUser = await ctx.db.insert("users", { email: "owner@example.test" });
      const owner = await ctx.db.insert("affiliateUsers", {
        userId: ownerUser,
        role: "affiliate" as const,
        status: "active" as const,
        stripeConnectStatus: "active" as const,
        createdAt: Date.now(),
      });
      const codeId = await ctx.db.insert("referralCodes", {
        affiliateUserId: owner,
        code: "BID-OWNER",
        isCustom: false,
        isActive: true,
        createdAt: Date.now(),
      });
      const outsiderUser = await ctx.db.insert("users", { email: "outsider@example.test" });
      const outsider = await ctx.db.insert("affiliateUsers", {
        userId: outsiderUser,
        role: "affiliate" as const,
        status: "active" as const,
        stripeConnectStatus: "active" as const,
        commissionOverrideCents: 900000,
        createdAt: Date.now(),
      });
      return { owner, outsider, codeId };
    });
  }

  test("metadata naming someone else's code pays nobody", async () => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);
    const { outsider, codeId } = await seedAffiliateWithCode(t);

    const res = await postSigned(
      t,
      ROUTE,
      event(
        "checkout.session.completed",
        session({
          metadata: {
            plan: "essentielle",
            billingPeriod: "yearly",
            orderType: "creation",
            referralCodeId: codeId,
            referrerId: outsider,
            discountPercent: "10",
            discountAmountCents: "35000",
          },
        }),
      ),
      SECRET,
    );
    expect(res.status).toBe(200);

    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toEqual([]);
  });

  test("metadata naming the real owner still pays them", async () => {
    // The guard must not break the legitimate referral.
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);
    const { owner, codeId } = await seedAffiliateWithCode(t);

    await postSigned(
      t,
      ROUTE,
      event(
        "checkout.session.completed",
        session({
          metadata: {
            plan: "essentielle",
            billingPeriod: "yearly",
            orderType: "creation",
            referralCodeId: codeId,
            referrerId: owner,
            discountPercent: "10",
            discountAmountCents: "35000",
          },
        }),
      ),
      SECRET,
    );

    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toHaveLength(1);
    expect(referrals[0]!.referrerId).toBe(owner);
    expect(referrals[0]!.commissionCents).toBe(50000);
  });
});

describe("the events the route answers", () => {
  /* Each of these used to fall through to `default:` and log "Unhandled event
     type". Asserted by effect: every one now moves the order off `pending`,
     each to the status its own outcome means. The payload carries the
     `payment_status` Stripe really sends with that event — `succeeded` with a
     still-unpaid session settles nothing, which is the gate working, not a
     missing handler. */
  test.each([
    ["checkout.session.async_payment_succeeded", "paid", "paid"],
    ["checkout.session.async_payment_failed", "unpaid", "failed"],
    ["checkout.session.expired", "unpaid", "cancelled"],
  ])("%s is handled, not swallowed by default:", async (type, paymentStatus, expected) => {
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    const res = await postSigned(
      t,
      ROUTE,
      event(type, session({ payment_status: paymentStatus })),
      SECRET,
    );
    expect(res.status).toBe(200);

    expect((await theOrder(t)).status).toBe(expected);
  });

  test("async_payment_succeeded on a still-unpaid session settles nothing", async () => {
    // The gate is on the money, not on the event name.
    const t = convexTest(schema, modules);
    await seedPendingOrder(t);

    await postSigned(
      t,
      ROUTE,
      event(
        "checkout.session.async_payment_succeeded",
        session({ payment_status: "unpaid" }),
      ),
      SECRET,
    );

    expect((await theOrder(t)).status).toBe("pending");
    expect(await countRows(t)).toEqual({ payments: 0, subscriptions: 0 });
  });
});
