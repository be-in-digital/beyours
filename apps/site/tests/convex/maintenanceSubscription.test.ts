/// <reference types="vite/client" />

/**
 * One maintenance subscription per order — the half that costs money.
 *
 * convex/subscriptions.ts refuses a second ROW. That refusal happens after the
 * fact: the delivery that loses the race has already created a second real
 * subscription at Stripe, and Stripe bills it on every renewal until an
 * operator notices. These cases are about the call itself never happening
 * twice.
 *
 * The fake Stripe below enforces the two rules the design leans on — a repeated
 * idempotency key replays the original object, and a repeated key whose
 * parameters changed is REFUSED. The second rule is the one that bites: put a
 * clock back into the request body and the race test stops passing.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type Stripe from "stripe";
import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import {
  MAINTENANCE_TRIAL_DAYS,
  findSubscriptionForOrder,
  maintenanceIdempotencyKey,
  maintenanceSubscriptionParams,
} from "../../convex/maintenanceSubscription";

const modules = import.meta.glob("../../convex/**/*.ts");

/**
 * Run every job the webhook queued before the test ends.
 *
 * handleCheckoutCompleted schedules the order confirmation with
 * `runAfter(0, …)`, which stays `pending` until a timer fires:
 * `finishInProgressScheduledFunctions` alone waits on nothing. A test that
 * returns first leaves that action writing against a harness being torn down,
 * and since nothing awaits it the run reports every test green and still exits
 * 1. Sending is best-effort inside `deliver()` (convex/email/send.ts), so
 * running the job here is safe with no credentials. Same helper as
 * rateLimit.test.ts.
 */
async function drainScheduled(t: ReturnType<typeof convexTest>): Promise<void> {
  for (let i = 0; i < 500; i++) {
    const remaining = await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      return jobs.filter(
        (job) => job.state.kind === "pending" || job.state.kind === "inProgress",
      ).length;
    });
    if (remaining === 0) return;
    await t.finishInProgressScheduledFunctions();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("drainScheduled: scheduled functions never settled");
}

/* ── The fake Stripe ── */

const stripeFake = vi.hoisted(() => ({
  /** Every subscription the account holds, in creation order. */
  subscriptions: [] as Array<Record<string, unknown>>,
  /** What `subscriptions.create` was called with, including the key. */
  createCalls: [] as Array<{
    body: string;
    idempotencyKey: string | undefined;
  }>,
  /** Requests Stripe answered from the idempotency store instead of creating. */
  replays: 0,
  /** idempotencyKey → the request body it was first used with, and its result. */
  keys: new Map<string, { body: string; index: number }>(),
  /**
   * Models the race: in two concurrent deliveries, BOTH list the customer's
   * subscriptions before either has created one. With this on, the lookup is
   * blind and the idempotency key is the only thing left standing.
   */
  listIsBlind: false,
  customerUpdates: [] as string[],
  /** Fixed so the recorded period is assertable. 2026-09-05T00:00:00Z. */
  startDate: 1788480000,
}));

vi.mock("stripe", () => {
  class FakeStripe {
    customers = {
      update: async (id: string) => {
        stripeFake.customerUpdates.push(id);
        return { id };
      },
    };

    subscriptions = {
      list: async ({ customer }: { customer: string }) => ({
        object: "list" as const,
        has_more: false,
        data: stripeFake.listIsBlind
          ? []
          : stripeFake.subscriptions.filter((s) => s.customer === customer),
      }),

      create: async (
        params: Record<string, unknown>,
        options?: { idempotencyKey?: string },
      ) => {
        const body = JSON.stringify(params);
        const key = options?.idempotencyKey;
        stripeFake.createCalls.push({ body, idempotencyKey: key });

        const seen = key ? stripeFake.keys.get(key) : undefined;
        if (seen) {
          if (seen.body !== body) {
            // Stripe's own wording, and its own refusal.
            throw new Error(
              "Keys for idempotent requests can only be used with the same " +
                "parameters they were first used with.",
            );
          }
          stripeFake.replays += 1;
          return stripeFake.subscriptions[seen.index];
        }

        const index = stripeFake.subscriptions.length;
        const trialDays = params.trial_period_days as number;
        const subscription = {
          id: `sub_${index + 1}`,
          object: "subscription",
          customer: params.customer,
          status: "trialing",
          metadata: params.metadata,
          start_date: stripeFake.startDate,
          trial_end: stripeFake.startDate + trialDays * 24 * 60 * 60,
        };
        stripeFake.subscriptions.push(subscription);
        if (key) stripeFake.keys.set(key, { body, index });
        return subscription;
      },
    };
  }

  return { default: FakeStripe };
});

