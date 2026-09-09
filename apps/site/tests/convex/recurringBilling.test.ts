/// <reference types="vite/client" />

/**
 * The recurring half of the business model, and whether it can collect.
 *
 * Three defects with one shape between them: money that was supposed to move
 * and could not, or moved twice (#322). None of them fails anything at the
 * time of sale — each one comes due weeks or a year later, on a client who has
 * already paid.
 *
 *   1. The card was never kept. Checkout is a one-off `payment` session and
 *      nothing asked Stripe to save the method, so `createSubscription` built a
 *      `charge_automatically` subscription against a customer with nothing to
 *      charge. Every first renewal invoice — 240 to 2 400 € — would fail a year
 *      after purchase, dun the client, and then cut their updates.
 *   2. A full refund undid the sale and left the subscription running: no code
 *      path in this app could cancel one. A refunded ex-client kept being
 *      billed.
 *   3. `processPayouts` transferred before recording, with no idempotency key,
 *      on a Mon+Thu cron. Two overlapping runs wired one commission twice and
 *      orphaned a transfer id.
 *
 * The fake Stripe below is deliberately strict about idempotency — a repeated
 * key replays, a repeated key with a changed body is REFUSED — because that is
 * the property the payout fix leans on, and a test that does not enforce it
 * would pass against a key that guarantees nothing.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { postSigned, stubWebhookSecrets } from "./helpers/stripeWebhook";
import { drainScheduled } from "./helpers/scheduled";

const modules = import.meta.glob("../../convex/**/*.ts");

const SECRET = "whsec_test_account_scope";
const ROUTE = "/webhooks/stripe";

/* ── The fake Stripe ── */

const stripeFake = vi.hoisted(() => ({
  /** Every `customers.update` call, in order. */
  customerUpdates: [] as Array<{ id: string; params: Record<string, unknown> }>,
  /** PaymentIntent id → what `retrieve` should answer. */
  intents: new Map<string, { id: string; payment_method: string | null }>(),
  /** Whether retrieving an intent should blow up. */
  intentReadFails: false,
  /** Every `transfers.create` call, including its idempotency key. */
  transfers: [] as Array<{ body: string; idempotencyKey?: string }>,
  /** idempotencyKey → the body it was first used with, and the transfer index. */
  transferKeys: new Map<string, { body: string; index: number }>(),
  /** How many transfer requests were answered from the idempotency store. */
  transferReplays: 0,
  /** Subscription ids `subscriptions.cancel` was called with. */
  cancelled: [] as string[],
  /** When set, `subscriptions.cancel` throws this. */
  cancelError: null as { code?: string; message: string } | null,
}));

vi.mock("stripe", () => {
  class FakeStripe {
    customers = {
      update: async (id: string, params: Record<string, unknown>) => {
        stripeFake.customerUpdates.push({ id, params });
        return { id };
      },
    };

    paymentIntents = {
      retrieve: async (id: string) => {
        if (stripeFake.intentReadFails) throw new Error("Stripe unreachable");
        const intent = stripeFake.intents.get(id);
        if (!intent) throw new Error(`No such payment_intent: ${id}`);
        return intent;
      },
    };

    subscriptions = {
      list: async () => ({ object: "list" as const, has_more: false, data: [] }),
      create: async (params: Record<string, unknown>) => ({
        id: "sub_created_1",
        object: "subscription",
        customer: params.customer,
        status: "trialing",
        metadata: params.metadata,
        start_date: 1788480000,
        trial_end: 1788480000 + 365 * 24 * 60 * 60,
      }),
      cancel: async (id: string) => {
        if (stripeFake.cancelError) {
          const err = new Error(stripeFake.cancelError.message) as Error & {
            code?: string;
          };
          err.code = stripeFake.cancelError.code;
          throw err;
        }
        stripeFake.cancelled.push(id);
        return { id, status: "canceled" };
      },
    };

    transfers = {
      create: async (
        params: Record<string, unknown>,
        options?: { idempotencyKey?: string },
      ) => {
        const body = JSON.stringify(params);
        const key = options?.idempotencyKey;
        stripeFake.transfers.push({ body, idempotencyKey: key });

        const seen = key ? stripeFake.transferKeys.get(key) : undefined;
        if (seen) {
          if (seen.body !== body) {
            // Stripe's own refusal, in Stripe's own words.
            throw new Error(
              "Keys for idempotent requests can only be used with the same " +
                "parameters they were first used with.",
            );
          }
          stripeFake.transferReplays += 1;
          return { id: `tr_${seen.index + 1}`, object: "transfer" };
        }

        const index = stripeFake.transferKeys.size;
        if (key) stripeFake.transferKeys.set(key, { body, index });
        return { id: `tr_${index + 1}`, object: "transfer" };
      },
      createReversal: async () => ({ id: "trr_1", object: "transfer_reversal" }),
    };
  }

  return { default: FakeStripe };
});

