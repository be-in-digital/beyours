/// <reference types="vite/client" />

/**
 * The order records the method the buyer actually paid with (#528).
 *
 * THE DEFECT, AND WHY IT WAS 100% OF ORDERS. `handleCheckoutCompleted` inferred
 * the method from `session.payment_method_types`:
 *
 *     let pmt = "card";
 *     if (paymentMethodTypes && paymentMethodTypes.length === 1) pmt = types[0];
 *
 * That field holds the methods the session ALLOWED, not the one used. And
 * `convex/stripe.ts` always offers at least two — `["card", "alma"]`, plus
 * `"klarna"` for a personal buyer — so the one-element branch could never fire
 * on a real session. Every order, every payment row, every confirmation email
 * and every line of the ops console said « card », including for a buyer who
 * paid with Alma or Klarna.
 *
 * It is not cosmetic. `paymentMethod` is what the buyer reads on their
 * confirmation, and it is what the team reads before making the promised call:
 * a BNPL purchase and a card purchase are different conversations, and the
 * renewal path treats them differently too (#411's « Paiement initial réglé en
 * BNPL »).
 *
 * WHERE THE TRUTH IS. On the PaymentIntent's latest charge —
 * `payment_method_details.type` — which is a Stripe read. The webhook already
 * makes one for the reusable payment method, so this is the same shape and the
 * same failure policy: it runs after the money is collected, on a webhook that
 * must not 500, so a read that fails costs the precision and nothing else.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { postSigned, stubWebhookSecrets } from "./helpers/stripeWebhook";
import { drainScheduled } from "./helpers/scheduled";

const modules = import.meta.glob("../../convex/**/*.ts");

/** What the fake PaymentIntent reports, set per test. */
const stripeFake = vi.hoisted(() => ({
  chargeMethod: "klarna" as string | null,
  retrieveThrows: false,
  retrievals: [] as string[],
}));

vi.mock("stripe", () => {
  class FakeStripe {
    paymentIntents = {
      retrieve: async (id: string, _options?: unknown) => {
        stripeFake.retrievals.push(id);
        if (stripeFake.retrieveThrows) throw new Error("Stripe unreachable");
        return {
          id,
          payment_method: "pm_1",
          latest_charge: stripeFake.chargeMethod
            ? {
                id: "ch_1",
                payment_method_details: { type: stripeFake.chargeMethod },
              }
            : null,
        };
      },
    };
    checkout = { sessions: { create: async () => ({ id: "cs_1", url: "u" }) } };
    coupons = { create: async () => ({ id: "coupon_1" }) };
    subscriptions = { create: async () => ({ id: "sub_1", items: { data: [] } }) };
    customers = { update: async () => ({ id: "cus_1" }) };
  }
  return { default: FakeStripe };
});

const SECRET = "whsec_test";
const ROUTE = "/webhooks/stripe";
const SESSION = "cs_test_pm";

let restoreSecrets: () => void;
let harness: ReturnType<typeof convexTest> | null = null;
const saved = new Map<string, string | undefined>();

beforeEach(() => {
  restoreSecrets = stubWebhookSecrets({ account: SECRET });
  saved.set("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  stripeFake.chargeMethod = "klarna";
  stripeFake.retrieveThrows = false;
  stripeFake.retrievals.length = 0;
});

afterEach(async () => {
  if (harness) await drainScheduled(harness);
  harness = null;
  restoreSecrets();
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

function testConvex() {
  harness = convexTest(schema, modules);
  return harness;
}

let eventCounter = 0;
function event(type: string, object: Record<string, unknown>) {
  return JSON.stringify({
    id: `evt_pm_${++eventCounter}`,
    type,
    api_version: "2026-02-25.clover",
    data: { object },
  });
}

/** A session as `convex/stripe.ts` really creates one: several methods offered. */
function session(over: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    customer: "cus_1",
    customer_email: "chef@trattoria.fr",
    amount_total: 450000,
    payment_intent: "pi_pm_1",
    payment_method_types: ["card", "alma", "klarna"],
    metadata: { plan: "essentielle", billingPeriod: "yearly", orderType: "creation" },
    ...over,
  };
}

async function seedPendingOrder(t: ReturnType<typeof convexTest>) {
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
      isFounders: false,
      stripeSessionId: SESSION,
      createdAt: Date.now(),
    }),
  );
}

const theOrder = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => (await ctx.db.query("orders").first())!);

describe("the method recorded on a settled order", () => {
  test("is the one the charge reports, not the first one offered", async () => {
    /*
     * THE DEFECT. Three methods offered, the buyer paid with Klarna, and the
     * order said « card » — on the confirmation email and in the console.
     */
    const t = testConvex();
    await seedPendingOrder(t);

    await postSigned(t, ROUTE, event("checkout.session.completed", session()), SECRET);

    expect((await theOrder(t)).paymentMethod).toBe("klarna");
  });

  test("is card when the charge says card", async () => {
    // Anti-vacuity: the defect's value was « card », so a fix that wrote klarna
    // unconditionally would pass the case above and be just as wrong.
    stripeFake.chargeMethod = "card";
    const t = testConvex();
    await seedPendingOrder(t);

    await postSigned(t, ROUTE, event("checkout.session.completed", session()), SECRET);

    expect((await theOrder(t)).paymentMethod).toBe("card");
  });

  test("is alma when the charge says alma", async () => {
    stripeFake.chargeMethod = "alma";
    const t = testConvex();
    await seedPendingOrder(t);

    await postSigned(t, ROUTE, event("checkout.session.completed", session()), SECRET);

    expect((await theOrder(t)).paymentMethod).toBe("alma");
  });

  test("reaches the payment row too, not only the order", async () => {
    // The two are read by different screens and were both wrong.
    const t = testConvex();
    await seedPendingOrder(t);

    await postSigned(t, ROUTE, event("checkout.session.completed", session()), SECRET);

    const payment = await t.run(async (ctx) => (await ctx.db.query("payments").first())!);
    expect(payment.paymentMethod).toBe("klarna");
  });

  test("settles the order anyway when Stripe cannot be read", async () => {
    /*
     * This runs after the money is collected, on a webhook that must not 500 —
     * Stripe would replay in a loop and stack up effects. A read that fails
     * costs the precision of one field and must cost nothing else.
     */
    stripeFake.retrieveThrows = true;
    const t = testConvex();
    await seedPendingOrder(t);

    const response = await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session()),
      SECRET,
    );

    expect(response.status).toBe(200);
    expect((await theOrder(t)).status).toBe("paid");
  });

  test("settles the order anyway when there is no payment intent to read", async () => {
    // A session can complete with no intent — a fully discounted order. The
    // retrieval must not be reached at all.
    const t = testConvex();
    await seedPendingOrder(t);

    const response = await postSigned(
      t,
      ROUTE,
      event("checkout.session.completed", session({ payment_intent: null })),
      SECRET,
    );

    expect(response.status).toBe(200);
    expect((await theOrder(t)).status).toBe("paid");
    expect(stripeFake.retrievals).toEqual([]);
  });
});
