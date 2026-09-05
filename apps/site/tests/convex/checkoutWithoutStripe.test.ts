/// <reference types="vite/client" />

/**
 * The card's own closing condition, run against the real action (#155).
 *
 * "Removing STRIPE_SECRET_KEY from a deployment makes checkout fail instead of
 * succeeding for free." The rule is unit-tested next door in stripeMode.test.ts;
 * what these cases add is that `createCheckoutSession` actually consults it,
 * and that it does so *before* the order exists — a deployment that refuses
 * must leave nothing behind for the ops console to count as revenue.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { TEST_CHECKOUT_ENV } from "../../convex/stripeMode";
import { VAT } from "../../lib/legal/company";

const modules = import.meta.glob("../../convex/**/*.ts");

const CHECKOUT = {
  plan: "essentielle" as const,
  orderType: "creation" as const,
  buyerType: "business" as const,
  billingPeriod: "monthly" as const,
  customerEmail: "chef@trattoria.fr",
  customerFirstName: "Giulia",
  customerLastName: "Rossi",
  customerPhone: "+33612345678",
  restaurantName: "Trattoria Rossi",
  city: "Lyon",
  siret: "12345678901234",
  successUrl: "https://beyours.fr/checkout/success",
  cancelUrl: "https://beyours.fr/checkout",
  withdrawalWaiverConsent: true,
};

beforeEach(() => {
  // Whatever the machine running the suite happens to export.
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv(TEST_CHECKOUT_ENV, "");
  // Pinned for the same reason, and because the checkout gained a second
  // refusal (#174): a sale is turned away when this flag contradicts the
  // declared VAT regime. These cases are about the Stripe key, so the tax
  // configuration is set to the one the regime requires and kept out of the way.
  vi.stubEnv("STRIPE_TAX_ENABLED", String(VAT.regime === "reel"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCheckoutSession without a Stripe key", () => {
  test("refuses instead of handing out a paid order", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, CHECKOUT)
    ).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });

  test("leaves no order behind at all", async () => {
    // Not merely "no paid order". The refusal happens before the row is
    // created, so a deployment that lost its key produces nothing for
    // countFoundersSold to count or the ops console to report as revenue.
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, CHECKOUT)
    ).rejects.toThrow();

    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toEqual([]);
  });

  test("consumes no founders seat", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.stripe.createCheckoutSession, CHECKOUT)
    ).rejects.toThrow();

    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });
});

describe("createCheckoutSession on the deliberate test path", () => {
  test("still completes when the deployment asks for it by name", async () => {
    // The escape hatch has to keep working — a local run with no Stripe
    // account is the reason it exists. What changed is that it is now asked
    // for, not fallen into.
    const t = convexTest(schema, modules);
    vi.stubEnv(TEST_CHECKOUT_ENV, "true");

    const result = await t.action(api.stripe.createCheckoutSession, CHECKOUT);

    expect(result.testMode).toBe(true);
    expect(result.url).toContain("test=1");

    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toHaveLength(1);
    expect(orders[0]?.status).toBe("paid");
  });
});
