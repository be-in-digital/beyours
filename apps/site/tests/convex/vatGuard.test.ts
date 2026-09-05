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

/** Premium: outside the founders offer, which is Essentielle-only. */
function checkoutArgs() {
  return {
    plan: "premium" as const,
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
    // The stance the summary rendered, which is what the deployment's flags
    // require of it. Overridden in the cross-env cases below, which are about
    // the two disagreeing.
    taxDisplayed: CHARGING_EXPECTED,
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

/* ── The two envs, compared ──
   The check above measures the Convex flag against the regime, and
   `validateSiteEnv` measures the Next flag against the same regime. Both were
   anchored and neither could see the other's env, so a bundle built with the
   wrong charging flag — or built before the flag was set — passed its own
   check, met a Convex deployment that passed its own check, and disagreed with
   it in front of the customer. Nothing compared the two until the checkout
   started carrying the stance the client actually rendered. */

describe("createCheckoutSession — the total the customer was shown", () => {
  test("refuses when the summary quoted no VAT and Stripe would charge it", async () => {
    // The measured mischarge: NEXT_PUBLIC_TVA_ENABLED forgotten on Vercel,
    // STRIPE_TAX_ENABLED set on Convex. The summary rendered 9 500 €, Stripe
    // was about to debit 11 400 €, and the deployment booted clean.
    vi.stubEnv("STRIPE_TAX_ENABLED", "true");
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...checkoutArgs(),
        taxDisplayed: false,
      })
    ).rejects.toThrow(/\[TVA\]/);
  });

  test("names the Next-side flag, which is the one to go and set", async () => {
    // The Convex flag is right here; repeating it would send the operator to
    // the wrong console.
    vi.stubEnv("STRIPE_TAX_ENABLED", "true");
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...checkoutArgs(),
        taxDisplayed: false,
      })
    ).rejects.toThrow(/NEXT_PUBLIC_TVA_ENABLED/);
  });

  test("writes no order when the two disagree", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", "true");
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...checkoutArgs(),
        taxDisplayed: false,
      })
    ).rejects.toThrow(/\[TVA\]/);

    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
  });

  test("refuses the other direction too, where the customer is over-quoted", async () => {
    // Franchise en base on Convex, a bundle still quoting VAT. Nobody is
    // debited more than they agreed, but the summary is 20 % above the invoice
    // and the sale would be argued about afterwards. Under the régime réel the
    // regime check fires first, which is why this asserts only the refusal.
    vi.stubEnv("STRIPE_TAX_ENABLED", "false");
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...checkoutArgs(),
        taxDisplayed: true,
      })
    ).rejects.toThrow(/\[TVA\]/);
  });

  test("lets the sale through when the summary matches what Stripe charges", async () => {
    // The mirror: a guard that refused every checkout would pass all four
    // above. Same env as the regime-agreement case, and the order is recorded.
    vi.stubEnv("STRIPE_TAX_ENABLED", String(CHARGING_EXPECTED));
    vi.stubEnv("BEYOURS_TEST_CHECKOUT", "true");
    const t = convexTest(schema, modules);

    const result = await t.action(api.stripe.createCheckoutSession, {
      ...checkoutArgs(),
      taxDisplayed: CHARGING_EXPECTED,
    });

    expect(result.orderId).toBeDefined();
  });
});