/* ── Fixtures ── */

const PRICE_ENV = {
  STRIPE_PRICE_ESSENTIELLE_MONTHLY: "price_ess_monthly",
  STRIPE_PRICE_ESSENTIELLE_YEARLY: "price_ess_yearly",
  STRIPE_PRICE_PREMIUM_MONTHLY: "price_prem_monthly",
  STRIPE_PRICE_PREMIUM_YEARLY: "price_prem_yearly",
};

const CUSTOMER = "cus_trattoria";
const SESSION = "cs_test_trattoria";

beforeEach(() => {
  stripeFake.subscriptions.length = 0;
  stripeFake.createCalls.length = 0;
  stripeFake.customerUpdates.length = 0;
  stripeFake.keys.clear();
  stripeFake.replays = 0;
  stripeFake.listIsBlind = false;

  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("STRIPE_TAX_ENABLED", "false");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_account_scope");
  for (const [name, value] of Object.entries(PRICE_ENV)) {
    vi.stubEnv(name, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

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
      plan: "essentielle" as const,
      orderType: "creation" as const,
      billingPeriod: "monthly" as const,
      amountCents: 100000,
      status: "pending" as const,
      stripeSessionId: SESSION,
      createdAt: Date.now(),
    }),
  );
}

function subscriptionArgs(orderId: Id<"orders">) {
  return {
    orderId,
    stripeCustomerId: CUSTOMER,
    customerEmail: "chef@trattoria.fr",
    plan: "essentielle" as const,
    billingPeriod: "monthly" as const,
    buyerType: "business" as const,
  };
}

/* ── The request, decided without credentials ── */

const ORDER = {
  orderId: "k17abc",
  plan: "essentielle" as const,
  billingPeriod: "monthly" as const,
};

describe("maintenanceIdempotencyKey", () => {
  test("is the same for the same order, delivery after delivery", () => {
    expect(maintenanceIdempotencyKey(ORDER)).toBe(
      maintenanceIdempotencyKey({ ...ORDER }),
    );
  });

  test("separates two orders, and the plans within one", () => {
    const keys = new Set([
      maintenanceIdempotencyKey(ORDER),
      maintenanceIdempotencyKey({ ...ORDER, orderId: "k17other" }),
      maintenanceIdempotencyKey({ ...ORDER, plan: "premium" }),
      maintenanceIdempotencyKey({ ...ORDER, billingPeriod: "yearly" }),
    ]);
    expect(keys.size).toBe(4);
  });

  test("stays inside Stripe's 255-character limit", () => {
    expect(maintenanceIdempotencyKey(ORDER).length).toBeLessThanOrEqual(255);
  });
});

