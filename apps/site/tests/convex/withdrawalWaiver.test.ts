/// <reference types="vite/client" />

/**
 * The art. L. 221-28 waiver the CGV rely on is recorded, server-side, or the
 * order is refused.
 *
 * « En cochant la case de consentement prévue à cet effet lors de la commande,
 * le Client demande expressément que l'exécution commence immédiatement »
 * (app/(landing)/cgv/page.tsx). That box existed only as React state:
 * `createCheckoutSession` took no consent argument and the `orders` table had
 * no field to put one in. Two consequences, and these cases pin both — the
 * company could produce nothing when a consumer exercised a 14-day withdrawal
 * on a 3 500 € build, and the gate was client-side on a public action, so it
 * could simply be skipped by calling the action directly.
 *
 * The pattern already existed next door: `affiliateSignature` takes
 * `consented: v.boolean()` and refuses without it.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { TEST_CHECKOUT_ENV } from "../../convex/stripeMode";
import { VAT } from "../../lib/legal/company";
import { WITHDRAWAL_WAIVER } from "../../lib/legal/withdrawal-waiver";

const modules = import.meta.glob("../../convex/**/*.ts");

const CHECKOUT = {
  plan: "essentielle" as const,
  orderType: "creation" as const,
  buyerType: "personal" as const,
  billingPeriod: "monthly" as const,
  customerEmail: "chef@trattoria.fr",
  customerFirstName: "Giulia",
  customerLastName: "Rossi",
  customerPhone: "+33612345678",
  restaurantName: "Trattoria Rossi",
  city: "Lyon",
  successUrl: "https://beyours.fr/checkout/success",
  cancelUrl: "https://beyours.fr/checkout",
  /* Aligned with the regime for the same reason STRIPE_TAX_ENABLED is pinned
     below: these cases are about the consent record, and the VAT refusal that
     sits just above the waiver check must not answer for it. */
  taxDisplayed: VAT.regime === "reel",
};

beforeEach(() => {
  // The deliberate no-payment path: these cases are about the consent record,
  // not about Stripe, and #252 would otherwise refuse first.
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv(TEST_CHECKOUT_ENV, "true");
  vi.stubEnv("STRIPE_TAX_ENABLED", String(VAT.regime === "reel"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCheckoutSession — the withdrawal waiver", () => {
  test("refuses an order whose box was not ticked", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        withdrawalWaiverConsent: false,
      }),
    ).rejects.toThrow(/L\. 221-28/);
  });

  test("leaves no order and no founders seat behind when it refuses", async () => {
    // Not merely "no paid order": the refusal happens before the row is
    // created, so a skipped consent produces nothing for the ops console to
    // count as revenue — the invariant #252 and #174 already hold.
    //
    // The rejection is matched on the ART. L. 221-28 message, not on "it
    // threw". Without that, the old code passes this case for the wrong
    // reason: it has no `withdrawalWaiverConsent` argument, so Convex's
    // validator rejects the call before the handler runs and no order is
    // written either. A test that green-lights the absence of the fix is worse
    // than no test.
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        withdrawalWaiverConsent: false,
      }),
    ).rejects.toThrow(/L\. 221-28/);

    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });

  test("records the clause, the wording and a server timestamp", async () => {
    const t = convexTest(schema, modules);
    const before = Date.now();

    await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      withdrawalWaiverConsent: true,
    });

    const [order] = await t.run((ctx) => ctx.db.query("orders").collect());
    const waiver = order!.withdrawalWaiver;
    expect(waiver).toBeDefined();
    expect(waiver!.version).toBe(WITHDRAWAL_WAIVER.version);
    expect(waiver!.text).toBe(WITHDRAWAL_WAIVER.text);
    expect(waiver!.cgvClause).toBe(WITHDRAWAL_WAIVER.cgvClause);
    expect(waiver!.consentedAt).toBeGreaterThanOrEqual(before);
    expect(waiver!.consentedAt).toBeLessThanOrEqual(Date.now());
  });

  test("gives a caller no way to supply its own wording", async () => {
    // The action takes a boolean, never a clause. Two halves, and the second is
    // what makes this fail on the old code: a rogue clause is refused by the
    // validator, AND an accepted order carries the server's own text.
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        withdrawalWaiverConsent: true,
        withdrawalWaiverText: "Le Client renonce à tout recours.",
      } as unknown as Parameters<
        typeof t.action<typeof api.stripe.createCheckoutSession>
      >[1]),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);

    await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      withdrawalWaiverConsent: true,
    });
    const [order] = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(order!.withdrawalWaiver!.text).toBe(WITHDRAWAL_WAIVER.text);
    expect(order!.withdrawalWaiver!.text).not.toMatch(/renonce à tout recours/);
  });

  test("the clause the buyer reads is the clause that is stored", async () => {
    // Read the two sources, rather than asserting a comment about them. If
    // anyone inlines the sentence at either end, the two can drift and the
    // audit trail stops describing what the buyer saw — so both files have to
    // go on referencing the shared constant.
    const sources = import.meta.glob(
      ["../../components/checkout/checkout-flow.tsx", "../../convex/stripe.ts"],
      { query: "?raw", import: "default", eager: true },
    ) as Record<string, string>;
    const [checkoutUi, checkoutAction] = Object.keys(sources)
      .sort()
      .map((k) => sources[k]!);

    // The label the buyer reads, and the value the server stores.
    expect(checkoutUi).toMatch(/\{WITHDRAWAL_WAIVER\.text\}/);
    expect(checkoutAction).toMatch(/text: WITHDRAWAL_WAIVER\.text/);
    // Neither hard-codes the sentence.
    expect(checkoutUi).not.toMatch(/perdre mon droit de rétractation/);
    expect(checkoutAction).not.toMatch(/perdre mon droit de rétractation/);

    // And the constant still says what the CGV describe.
    expect(WITHDRAWAL_WAIVER.text).toMatch(/L\. 221-28/);
    expect(WITHDRAWAL_WAIVER.text).toMatch(/exécution immédiate/);
    expect(WITHDRAWAL_WAIVER.text).toMatch(/droit de rétractation/);
    expect(WITHDRAWAL_WAIVER.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