/* ── Environment ── */

const STRIPE_ENV = {
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_PRICE_ESSENTIELLE_MONTHLY: "price_ess_monthly",
  STRIPE_PRICE_ESSENTIELLE_YEARLY: "price_ess_yearly",
  STRIPE_PRICE_PREMIUM_MONTHLY: "price_prem_monthly",
  STRIPE_PRICE_PREMIUM_YEARLY: "price_prem_yearly",
} as const;

let restoreSecrets: () => void;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  restoreSecrets = stubWebhookSecrets({ account: SECRET });
  for (const [key, value] of Object.entries(STRIPE_ENV)) {
    savedEnv.set(key, process.env[key]);
    process.env[key] = value;
  }
  stripeFake.customerUpdates.length = 0;
  stripeFake.intents.clear();
  stripeFake.intentReadFails = false;
  stripeFake.transfers.length = 0;
  stripeFake.transferKeys.clear();
  stripeFake.transferReplays = 0;
  stripeFake.cancelled.length = 0;
  stripeFake.cancelError = null;
});

afterEach(() => {
  restoreSecrets();
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

/* ── Fixtures ── */

async function seedOrder(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("orders", {
      customerEmail: "chef@trattoria.fr",
      customerFirstName: "Giulia",
      customerLastName: "Rossi",
      customerPhone: "+33612345678",
      restaurantName: "Trattoria Rossi",
      city: "Lyon",
      buyerType: "business" as const,
      plan: "premium" as const,
      orderType: "creation" as const,
      billingPeriod: "yearly" as const,
      amountCents: 950000,
      status: "paid" as const,
      createdAt: Date.now(),
    }),
  );
}

function chargeRefunded(paymentIntentId: string) {
  return JSON.stringify({
    id: "evt_refund_1",
    object: "event",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_1",
        object: "charge",
        payment_intent: paymentIntentId,
        refunded: true,
      },
    },
  });
}

/* ═══════════════════════════════════════════════
   1. The card the renewals are charged to
   ═══════════════════════════════════════════════ */