describe("maintenanceSubscriptionParams", () => {
  const input = {
    order: ORDER,
    stripeCustomerId: CUSTOMER,
    priceId: "price_ess_monthly",
    automaticTax: false,
  };

  test("reads no clock — two deliveries a day apart build the same request", () => {
    // The reason the key works at all. `trial_end: now + 30 days` made two
    // deliveries seconds apart send different bodies, and Stripe refuses a
    // reused key whose parameters changed.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T00:00:00Z"));
    const first = maintenanceSubscriptionParams(input);
    vi.setSystemTime(new Date("2026-09-06T12:34:56Z"));
    const second = maintenanceSubscriptionParams(input);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("expresses the paid-up-front period as whole days", () => {
    expect(maintenanceSubscriptionParams(input).trial_period_days).toBe(
      MAINTENANCE_TRIAL_DAYS.monthly,
    );
    expect(
      maintenanceSubscriptionParams({
        ...input,
        order: { ...ORDER, billingPeriod: "yearly" },
      }).trial_period_days,
    ).toBe(MAINTENANCE_TRIAL_DAYS.yearly);
    expect(maintenanceSubscriptionParams(input).trial_end).toBeUndefined();
  });

  test("carries the orderId, which is what the lookup matches on", () => {
    expect(maintenanceSubscriptionParams(input).metadata).toEqual({
      orderId: ORDER.orderId,
      plan: "essentielle",
      billingPeriod: "monthly",
    });
  });

  test("asks for automatic tax only when the deployment charges VAT", () => {
    expect(maintenanceSubscriptionParams(input).automatic_tax).toBeUndefined();
    expect(
      maintenanceSubscriptionParams({ ...input, automaticTax: true })
        .automatic_tax,
    ).toEqual({ enabled: true });
  });
});

/* ── The lookup that stands in once the key has expired ── */

const stripeSubscription = (
  over: Partial<Stripe.Subscription> = {},
): Stripe.Subscription =>
  ({
    id: "sub_existing",
    object: "subscription",
    customer: CUSTOMER,
    status: "trialing",
    metadata: { orderId: ORDER.orderId },
    start_date: 1788480000,
    trial_end: 1791072000,
    ...over,
  }) as Stripe.Subscription;

describe("findSubscriptionForOrder", () => {
  test("finds the one carrying this orderId", () => {
    expect(
      findSubscriptionForOrder([stripeSubscription()], ORDER.orderId)?.id,
    ).toBe("sub_existing");
  });

  test("ignores another order's subscription", () => {
    // One owner, several locations, several orders — each a separate sale that
    // has to be billed on its own subscription.
    expect(
      findSubscriptionForOrder(
        [stripeSubscription({ metadata: { orderId: "k17other" } })],
        ORDER.orderId,
      ),
    ).toBeNull();
  });

  test("ignores a subscription with no metadata at all", () => {
    expect(
      findSubscriptionForOrder(
        [stripeSubscription({ metadata: {} })],
        ORDER.orderId,
      ),
    ).toBeNull();
  });

  test.each(["canceled", "incomplete_expired"] as const)(
    "does not adopt a %s subscription — the order still needs one",
    (status) => {
      expect(
        findSubscriptionForOrder(
          [stripeSubscription({ status })],
          ORDER.orderId,
        ),
      ).toBeNull();
    },
  );

  test.each(["trialing", "active", "past_due", "unpaid", "incomplete"] as const)(
    "adopts a %s subscription — it is a live billing relationship",
    (status) => {
      expect(
        findSubscriptionForOrder(
          [stripeSubscription({ status })],
          ORDER.orderId,
        ),
      ).not.toBeNull();
    },
  );
});

/* ── The action, against a Stripe that enforces Stripe's rules ── */

describe("createSubscription", () => {
  test("two deliveries racing each other create ONE subscription", async () => {
    // The bug, reproduced: both deliveries look for an existing subscription
    // before either has created one, so both go on to create. Only the
    // idempotency key is left between the customer and a second monthly charge.
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.listIsBlind = true;

    await t.action(internal.stripe.createSubscription, subscriptionArgs(orderId));
    await t.action(internal.stripe.createSubscription, subscriptionArgs(orderId));

    expect(stripeFake.createCalls).toHaveLength(2);
    expect(stripeFake.subscriptions).toHaveLength(1);
    expect(stripeFake.replays).toBe(1);

    const [first, second] = stripeFake.createCalls;
    expect(first!.idempotencyKey).toBeDefined();
    expect(second!.idempotencyKey).toBe(first!.idempotencyKey);
  });

  test("the second delivery keeps the key even a day later", async () => {
    // A key whose body drifts is worse than no key: Stripe refuses it, and the
    // webhook records a provisioning failure on a sale that is fine.
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.listIsBlind = true;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T00:00:00Z"));
    await t.action(internal.stripe.createSubscription, subscriptionArgs(orderId));
    vi.setSystemTime(new Date("2026-09-06T12:34:56Z"));
    await t.action(internal.stripe.createSubscription, subscriptionArgs(orderId));

    expect(stripeFake.subscriptions).toHaveLength(1);
    expect(stripeFake.replays).toBe(1);
  });

  test("adopts the subscription Stripe already holds, past the key's 24 h", async () => {
    // The delivery that created the subscription and died before recording the
    // row. Hours later the key is gone and our side has nothing to find, so the
    // lookup at Stripe is the only thing standing between the order and a
    // second subscription.
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    stripeFake.subscriptions.push({
      id: "sub_orphan",
      object: "subscription",
      customer: CUSTOMER,
      status: "trialing",
      metadata: { orderId, plan: "essentielle", billingPeriod: "monthly" },
      start_date: stripeFake.startDate,
      trial_end: stripeFake.startDate + 30 * 24 * 60 * 60,
    });

    await t.action(internal.stripe.createSubscription, subscriptionArgs(orderId));

    expect(stripeFake.createCalls).toHaveLength(0);
    expect(stripeFake.subscriptions).toHaveLength(1);

    const row = await t.run(async (ctx) =>
      ctx.db.query("subscriptions").first(),
    );
    expect(row?.stripeSubscriptionId).toBe("sub_orphan");
  });

  test("records the period Stripe reports, not one off a local clock", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);

    await t.action(internal.stripe.createSubscription, subscriptionArgs(orderId));

    const row = await t.run(async (ctx) =>
      ctx.db.query("subscriptions").first(),
    );
    expect(row?.currentPeriodStart).toBe(stripeFake.startDate * 1000);
    expect(row?.currentPeriodEnd).toBe(
      (stripeFake.startDate + 30 * 24 * 60 * 60) * 1000,
    );
  });
});

