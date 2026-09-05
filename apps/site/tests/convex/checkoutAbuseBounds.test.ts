/// <reference types="vite/client" />

/**
 * What bounds an unauthenticated checkout.
 *
 * `stripe.createCheckoutSession` is public, takes no session, and creates an
 * `orders` row — and a Stripe coupon — before anything is paid. Nothing
 * bounded it. Measured before the fix: ten anonymous calls put
 * `countFoundersSold` at 10, « 0 places restantes » on the launch offer for a
 * full day, and `isFounders: false` on every genuine buyer in that window.
 *
 * Read the last describe block before assuming this closes the hole. It does
 * not, and it says why: ten calls is fewer than any ceiling a real storefront
 * can carry. What these cases pin is the rate, the duration, and the release —
 * the three things that were unbounded.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { TEST_CHECKOUT_ENV } from "../../convex/stripeMode";
import { FOUNDERS_HOLD_MS, foundersOffer } from "../../convex/foundersOffer";
import { RATE_LIMITS } from "../../convex/rateLimit";
import { VAT } from "../../lib/legal/company";

const modules = import.meta.glob("../../convex/**/*.ts");

const CHECKOUT = {
  plan: foundersOffer.plan,
  orderType: "creation" as const,
  buyerType: "business" as const,
  billingPeriod: "yearly" as const,
  customerFirstName: "Mal",
  customerLastName: "Ory",
  customerPhone: "+33612345678",
  restaurantName: "Chez Flood",
  city: "Lyon",
  successUrl: "https://beyours.fr/checkout/success",
  cancelUrl: "https://beyours.fr/checkout",
  /* Required since #349: the express request for immediate performance
     (art. L. 221-28). The handler refuses a checkout without it, so every
     case here has to carry it to reach the behaviour it is testing. */
  withdrawalWaiverConsent: true,
  /* Required since #346: what the summary the customer read actually
     quoted, so the handler can check it against what Stripe is about to
     charge. Same expression the other checkout suites use. */
  taxDisplayed: VAT.regime === "reel",
};

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv(TEST_CHECKOUT_ENV, "true");
  vi.stubEnv("STRIPE_TAX_ENABLED", String(VAT.regime === "reel"));
});
afterEach(() => vi.unstubAllEnvs());

/** How many of `attempts` checkouts the site accepted. */
async function accepted(
  t: ReturnType<typeof convexTest>,
  attempts: number,
  email: (i: number) => string,
): Promise<number> {
  let n = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      await t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        customerEmail: email(i),
      });
      n++;
    } catch {
      /* refused — that is the bound doing its job */
    }
  }
  return n;
}

describe("one address cannot open checkouts in a loop", () => {
  test("it is cut off at the per-email limit", async () => {
    const t = convexTest(schema, modules);
    const limit = RATE_LIMITS.checkoutPerEmail.limit;

    expect(await accepted(t, limit + 7, () => "loop@example.test")).toBe(limit);
  });

  test("the refusal names a retry, it does not fail silently", async () => {
    const t = convexTest(schema, modules);
    await accepted(t, RATE_LIMITS.checkoutPerEmail.limit, () => "loop@example.test");

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        customerEmail: "loop@example.test",
      }),
    ).rejects.toThrow(/Trop de requêtes/);
  });

  test("a genuine buyer's retries still go through", async () => {
    /* The limit has to survive contact with a real customer: an abandoned
       checkout, a change of plan, a card declined twice. */
    const t = convexTest(schema, modules);

    expect(await accepted(t, 4, () => "vrai-client@trattoria.fr")).toBe(4);
  });

  test("one address being cut off does not block anybody else", async () => {
    const t = convexTest(schema, modules);
    await accepted(t, RATE_LIMITS.checkoutPerEmail.limit + 3, () => "loop@example.test");

    const other = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      customerEmail: "quelquun-dautre@trattoria.fr",
    });
    expect(other.orderId).toBeDefined();
  });
});