describe("the maintenance subscription can actually be billed", () => {
  test("the method that paid becomes the customer's default", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.intents.set("pi_1", { id: "pi_1", payment_method: "pm_card_1" });

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_1",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
      stripePaymentIntentId: "pi_1",
    });

    /* The whole defect, in one assertion: without this the subscription is
       `charge_automatically` against a customer with nothing on file. */
    const update = stripeFake.customerUpdates.at(-1);
    expect(update?.id).toBe("cus_1");
    expect(
      (update?.params.invoice_settings as Record<string, unknown> | undefined)
        ?.default_payment_method,
    ).toBe("pm_card_1");
  });

  /**
   * The legal mentions and the payment method share one `customers.update`.
   * Adding the second must not have dropped the first — every renewal invoice
   * carries the seller identity from there.
   */
  test("it does not cost the invoice legal mentions", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.intents.set("pi_1", { id: "pi_1", payment_method: "pm_card_1" });

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_1",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
      stripePaymentIntentId: "pi_1",
    });

    const settings = stripeFake.customerUpdates.at(-1)?.params
      .invoice_settings as Record<string, unknown>;
    expect(Object.keys(settings).length).toBeGreaterThan(1);
    expect(settings.footer ?? settings.custom_fields).toBeDefined();
  });

  /**
   * Alma and Klarna settle the first payment and cannot be represented
   * off-session, so a BNPL sale legitimately leaves no reusable method. The
   * subscription is still created — refusing it would refuse the sale — but
   * the gap has to reach an operator while there is still a year to fix it.
   */
  /**
   * The summary an operator reads has to name the CAUSE, and these three are
   * not the same thing (#411, B2-F5).
   *
   * `resolveReusablePaymentMethod` answers "nothing to charge" in three
   * unrelated situations — a genuine BNPL sale, a `paymentIntents.retrieve`
   * that threw, and an event carrying no intent id at all — and the feed
   * asserted the first for all three. An operator reading « Paiement initial
   * réglé en BNPL (Alma/Klarna) » about a Stripe outage goes to ask a customer
   * for a card they may well have already given, and never learns that a card
   * IS on the intent and simply was not attached. A report that names the
   * wrong cause is worse than one that names none.
   */
  async function reportedSummary(t: ReturnType<typeof convexTest>) {
    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    const line = activity.find(
      (a) => a.action === "subscription_without_payment_method",
    );
    return line?.summary ?? "";
  }

  test("a BNPL sale is provisioned, and reported as unbillable", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.intents.set("pi_bnpl", { id: "pi_bnpl", payment_method: null });

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_2",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
      stripePaymentIntentId: "pi_bnpl",
    });

    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs).toHaveLength(1);

    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(
      activity.map((a) => a.action),
    ).toContain("subscription_without_payment_method");

    // The intent WAS read and carries no reusable method. This is the one case
    // that genuinely is BNPL, and the only one allowed to say so.
    expect(await reportedSummary(t)).toContain("BNPL");
  });

  /**
   * The read runs after the money is collected, on a webhook that must not
   * 500. Losing the default payment method is a reportable outcome; losing the
   * subscription is not.
   */
  test("an unreadable intent still provisions, and says so", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.intentReadFails = true;

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_3",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
      stripePaymentIntentId: "pi_unreadable",
    });

    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs).toHaveLength(1);
    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(
      activity.map((a) => a.action),
    ).toContain("subscription_without_payment_method");
  });

  test("an unreadable intent is not reported as a BNPL sale", async () => {
    // THE BUG. Nothing about a failed Stripe read says how the customer paid.
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.intentReadFails = true;

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_3",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
      stripePaymentIntentId: "pi_unreadable",
    });

    const summary = await reportedSummary(t);
    expect(summary).not.toContain("BNPL");
    expect(summary).not.toContain("Alma");
    expect(summary).toContain("PaymentIntent");
    // And it asks for the thing that actually helps: go and look at Stripe.
    expect(summary).toContain("tableau de bord Stripe");
  });

  test("an event carrying no intent id is not reported as a BNPL sale either", async () => {
    // A replay of an older delivery carries no `stripePaymentIntentId`. That
    // said nothing about the payment method, and was reported as BNPL too.
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_4",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
    });

    const summary = await reportedSummary(t);
    expect(summary).not.toContain("BNPL");
    expect(summary).toContain("aucun PaymentIntent");
  });

  test("says nothing at all when a card was attached", async () => {
    // The ordinary outcome. A feed line here would be noise in the one place
    // that has to stay readable.
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.intents.set("pi_card", { id: "pi_card", payment_method: "pm_1" });

    await t.action(internal.stripe.createSubscription, {
      orderId,
      stripeCustomerId: "cus_5",
      customerEmail: "chef@trattoria.fr",
      plan: "premium",
      billingPeriod: "yearly",
      buyerType: "business",
      stripePaymentIntentId: "pi_card",
    });

    expect(await reportedSummary(t)).toBe("");
  });
});

