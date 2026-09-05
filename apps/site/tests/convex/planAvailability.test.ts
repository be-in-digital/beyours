/// <reference types="vite/client" />

/**
 * Premium was on sale behind an « À venir » badge.
 *
 * The pricing card carried `comingSoon: true`, so /tarifs showed the badge and
 * swapped the call to action for a lead capture — and that was the whole of it.
 * `/checkout` reads its plan straight off the query string and
 * `createCheckoutSession` accepted `plan: "premium"` as a first-class literal,
 * so `/checkout?plan=premium` — the route the sales playbook hands buyers —
 * collected 7 500 € HT + 2 000 €/an for a native application that does not
 * exist. A badge on a card is not a guard on the money.
 *
 * These cases hold the two together: the badge is derived from the constant
 * that refuses the sale, and no plan can be open while it still advertises
 * something only planned.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { isPlanOpenForSale } from "../../convex/planAvailability";
import { plans, comparisonCategories } from "../../components/pricing/pricing-data";
import { VAT } from "../../lib/legal/company";

const modules = import.meta.glob("../../convex/**/*.ts");

const PLAN_SLUGS = ["essentielle", "premium"] as const;

function checkoutArgs(plan: (typeof PLAN_SLUGS)[number]) {
  return {
    plan,
    orderType: "creation" as const,
    buyerType: "business" as const,
    billingPeriod: "yearly" as const,
    customerEmail: "chef@pizzeria-napoli.fr",
    customerFirstName: "Camille",
    customerLastName: "Dubois",
    customerPhone: "+33600000000",
    restaurantName: "Pizzeria Napoli",
    city: "Paris",
    successUrl: "https://beyours.fr/merci",
    cancelUrl: "https://beyours.fr/tarifs",
    // Both required since #349 and #346, and both given the value that keeps
    // the guards below quiet, so a refusal in these cases can only be about
    // plan availability. `taxDisplayed` has to agree with STRIPE_TAX_ENABLED,
    // which beforeEach pins to the regime — the same pairing checkoutWithoutStripe
    // and vatGuard use.
    withdrawalWaiverConsent: true,
    taxDisplayed: VAT.regime === "reel",
  };
}

/** The plans this suite can meaningfully assert about, whichever way they are set. */
const closedPlans = PLAN_SLUGS.filter((p) => !isPlanOpenForSale(p));
const openPlans = PLAN_SLUGS.filter((p) => isPlanOpenForSale(p));

beforeEach(() => {
  // The VAT flag has its own guard next door; pinned to what the regime wants
  // so a refusal here can only be about availability.
  vi.stubEnv("STRIPE_TAX_ENABLED", String(VAT.regime === "reel"));
  // The deliberate no-payment path. Asking for it by name matters: it is the
  // branch that records an order and marks it paid without ever calling
  // Stripe, so it is the one a closed plan must not reach.
  vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.runIf(closedPlans.length > 0)("a plan that is not open for sale", () => {
  test("is refused on the very path that would mark an order paid", async () => {
    const t = convexTest(schema, modules);

    for (const plan of closedPlans) {
      await expect(
        t.action(api.stripe.createCheckoutSession, checkoutArgs(plan)),
      ).rejects.toThrow(/n'est pas encore ouverte à la vente/);
    }
  });

  test("leaves no order behind when it refuses", async () => {
    const t = convexTest(schema, modules);

    for (const plan of closedPlans) {
      await expect(
        t.action(api.stripe.createCheckoutSession, checkoutArgs(plan)),
      ).rejects.toThrow();
    }

    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
  });

  test("is refused with a Stripe key configured too, not only in test mode", async () => {
    // The refusal has to come before the environment is consulted at all,
    // otherwise a correctly configured production deployment is the one place
    // the plan is still sellable.
    //
    // Deliberately not shaped like a Stripe key: `resolveStripeAccess` only
    // tests this variable for truthiness, so any non-empty string configures
    // the live path — and an `sk_test_…` literal here is a finding for the
    // secret scan (rule `stripe-access-token`), which is a real cost for no
    // added coverage. Do not make this "realistic".
    vi.stubEnv("STRIPE_SECRET_KEY", "configured-for-this-test");
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "");
    const t = convexTest(schema, modules);

    for (const plan of closedPlans) {
      await expect(
        t.action(api.stripe.createCheckoutSession, checkoutArgs(plan)),
      ).rejects.toThrow(/n'est pas encore ouverte à la vente/);
    }
  });

  test("says which offer to take instead, since a buyer reads this", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, checkoutArgs(closedPlans[0])),
    ).rejects.toThrow(/Essentielle|prévenu du lancement/);
  });
});

describe.runIf(openPlans.length > 0)("a plan that is open", () => {
  test("still reaches a recorded order — the guard refuses one thing, not everything", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(
      api.stripe.createCheckoutSession,
      checkoutArgs(openPlans[0]),
    );

    expect(result.orderId).toBeDefined();
    expect(
      await t.run((ctx) => ctx.db.query("orders").collect()),
    ).toHaveLength(1);
  });
});

describe("the pricing page and the checkout cannot drift apart", () => {
  test("every card's « À venir » badge is the checkout's own answer", () => {
    for (const plan of plans) {
      expect(Boolean(plan.comingSoon)).toBe(!isPlanOpenForSale(plan.slug));
    }
  });

  test("no plan on sale advertises a feature that is only planned", () => {
    const sold = plans.filter((p) => isPlanOpenForSale(p.slug));

    const broken = comparisonCategories.flatMap((category) =>
      category.features.flatMap((feature) =>
        sold
          .filter((plan) => feature[plan.slug] === "planned")
          .map((plan) => `${plan.name} · ${category.name} · ${feature.label}`),
      ),
    );

    expect(broken).toEqual([]);
  });
});