/* ── The webhook contract this sits under ── */

/** Same scheme the route verifies: `t=<ts>,v1=<hex hmac of "ts.body">`. */
async function sign(body: string, secret: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${body}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

function checkoutCompleted(eventId: string): string {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: SESSION,
        customer: CUSTOMER,
        customer_details: { email: "chef@trattoria.fr" },
        /* Stripe declares `payment_status` non-optional on a Checkout Session
           and always sends it. It was absent here, and the webhook did not
           read it — which is the defect that let an « unpaid » Klarna session
           mark an order paid. Settlement is now gated on it, and an absent
           value fails closed, so a fixture without it exercises that gate
           instead of the provisioning this file is about. */
        payment_status: "paid",
        payment_method_types: ["card"],
        amount_total: 100000,
        payment_intent: "pi_trattoria",
        metadata: {
          plan: "essentielle",
          orderType: "creation",
          buyerType: "business",
          billingPeriod: "monthly",
        },
      },
    },
  });
}

async function deliver(
  t: ReturnType<typeof convexTest>,
  eventId: string,
): Promise<Response> {
  const body = checkoutCompleted(eventId);
  const response = await t.fetch("/webhooks/stripe", {
    method: "POST",
    headers: {
      "stripe-signature": await sign(body, "whsec_test_account_scope"),
      "content-type": "application/json",
    },
    body,
  });
  await drainScheduled(t);
  return response;
}

describe("checkout.session.completed", () => {
  test("provisions the subscription and answers 200", async () => {
    const t = convexTest(schema, modules);
    await seedOrder(t);

    expect((await deliver(t, "evt_1")).status).toBe(200);

    expect(stripeFake.subscriptions).toHaveLength(1);
    const order = await t.run(async (ctx) => ctx.db.query("orders").first());
    expect(order?.status).toBe("paid");
    expect(order?.subscriptionStatus).toBe("active");
  });

  test("a redelivery leaves the customer on one subscription", async () => {
    const t = convexTest(schema, modules);
    await seedOrder(t);

    await deliver(t, "evt_1");
    expect((await deliver(t, "evt_2")).status).toBe(200);

    expect(stripeFake.subscriptions).toHaveLength(1);
    const rows = await t.run(async (ctx) =>
      ctx.db.query("subscriptions").collect(),
    );
    expect(rows).toHaveLength(1);
  });

  test("a failure AFTER the payment still answers 200", async () => {
    // Not a detail: a 500 here puts Stripe into a replay loop over a webhook
    // whose earlier effects have already run. The sale is recorded as
    // unprovisioned instead, for an operator to pick up.
    const t = convexTest(schema, modules);
    await seedOrder(t);
    vi.stubEnv("STRIPE_PRICE_ESSENTIELLE_MONTHLY", "");

    expect((await deliver(t, "evt_1")).status).toBe(200);

    expect(stripeFake.subscriptions).toHaveLength(0);
    const order = await t.run(async (ctx) => ctx.db.query("orders").first());
    expect(order?.status).toBe("paid");
    expect(order?.subscriptionStatus).toBe("failed");
  });
});