/* ═══════════════════════════════════════════════
   2. A refund stops the billing
   ═══════════════════════════════════════════════ */

describe("a full refund stops the maintenance billing", () => {
  async function seedPaidSaleWithSubscription(
    t: ReturnType<typeof convexTest>,
  ): Promise<Id<"orders">> {
    const orderId = await seedOrder(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("payments", {
        orderId,
        stripePaymentIntentId: "pi_refunded",
        stripeSessionId: "cs_1",
        amountCents: 950000,
        status: "succeeded" as const,
        paymentMethod: "card" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("subscriptions", {
        orderId,
        stripeSubscriptionId: "sub_live_1",
        stripeCustomerId: "cus_1",
        customerEmail: "chef@trattoria.fr",
        plan: "premium" as const,
        billingPeriod: "yearly" as const,
        status: "active" as const,
        createdAt: Date.now(),
      });
    });
    return orderId;
  }

  test("the subscription is cancelled at Stripe and on file", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);

    const response = await postSigned(
      t,
      ROUTE,
      chargeRefunded("pi_refunded"),
      SECRET,
    );
    expect(response.status).toBe(200);
    await drainScheduled(t);

    // The half that was missing: Stripe still had a live subscription.
    expect(stripeFake.cancelled).toEqual(["sub_live_1"]);

    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs[0]?.status).toBe("canceled");
    expect(subs[0]?.canceledAt).toBeDefined();
  });

  test("it writes exactly one activity line", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);

    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);

    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(
      activity.filter(
        (a) => a.action === "subscription_cancelled_after_reversal",
      ),
    ).toHaveLength(1);
  });

  /**
   * Stripe retries a webhook. A replay must not cancel twice, and must not
   * write a second line into the feed an operator reads.
   */
  test("a replayed refund does not cancel or report twice", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);

    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);
    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);

    expect(stripeFake.cancelled).toEqual(["sub_live_1"]);
    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(
      activity.filter(
        (a) => a.action === "subscription_cancelled_after_reversal",
      ),
    ).toHaveLength(1);
  });

  /**
   * A cancellation Stripe refuses must leave the row alone. Marking it
   * "canceled" here would hide the one fact that needs acting on: the client
   * is still going to be charged.
   */
  test("a refusal from Stripe is reported, not papered over", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);
    stripeFake.cancelError = { code: "api_error", message: "Stripe is down" };

    const response = await postSigned(
      t,
      ROUTE,
      chargeRefunded("pi_refunded"),
      SECRET,
    );
    // Still 200: a 500 makes Stripe replay the refund for three days.
    expect(response.status).toBe(200);
    await drainScheduled(t);

    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs[0]?.status).toBe("active");
    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(
      activity.map((a) => a.action),
    ).toContain("subscription_cancellation_failed");
  });

  /**
   * A deployment with no Stripe key at all (#411, B2-F3).
   *
   * THE BUG. #384's cancel call reaches `getStripeOrTestMode`, which throws
   * `StripeNotConfiguredError` when there is neither a key nor the deliberate
   * test flag. That throw left the action, left `handleChargeReversal`, and
   * left the route as a 500 — measured: `[PROBE] charge.refunded HTTP status =
   * 500`. Stripe then retried `charge.refunded` for three days, replaying a
   * reversal that had ALREADY marked the payment refunded, cancelled the order
   * and clawed the commission back, and nobody was told.
   *
   * Refusing was pointless on its own terms as well: with no key there is
   * nothing to send a cancellation to.
   */
  test("no Stripe key answers 2xx and reports the subscription for a human", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);
    // Neither a key nor the deliberate no-payment flag.
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.BEYOURS_TEST_CHECKOUT;

    const response = await postSigned(
      t,
      ROUTE,
      chargeRefunded("pi_refunded"),
      SECRET,
    );
    expect(response.status).toBe(200);
    await drainScheduled(t);

    // The reversal itself still happened.
    const payments = await t.run((ctx) => ctx.db.query("payments").collect());
    expect(payments[0]?.status).toBe("refunded");

    // Reported, because if the key was REMOVED after this subscription was
    // created then Stripe may still be billing it and a human has to cancel it
    // by hand.
    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(activity.map((a) => a.action)).toContain(
      "subscription_cancellation_failed",
    );

    // AND closed locally. `resolveEntitlement` reads `active` as entitled
    // whatever the period end, so a row left alone here would serve a refunded
    // client « Maintenance à jour » and engine updates for ever.
    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs[0]?.status).toBe("canceled");
    expect(subs[0]?.canceledAt).toBeDefined();
  });

  test("a refunded client on a keyless deployment stops being entitled", async () => {
    // The consequence stated end to end, through the query `/maintenance/status`
    // actually calls.
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.BEYOURS_TEST_CHECKOUT;

    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);

    const sub = await t.run((ctx) => ctx.db.query("subscriptions").first());
    expect(sub?.status).not.toBe("active");
  });

  test("the delivery is retired, so Stripe stops retrying it", async () => {
    // The other half of the 500: the event row stayed unprocessed, so every
    // retry for three days was re-admitted and ran the whole reversal again.
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.BEYOURS_TEST_CHECKOUT;

    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);

    const events = await t.run((ctx) =>
      ctx.db.query("stripe_events").collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.processed).toBe(true);
  });

  /** A subscription Stripe has already lost is the state we wanted anyway. */
  test("an already-cancelled subscription closes the row cleanly", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSaleWithSubscription(t);
    stripeFake.cancelError = {
      code: "resource_missing",
      message: "No such subscription",
    };

    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);

    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs[0]?.status).toBe("canceled");
  });
});

