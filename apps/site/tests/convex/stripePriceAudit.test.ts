import { describe, it, expect } from "vitest";
import { planPrices } from "../../convex/planPrices";
import {
  EXPECTED_MAINTENANCE_PRICES,
  auditMaintenancePrice,
  auditMaintenancePrices,
  type ExpectedPrice,
  type StripePriceFacts,
} from "../../convex/stripePriceAudit";

/* The gap this closes, recorded in tasks/stripe-founders-offer-runbook.md §7:
   "A maintenance Price created at the wrong amount — No. Nothing compares
   Stripe to planPrices." The four STRIPE_PRICE_* are opaque ids;
   resolveMaintenancePriceId checks they are SET, never that they are RIGHT.
   A wrong one is silent until a customer disputes a renewal invoice. */

const CREATION_PRODUCT = "prod_creation_essentielle";
const MAINTENANCE_PRODUCT = "prod_maintenance";

const CONTEXT = {
  creationProductIds: [CREATION_PRODUCT, "prod_creation_premium"],
  liveMode: true,
};

const expectedFor = (envName: string): ExpectedPrice => {
  const found = EXPECTED_MAINTENANCE_PRICES.find((e) => e.envName === envName);
  if (!found) throw new Error(`no expectation for ${envName}`);
  return found;
};

/** A Price that is correct in every respect — the baseline each case breaks. */
function validFacts(
  expected: ExpectedPrice,
  over: Partial<StripePriceFacts> = {},
): StripePriceFacts {
  return {
    id: `price_${expected.plan}_${expected.period}`,
    active: true,
    currency: expected.currency,
    unitAmount: expected.unitAmount,
    taxBehavior: expected.taxBehavior,
    recurringInterval: expected.interval,
    recurringIntervalCount: 1,
    productId: MAINTENANCE_PRODUCT,
    livemode: true,
    ...over,
  };
}

const audit = (envName: string, over: Partial<StripePriceFacts> = {}) =>
  auditMaintenancePrice(expectedFor(envName), validFacts(expectedFor(envName), over), CONTEXT);

const fields = (envName: string, over: Partial<StripePriceFacts> = {}) =>
  audit(envName, over).map((f) => f.field);

describe("what the four maintenance Prices must be", () => {
  it("derives one expectation per plan and period", () => {
    expect(EXPECTED_MAINTENANCE_PRICES).toHaveLength(4);
    expect(EXPECTED_MAINTENANCE_PRICES.map((e) => e.envName).sort()).toEqual([
      "STRIPE_PRICE_ESSENTIELLE_MONTHLY",
      "STRIPE_PRICE_ESSENTIELLE_YEARLY",
      "STRIPE_PRICE_PREMIUM_MONTHLY",
      "STRIPE_PRICE_PREMIUM_YEARLY",
    ]);
  });

  /* Derived, not copied: an edit to planPrices.ts must move the expectation
     with it, or this audit would bless the very drift it exists to catch. */
  it("takes every amount from planPrices", () => {
    expect(expectedFor("STRIPE_PRICE_ESSENTIELLE_MONTHLY").unitAmount).toBe(
      planPrices.essentielle.maintenanceMonthly,
    );
    expect(expectedFor("STRIPE_PRICE_ESSENTIELLE_YEARLY").unitAmount).toBe(
      planPrices.essentielle.maintenanceYearly,
    );
    expect(expectedFor("STRIPE_PRICE_PREMIUM_MONTHLY").unitAmount).toBe(
      planPrices.premium.maintenanceMonthly,
    );
    expect(expectedFor("STRIPE_PRICE_PREMIUM_YEARLY").unitAmount).toBe(
      planPrices.premium.maintenanceYearly,
    );
  });

  it("expects euros, exclusive tax, and the interval the period sells", () => {
    for (const e of EXPECTED_MAINTENANCE_PRICES) {
      expect(e.currency).toBe("eur");
      expect(e.taxBehavior).toBe("exclusive");
      expect(e.interval).toBe(e.period === "monthly" ? "month" : "year");
    }
  });
});

/* The mirror. A check that fired on everything would pass every case below. */
describe("a correctly configured Price", () => {
  it.each(EXPECTED_MAINTENANCE_PRICES.map((e) => e.envName))(
    "%s raises nothing",
    (envName) => {
      expect(audit(envName)).toEqual([]);
    },
  );

  it("reports nothing across all four at once", () => {
    const prices = Object.fromEntries(
      EXPECTED_MAINTENANCE_PRICES.map((e) => [e.envName, validFacts(e)]),
    );
    expect(auditMaintenancePrices({ prices, ...CONTEXT })).toEqual([]);
  });
});

describe("the amount charged at renewal", () => {
  /* The exact drift the superadmin console once shipped: 490 € against a real
     1 000 €. There it under-reported MRR; in Stripe it under-CHARGES. */
  it("flags a yearly Essentielle Price created at 490 €", () => {
    const [finding, ...rest] = audit("STRIPE_PRICE_ESSENTIELLE_YEARLY", {
      unitAmount: 49000,
    });
    expect(rest).toEqual([]);
    expect(finding.field).toBe("unit_amount");
    expect(finding.expected).toContain("1000.00");
    expect(finding.actual).toContain("490.00");
    expect(finding.message).toContain("planPrices");
  });

  it("names the plan and period that disagree", () => {
    const [finding] = audit("STRIPE_PRICE_PREMIUM_MONTHLY", { unitAmount: 1 });
    expect(finding.message).toContain("premium");
    expect(finding.message).toContain("maintenanceMonthly");
  });

  it("flags a tiered Price, which cannot be compared at all", () => {
    const [finding] = audit("STRIPE_PRICE_PREMIUM_YEARLY", { unitAmount: null });
    expect(finding.field).toBe("unit_amount");
    expect(finding.actual).toContain("paliers");
  });

  it("accepts the exact amount and nothing else", () => {
    const expected = expectedFor("STRIPE_PRICE_PREMIUM_YEARLY");
    expect(fields("STRIPE_PRICE_PREMIUM_YEARLY", { unitAmount: expected.unitAmount })).toEqual([]);
    expect(fields("STRIPE_PRICE_PREMIUM_YEARLY", { unitAmount: expected.unitAmount - 1 })).toContain(
      "unit_amount",
    );
  });
});

