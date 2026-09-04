import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { toFacts } from "../../convex/stripeAudit";
import { auditMaintenancePrice, EXPECTED_MAINTENANCE_PRICES } from "../../convex/stripePriceAudit";

/* toFacts is the whole reason the audit can be wrong about a correct Price, or
   right about a broken one: it decides which Stripe field each rule reads. It
   had no test at all — replacing `price.unit_amount` with a constant left the
   suite green. */

const stripePrice = (over: Partial<Stripe.Price> = {}): Stripe.Price =>
  ({
    id: "price_1",
    object: "price",
    active: true,
    currency: "eur",
    unit_amount: 100000,
    tax_behavior: "exclusive",
    recurring: { interval: "year", interval_count: 1 },
    product: "prod_maintenance",
    livemode: true,
    ...over,
  }) as Stripe.Price;

describe("toFacts", () => {
  it("reads each field the audit rules depend on", () => {
    expect(toFacts(stripePrice())).toEqual({
      id: "price_1",
      active: true,
      currency: "eur",
      unitAmount: 100000,
      taxBehavior: "exclusive",
      recurringInterval: "year",
      recurringIntervalCount: 1,
      productId: "prod_maintenance",
      livemode: true,
    });
  });

  it("keeps a tiered price's null amount rather than coercing it to zero", () => {
    expect(toFacts(stripePrice({ unit_amount: null })).unitAmount).toBeNull();
  });

  it("reads a one-time price as having no recurrence", () => {
    const facts = toFacts(stripePrice({ recurring: null }));
    expect(facts.recurringInterval).toBeNull();
    expect(facts.recurringIntervalCount).toBeNull();
  });

  /* Stripe returns `product` as an id unless expanded, and as an object when
     it is. Narrowed rather than cast, so an expanded response cannot silently
     stringify to "[object Object]" and match no creation Product. */
  it("takes the product id whether or not Stripe expanded it", () => {
    expect(toFacts(stripePrice({ product: "prod_x" })).productId).toBe("prod_x");
    expect(
      toFacts(stripePrice({ product: { id: "prod_y" } as Stripe.Product })).productId,
    ).toBe("prod_y");
  });

  it("treats an absent tax_behavior as unset, which the audit then flags", () => {
    const facts = toFacts(stripePrice({ tax_behavior: null }));
    expect(facts.taxBehavior).toBeNull();
    const expected = EXPECTED_MAINTENANCE_PRICES.find(
      (e) => e.envName === "STRIPE_PRICE_ESSENTIELLE_YEARLY",
    )!;
    expect(
      auditMaintenancePrice(expected, facts, {
        creationProductIds: ["prod_creation"],
        liveMode: true,
      }).map((f) => f.field),
    ).toEqual(["tax_behavior"]);
  });

  /* End to end through the real mapping: a Stripe response for a correctly
     created yearly Essentielle Price must raise nothing. */
  it("maps a correct live Price to a clean audit", () => {
    const expected = EXPECTED_MAINTENANCE_PRICES.find(
      (e) => e.envName === "STRIPE_PRICE_ESSENTIELLE_YEARLY",
    )!;
    expect(
      auditMaintenancePrice(expected, toFacts(stripePrice()), {
        creationProductIds: ["prod_creation"],
        liveMode: true,
      }),
    ).toEqual([]);
  });
});
