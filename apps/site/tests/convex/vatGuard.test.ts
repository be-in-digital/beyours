/// <reference types="vite/client" />

/**
 * A sale is refused rather than invoiced under the wrong VAT regime (#174).
 *
 * `lib/legal/company.ts` declares the régime réel while `STRIPE_TAX_ENABLED`
 * was absent, so the site charged no VAT on invoices that carry the intra-EU
 * VAT number — the mention of a company that collects it. The VAT stayed due
 * either way. `vatConfigurationProblem` had detected exactly this since it was
 * written; its only caller logged the string with `console.error` and opened
 * the Checkout session anyway, because which of the two to align was a fiscal
 * decision rather than an engineering one.
 *
 * The decision is made: régime réel, Stripe Tax on. What remains is a
 * misconfiguration, and it now stops the sale. An invoice is a legal document:
 * a refused sale can be retried once the env is right, an invoice stating a
 * VAT position the company does not hold cannot be taken back.
 *
 * The check also used to sit *after* the early return for the keyless path, so
 * the one branch that marks an order paid without ever reaching Stripe never
 * checked at all. It now runs before an order, a coupon or a session exists —
 * behind the missing-key refusal of #252, which is the blunter question, but
 * ahead of every write.
 *
 * That is why these tests set BEYOURS_TEST_CHECKOUT: without a Stripe key,
 * #252 refuses first and the assertions would pass on the wrong refusal. They
 * match the [TVA] message specifically for the same reason.
 */

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { VAT } from "../../lib/legal/company";

const modules = import.meta.glob("../../convex/**/*.ts");

/** What the regime in force requires of the charging flags. */
const CHARGING_EXPECTED = VAT.regime === "reel";

/* Essentielle, because Premium is no longer open for sale: the checkout now
   refuses a plan whose availability is "coming_soon" before it reaches the VAT
   guard (convex/planAvailability.ts), and these cases would then pass on the
   wrong refusal. This case originally chose Premium to sit outside the founders
   offer; with no STRIPE_SECRET_KEY here `resolveFoundersPricing` returns
   "zero-line" rather than throwing, so Essentielle is just as quiet. */
function checkoutArgs() {
  return {
    plan: "essentielle" as const,
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
    withdrawalWaiverConsent: true,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCheckoutSession — the VAT configuration", () => {
  test("refuses the sale when the charging flag contradicts the regime", async () => {
    // The replay. Before the fix this logged and sold anyway, issuing an
    // invoice with no VAT under a regime that owes it.
    vi.stubEnv("STRIPE_TAX_ENABLED", String(!CHARGING_EXPECTED));
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, checkoutArgs())
    ).rejects.toThrow(/\[TVA\]/);
  });

  test("writes no order when it refuses", async () => {
    // The guard runs before anything is created. It used to sit after the
    // test-mode branch, which marks an order paid without touching Stripe.
    vi.stubEnv("STRIPE_TAX_ENABLED", String(!CHARGING_EXPECTED));
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, checkoutArgs())
    ).rejects.toThrow(/\[TVA\]/);

    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
  });

  test("names what to align rather than only that something is wrong", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", String(!CHARGING_EXPECTED));
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, checkoutArgs())
    ).rejects.toThrow(/STRIPE_TAX_ENABLED|Stripe Tax/);
  });

  test("lets the sale through once the flag agrees with the regime", async () => {
    // The mirror. A guard that refused everything would pass the three above.
    // No STRIPE_SECRET_KEY here, so the no-payment path has to be asked for by
    // name (#252) — without it `resolveStripeAccess` refuses first and this
    // would pass on the wrong refusal. It stops at a recorded order, which is
    // far enough to prove the VAT guard let it past.
    vi.stubEnv("STRIPE_TAX_ENABLED", String(CHARGING_EXPECTED));
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    const result = await t.action(
      api.stripe.createCheckoutSession,
      checkoutArgs()
    );

    expect(result.orderId).toBeDefined();
    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toHaveLength(1);
  });
});