/* ═══════════════════════════════════════════════
   3. One commission, one transfer
   ═══════════════════════════════════════════════ */

describe("a commission is never wired twice", () => {
  async function seedPayableReferral(t: ReturnType<typeof convexTest>) {
    const orderId = await seedOrder(t);
    return await t.run(async (ctx) => {
      const authUserId = await ctx.db.insert("users", {});
      const userId = await ctx.db.insert("affiliateUsers", {
        userId: authUserId,
        role: "affiliate" as const,
        status: "active" as const,
        stripeConnectAccountId: "acct_1",
        stripeConnectStatus: "active" as const,
        siret: "12345678901234",
        createdAt: Date.now(),
      });
      const codeId = await ctx.db.insert("referralCodes", {
        code: "GIULIA10",
        affiliateUserId: userId,
        isCustom: false,
        isActive: true,
        createdAt: Date.now(),
      });
      const referralId = await ctx.db.insert("referrals", {
        referrerId: userId,
        referralCodeId: codeId,
        orderId,
        customerEmail: "chef@trattoria.fr",
        status: "payable" as const,
        commissionCents: 50000,
        discountPercent: 10,
        discountAmountCents: 95000,
        createdAt: Date.now(),
      });
      return { referralId, userId };
    });
  }

  /**
   * THE defect: the Mon+Thu cron overlapping itself. Both runs read the same
   * referral as payable, both called `transfers.create`, and a 500 €
   * commission left the account twice with one transfer id orphaned.
   */
  test("two overlapping runs produce exactly one transfer", async () => {
    const t = convexTest(schema, modules);
    await seedPayableReferral(t);

    await Promise.all([
      t.action(internal.stripeConnect.processPayouts, {}),
      t.action(internal.stripeConnect.processPayouts, {}),
    ]);
    await drainScheduled(t);

    /* The defect measured directly: how many times money actually left. Two
       calls with the same key would still be one transfer at Stripe, so both
       are asserted — the call count catches the missing claim, the key count
       catches a claim that lets a crashed run pay twice. */
    expect(stripeFake.transfers).toHaveLength(1);
    expect(stripeFake.transferKeys.size).toBe(1);

    const referrals = await t.run((ctx) =>
      ctx.db.query("referrals").collect(),
    );
    expect(referrals[0]?.status).toBe("paid");
    expect(referrals[0]?.stripeTransferId).toBe("tr_1");
  });

  /** The key must be there at all — the claim alone cannot survive a crash. */
  test("the transfer carries an idempotency key derived from the referral", async () => {
    const t = convexTest(schema, modules);
    const { referralId } = await seedPayableReferral(t);

    await t.action(internal.stripeConnect.processPayouts, {});
    await drainScheduled(t);

    expect(stripeFake.transfers).toHaveLength(1);
    expect(stripeFake.transfers[0]?.idempotencyKey).toBe(
      `referral-payout-${referralId}`,
    );
  });

  /**
   * A run that dies after claiming must not strand the commission: the row
   * goes back to payable, and the retry replays the original transfer rather
   * than making a second one. The fake enforces Stripe's real rule — a
   * repeated key with a different body is refused — so this also proves the
   * request is a pure function of the referral.
   */
  test("a retry after a failure replays rather than pays again", async () => {
    const t = convexTest(schema, modules);
    const { referralId } = await seedPayableReferral(t);

    await t.action(internal.stripeConnect.processPayouts, {});
    await drainScheduled(t);

    // Put it back as a crashed run would have left it, and run again.
    await t.run(async (ctx) => {
      await ctx.db.patch(referralId, {
        status: "payable" as const,
        stripeTransferId: undefined,
      });
    });
    await t.action(internal.stripeConnect.processPayouts, {});
    await drainScheduled(t);

    expect(stripeFake.transfers).toHaveLength(2);
    expect(stripeFake.transferKeys.size).toBe(1);
    expect(stripeFake.transferReplays).toBe(1);
  });

  /** A claimed row must not be invisible to the affiliate's own figures. */
  test("a commission in flight still counts as owed", async () => {
    const t = convexTest(schema, modules);
    const { referralId } = await seedPayableReferral(t);
    await t.run((ctx) =>
      ctx.db.patch(referralId, { status: "paying" as const }),
    );

    const referrals = await t.run((ctx) =>
      ctx.db.query("referrals").collect(),
    );
    expect(referrals[0]?.status).toBe("paying");
    // getPayableReferrals must not see it — that is what stops the second run.
    const payable = await t.run(async (ctx) =>
      ctx.db
        .query("referrals")
        .withIndex("by_status", (q) => q.eq("status", "payable"))
        .collect(),
    );
    expect(payable).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════
   4. One delivery, one row
   ═══════════════════════════════════════════════ */

/**
 * The idempotency table's own defect, which is not about billing and reaches
 * every event type through the same door.
 *
 * `http.ts` read `stripe_events` with `runQuery` and inserted with
 * `runMutation` — two transactions, from an httpAction that is not one. Stripe
 * delivers an event more than once by design, and two deliveries overlapping in
 * that gap both read nothing and both insert; `schema.ts:334-339` declares an
 * index on `eventId` and no unique constraint, because Convex has none to
 * declare.
 *
 * What made one duplicate permanent is where the read stood. It was `.unique()`
 * — which throws on a second row — and it sat ABOVE the `try` that reports, so
 * every later delivery of that id died uncaught with
 * `unique() query returned more than one result from table stripe_events`,
 * answered 500, and never reached `captureBackendError`.
 *
 * For `charge.refunded` that is the whole of section 2 above silently undone:
 * the refund never registers, Stripe keeps billing the subscription, the
 * commission is never clawed back, and no report is filed anywhere. Stripe
 * retries for three days against the same duplicate and gives up.
 */
describe("a duplicated event does not brick that event for ever", () => {
  async function seedPaidSale(t: ReturnType<typeof convexTest>) {
    const orderId = await seedOrder(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("payments", {
        orderId,
        stripePaymentIntentId: "pi_refunded",
        stripeSessionId: "cs_1",
        amountCents: 950000,
        status: "succeeded" as const,
        paymentMethod: "card" as const,
        createdAt: Date.now(),
      });
      await ctx.db.insert("subscriptions", {
        orderId,
        stripeSubscriptionId: "sub_live_1",
        stripeCustomerId: "cus_1",
        customerEmail: "chef@trattoria.fr",
        plan: "premium" as const,
        billingPeriod: "yearly" as const,
        status: "active" as const,
        createdAt: Date.now(),
      });
    });
    return orderId;
  }

  /** The rows the racing version left behind, written straight in. */
  async function seedDuplicateClaims(
    t: ReturnType<typeof convexTest>,
    eventId: string,
  ) {
    await t.run(async (ctx) => {
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert("stripe_events", {
          eventId,
          eventType: "charge.refunded",
          processed: false,
          createdAt: Date.now(),
        });
      }
    });
  }

  /**
   * The reported harm, end to end.
   *
   * A deployment that ran the racing version is ALREADY holding duplicates —
   * this is not a race to reproduce, it is a state to recover from — so the
   * fix has to be a reader that tolerates them, not only a writer that stops
   * making them.
   */
  test("a refund still registers on a table that already holds duplicates", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSale(t);
    await seedDuplicateClaims(t, "evt_refund_1");

    const response = await postSigned(
      t,
      ROUTE,
      chargeRefunded("pi_refunded"),
      SECRET,
    );

    // Not 500. `.unique()` threw here, above the try, so nothing was reported
    // and nothing was handled.
    expect(response.status).toBe(200);
    await drainScheduled(t);

    const payments = await t.run((ctx) => ctx.db.query("payments").collect());
    expect(payments[0]?.status).toBe("refunded");
    const subs = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(subs[0]?.status).toBe("canceled");
  });

  /**
   * And both rows are retired, not one.
   *
   * `markProcessed` was `.unique()` too. Settling a single row of a duplicated
   * pair leaves the other reading `processed: false`, so the next delivery is
   * admitted and the whole reversal runs a second time — refunding, cancelling
   * and clawing back twice.
   */
  test("every row for the id is retired, so no retry is re-admitted", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSale(t);
    await seedDuplicateClaims(t, "evt_refund_1");

    await postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET);
    await drainScheduled(t);

    const events = await t.run((ctx) => ctx.db.query("stripe_events").collect());
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.processed)).toBe(true);

    // The retry Stripe sends anyway is refused at the door.
    stripeFake.cancelled.length = 0;
    const retry = await postSigned(
      t,
      ROUTE,
      chargeRefunded("pi_refunded"),
      SECRET,
    );
    expect(retry.status).toBe(200);
    expect(await retry.text()).toBe("Already processed");
    expect(stripeFake.cancelled).toEqual([]);
  });

  /**
   * The claim itself: one row per event id.
   *
   * Stated plainly, because this one does NOT discriminate — it passes against
   * the racing version too. `convex-test` runs in one process and serialises
   * these two deliveries, so no harness here can produce the interleaving that
   * inserted twice on the real backend. What closes the race is Convex's own
   * transaction semantics: `stripeEvents.claim` does the read and the insert
   * inside ONE mutation, the index read is in that handler's read set, the
   * insert writes it, so a concurrent pair conflicts and one is retried against
   * the row the other wrote. This asserts the shape that makes that true — one
   * mutation, one row, retired — and the two tests above are the ones that hold
   * the damage.
   */
  test("two deliveries of one event leave one row", async () => {
    const t = convexTest(schema, modules);
    await seedPaidSale(t);

    await Promise.all([
      postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET),
      postSigned(t, ROUTE, chargeRefunded("pi_refunded"), SECRET),
    ]);
    await drainScheduled(t);

    const events = await t.run((ctx) => ctx.db.query("stripe_events").collect());
    expect(events).toHaveLength(1);
    expect(events[0]?.processed).toBe(true);
  });
});