describe("currency and tax behaviour", () => {
  it("flags a Price billed in the wrong currency", () => {
    const [finding] = audit("STRIPE_PRICE_ESSENTIELLE_MONTHLY", { currency: "usd" });
    expect(finding.field).toBe("currency");
    expect(finding.actual).toBe("usd");
  });

  /* The company is on the régime réel. An inclusive Price takes the VAT out of
     the amount instead of adding it: 100 € HT invoiced as 83,33 € + 16,67 €. */
  it.each(["inclusive", "unspecified", null])(
    "flags tax_behavior=%s, which under-bills the VAT",
    (taxBehavior) => {
      const [finding] = audit("STRIPE_PRICE_ESSENTIELLE_MONTHLY", { taxBehavior });
      expect(finding.field).toBe("tax_behavior");
      expect(finding.message).toContain("TVA");
    },
  );
});

describe("the billing period", () => {
  it("flags a yearly variable pointing at a monthly Price", () => {
    const [finding] = audit("STRIPE_PRICE_ESSENTIELLE_YEARLY", {
      recurringInterval: "month",
    });
    expect(finding.field).toBe("recurring.interval");
    expect(finding.expected).toBe("year");
  });

  it("flags a one-time Price, which cannot carry a subscription", () => {
    const [finding] = audit("STRIPE_PRICE_PREMIUM_MONTHLY", {
      recurringInterval: null,
    });
    expect(finding.field).toBe("recurring");
    expect(finding.message).toContain("subscriptions.create");
  });

  it("flags an interval_count that is not 1", () => {
    const [finding] = audit("STRIPE_PRICE_PREMIUM_MONTHLY", {
      recurringIntervalCount: 3,
    });
    expect(finding.field).toBe("recurring.interval_count");
  });
});

describe("the Price object itself", () => {
  it("flags an archived Price", () => {
    expect(fields("STRIPE_PRICE_PREMIUM_YEARLY", { active: false })).toContain("active");
  });

  /* The founders coupon is restricted (applies_to) to the creation Product. A
     maintenance Price hanging off that same Product is zeroed by it too — the
     build AND the first year of maintenance given away, silently. */
  it("flags a maintenance Price attached to the creation Product", () => {
    const [finding] = audit("STRIPE_PRICE_ESSENTIELLE_YEARLY", {
      productId: CREATION_PRODUCT,
    });
    expect(finding.field).toBe("product");
    expect(finding.message).toContain("applies_to");
  });

  it("says nothing about a Price on any other Product", () => {
    expect(fields("STRIPE_PRICE_ESSENTIELLE_YEARLY", { productId: "prod_autre" })).toEqual([]);
  });

  /* Fails at subscriptions.create — after the customer has been charged. */
  it("flags a test-mode Price under a live key", () => {
    const [finding] = audit("STRIPE_PRICE_PREMIUM_MONTHLY", { livemode: false });
    expect(finding.field).toBe("livemode");
  });

  it("flags a live Price under a test key", () => {
    const expected = expectedFor("STRIPE_PRICE_PREMIUM_MONTHLY");
    const findings = auditMaintenancePrice(expected, validFacts(expected, { livemode: true }), {
      ...CONTEXT,
      liveMode: false,
    });
    expect(findings.map((f) => f.field)).toEqual(["livemode"]);
  });

  it("flags an id that matches no Price under the key in force", () => {
    const [finding] = auditMaintenancePrice(
      expectedFor("STRIPE_PRICE_ESSENTIELLE_MONTHLY"),
      null,
      CONTEXT,
    );
    expect(finding.field).toBe("existence");
    expect(finding.message).toContain("APRÈS");
  });
});

describe("reporting several faults at once", () => {
  it("does not stop at the first", () => {
    const found = fields("STRIPE_PRICE_ESSENTIELLE_YEARLY", {
      unitAmount: 1,
      currency: "usd",
      taxBehavior: "inclusive",
      active: false,
    });
    expect(found.sort()).toEqual(["active", "currency", "tax_behavior", "unit_amount"]);
  });

  it("names the variable and the Price id on every finding", () => {
    for (const f of audit("STRIPE_PRICE_ESSENTIELLE_YEARLY", { unitAmount: 1, currency: "usd" })) {
      expect(f.envName).toBe("STRIPE_PRICE_ESSENTIELLE_YEARLY");
      expect(f.priceId).toBe("price_essentielle_yearly");
    }
  });
});

describe("variables that are not configured", () => {
  /* Whether a variable is SET is validateSiteEnv's finding and
     resolveMaintenancePriceId's error. Saying it a third time here helps
     nobody, and would bury the drift this audit exists to surface. */
  it("skips a variable absent from the fetched set", () => {
    expect(auditMaintenancePrices({ prices: {}, ...CONTEXT })).toEqual([]);
  });

  it("audits only what was fetched", () => {
    const envName = "STRIPE_PRICE_PREMIUM_YEARLY";
    const findings = auditMaintenancePrices({
      prices: { [envName]: validFacts(expectedFor(envName), { unitAmount: 1 }) },
      ...CONTEXT,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].envName).toBe(envName);
  });
});