describe("invented addresses do not buy an unbounded flood", () => {
  test("the site-wide window caps the total", async () => {
    const t = convexTest(schema, modules);
    const limit = RATE_LIMITS.checkoutSiteWide.limit;

    expect(await accepted(t, limit + 25, (i) => `flood${i}@example.test`)).toBe(limit);
  });

  test("the site-wide ceiling is far above real volume", () => {
    /* Sized so a launch-day burst never meets it: this site sells a handful of
       builds. A ceiling a genuine buyer can reach is a self-inflicted outage. */
    expect(RATE_LIMITS.checkoutSiteWide.limit).toBeGreaterThanOrEqual(50);
    expect(RATE_LIMITS.checkoutSiteWide.windowMs).toBe(60 * 60_000);
  });

  test("no order row is written for a refused checkout", async () => {
    const t = convexTest(schema, modules);
    const limit = RATE_LIMITS.checkoutSiteWide.limit;
    await accepted(t, limit + 15, (i) => `flood${i}@example.test`);

    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    // The counter commits in the same transaction as the row, so a refusal
    // leaves nothing behind for countFoundersSold or the ops console.
    expect(orders).toHaveLength(limit);
  });
});

describe("a founders seat is held for a checkout, not for a day", () => {
  test("the hold is minutes — sized to a payment, not to a Stripe session", async () => {
    expect(FOUNDERS_HOLD_MS).toBe(30 * 60 * 1000);
    expect(FOUNDERS_HOLD_MS).toBeLessThan(60 * 60 * 1000);
  });

  test("a burst of pending holds clears on its own", async () => {
    const t = convexTest(schema, modules);
    await accepted(t, foundersOffer.totalSlots, (i) => `flood${i}@example.test`);

    /* Production leaves the order PENDING until the webhook lands; the
       no-payment path marks it paid, which is not the attack being modelled. */
    await t.run(async (ctx) => {
      for (const o of await ctx.db.query("orders").collect()) {
        await ctx.db.patch(o._id, { status: "pending" as const });
      }
    });
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(
      foundersOffer.totalSlots,
    );

    await t.run(async (ctx) => {
      for (const o of await ctx.db.query("orders").collect()) {
        await ctx.db.patch(o._id, {
          createdAt: Date.now() - FOUNDERS_HOLD_MS - 1,
        });
      }
    });

    // Was 24 h. Every genuine buyer arriving inside that day was told the
    // offer was gone and charged list price.
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });

  test("a paid founders sale keeps its seat forever", async () => {
    // The window releases HOLDS. A sale is not a hold.
    const t = convexTest(schema, modules);
    await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      customerEmail: "vrai-client@trattoria.fr",
    });

    await t.run(async (ctx) => {
      for (const o of await ctx.db.query("orders").collect()) {
        await ctx.db.patch(o._id, {
          status: "paid" as const,
          createdAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
        });
      }
    });

    expect(await t.query(api.orders.countFoundersSold, {})).toBe(1);
  });
});

describe("what these bounds do NOT do", () => {
  test("a ten-call burst still empties a ten-slot offer", async () => {
    /* Stated as a test rather than left as a surprise. The offer has ten
       slots; ten calls is fewer than any ceiling a storefront can carry, so no
       rate limit reachable-only-by-attackers exists here. What changed is the
       DURATION (30 min, above) and the RATE (the two windows). Preventing it
       outright means authenticating or challenging the checkout — a product
       decision, not one to smuggle in behind a limit low enough to refuse
       genuine buyers.

       The offer's real cap is elsewhere and unaffected: the Stripe coupon's
       max_redemptions, which Stripe enforces (see ./foundersOffer). This
       counter only decides what the page advertises. */
    const t = convexTest(schema, modules);

    const n = await accepted(t, foundersOffer.totalSlots, (i) => `flood${i}@example.test`);
    expect(n).toBe(foundersOffer.totalSlots);
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(
      foundersOffer.totalSlots,
    );
  });
});
