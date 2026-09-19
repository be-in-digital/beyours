import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { foundersOffer } from "../../convex/foundersOffer";
import { planPrices } from "../../convex/planPrices";
import { toCouponFacts } from "../../convex/stripeAudit";
import {
  EXPECTED_FOUNDERS_COUPON,
  auditFoundersCoupon,
  replacementMaxRedemptions,
  resolveAuditVerdict,
  summariseCouponFindings,
  type CouponFinding,
  type StripeCouponFacts,
} from "../../convex/stripeCouponAudit";

/* The gap this closes, measured rather than assumed: `percent_off` was read by
   NOTHING. Not stripeAudit:run, which audited the four Prices and skipped the
   coupon by design (runbook §7); not stripe-founders-launch.sh, whose coupon
   section checks max_redemptions, times_redeemed and applies_to and whose only
   mention of percent_off is a comment. A founders coupon created at 50 %
   passed both, and the founder was invoiced 1 750 € HT for a build the sales
   page gives away. */

const CREATION_PRODUCT = "prod_creation_essentielle";

const CONTEXT = { creationProductId: CREATION_PRODUCT, liveMode: true };

/** A coupon that is correct in every respect — the baseline each case breaks. */
function validFacts(over: Partial<StripeCouponFacts> = {}): StripeCouponFacts {
  return {
    id: "beyours-founders-creation",
    valid: true,
    percentOff: 100,
    amountOff: null,
    currency: null,
    duration: "once",
    maxRedemptions: foundersOffer.totalSlots,
    timesRedeemed: 0,
    redeemBy: null,
    /* Restricted, and the API says so. Not the live shape — see the
       applies_to block below, which is about the shape Stripe really returns. */
    appliesToProducts: [CREATION_PRODUCT],
    livemode: true,
    ...over,
  };
}

const audit = (over: Partial<StripeCouponFacts> = {}) =>
  auditFoundersCoupon(validFacts(over), CONTEXT);

const fields = (over: Partial<StripeCouponFacts> = {}) =>
  audit(over).map((f) => f.field);

const find = (findings: CouponFinding[], field: string): CouponFinding => {
  const found = findings.find((f) => f.field === field);
  if (!found) throw new Error(`no finding on '${field}' in [${findings.map((f) => f.field)}]`);
  return found;
};

describe("what the founders coupon must be", () => {
  it("derives its expectation from foundersOffer, not from a second copy", () => {
    expect(EXPECTED_FOUNDERS_COUPON.maxRedemptions).toBe(foundersOffer.totalSlots);
    expect(EXPECTED_FOUNDERS_COUPON.amountOffCents).toBe(
      planPrices[foundersOffer.plan].creation,
    );
  });

  /* The offer gives the build away outright. If creationCents ever stops being
     0, a 100 % coupon is no longer the right expectation and this file has to
     be revisited rather than quietly kept. */
  it("expects a total discount because the offer charges nothing for creation", () => {
    expect(foundersOffer.creationCents).toBe(0);
    expect(EXPECTED_FOUNDERS_COUPON.percentOff).toBe(100);
  });

  it("passes a coupon that matches on every field", () => {
    expect(audit()).toEqual([]);
  });
});

describe("the discount itself — the field nothing read", () => {
  it("catches a coupon that does not zero the creation line", () => {
    const finding = find(audit({ percentOff: 50 }), "percent_off");
    expect(finding.severity).toBe("blocking");
    /* Half of 3 500 € — the sum the founder would actually be invoiced. */
    expect(finding.message).toContain("1750.00 €");
  });

  it("names the remainder left by a short amount_off", () => {
    const finding = find(
      audit({ percentOff: null, amountOff: 300000, currency: "eur" }),
      "amount_off",
    );
    expect(finding.severity).toBe("blocking");
    expect(finding.message).toContain("500.00 €");
  });

  it("catches an amount_off that overflows onto the maintenance line", () => {
    const finding = find(
      audit({ percentOff: null, amountOff: 400000, currency: "eur" }),
      "amount_off",
    );
    expect(finding.severity).toBe("blocking");
    expect(finding.message).toContain("maintenance");
  });

  /* §3 allows amount_off. It is correct today and pins a copy of
     planPrices.essentielle.creation inside Stripe, where nothing follows it —
     so it is reported as fragile, never as broken. */
  it("accepts a correct amount_off but warns that it is a frozen copy", () => {
    const findings = auditFoundersCoupon(
      validFacts({
        percentOff: null,
        amountOff: planPrices[foundersOffer.plan].creation,
        currency: "eur",
      }),
      CONTEXT,
    );
    const finding = find(findings, "amount_off");
    expect(finding.severity).toBe("warning");
    expect(summariseCouponFindings(findings).blocking).toBe(0);
  });

  it("catches an amount_off in the wrong currency", () => {
    expect(
      fields({
        percentOff: null,
        amountOff: planPrices[foundersOffer.plan].creation,
        currency: "usd",
      }),
    ).toContain("currency");
  });

  it("catches a coupon carrying no discount at all", () => {
    expect(fields({ percentOff: null, amountOff: null })).toContain("discount");
  });
});

describe("the cap", () => {
  it("treats an absent max_redemptions as uncapped, not as a default", () => {
    const finding = find(audit({ maxRedemptions: null }), "max_redemptions");
    expect(finding.severity).toBe("blocking");
    expect(finding.actual).toBe("illimité");
  });

  it("prices the overshoot when the cap is too wide", () => {
    const finding = find(audit({ maxRedemptions: 12 }), "max_redemptions");
    /* Two extra builds at 3 500 € HT. */
    expect(finding.message).toContain("7000.00 €");
  });

  it("says what a cap that is too tight costs — a refusal after the checkout", () => {
    const finding = find(audit({ maxRedemptions: 8 }), "max_redemptions");
    expect(finding.message).toContain("refusées");
  });

  it("reports seats already spent without calling them a fault", () => {
    const finding = find(audit({ timesRedeemed: 4 }), "times_redeemed");
    expect(finding.severity).toBe("warning");
    expect(finding.message).toContain("il en reste 6");
  });

  it("subtracts from the REAL cap, not the expected one", () => {
    expect(
      find(audit({ maxRedemptions: 25, timesRedeemed: 4 }), "times_redeemed")
        .message,
    ).toContain("il en reste 21");
  });

  /* An uncapped coupon has no cap to subtract from. Substituting the expected
     one would quote a remaining-seat figure for an offer Stripe is not
     limiting at all — the opposite of what the operator must act on. */
  it("invents no seat count when the coupon is uncapped", () => {
    const finding = find(
      audit({ maxRedemptions: null, timesRedeemed: 4 }),
      "times_redeemed",
    );
    expect(finding.message).not.toMatch(/il en reste/);
    expect(finding.message).toContain("aucun plafond");
  });
});

/* ── The trap this module exists to keep an operator out of ──
   A Stripe coupon is immutable but for name and metadata, so every repair is
   delete-then-recreate — and recreating resets times_redeemed to 0. Rebuilding
   at foundersOffer.totalSlots after four redemptions hands out FOURTEEN free
   builds, not ten: 14 000 € HT given away by an operation that reads like a
   typo fix. */
describe("recreating the coupon without giving away extra builds", () => {
  it("carries the remainder, never the full cap", () => {
    expect(replacementMaxRedemptions(0)).toBe(foundersOffer.totalSlots);
    expect(replacementMaxRedemptions(4)).toBe(foundersOffer.totalSlots - 4);
  });

  it("never goes negative on a coupon redeemed past its cap", () => {
    expect(replacementMaxRedemptions(foundersOffer.totalSlots + 3)).toBe(0);
  });

  it("puts the arithmetic in the remedy of every finding that needs a rebuild", () => {
    const finding = find(audit({ percentOff: 50, timesRedeemed: 4 }), "percent_off");
    expect(finding.remedy).toContain(`max_redemptions=${foundersOffer.totalSlots - 4}`);
    expect(finding.remedy).toContain("gratuitement");
  });

  it("states the cap plainly when nothing has been redeemed", () => {
    expect(find(audit({ percentOff: 50 }), "percent_off").remedy).toContain(
      `max_redemptions=${foundersOffer.totalSlots}`,
    );
  });
});

describe("the rest of the coupon", () => {
  it("catches a coupon Stripe already considers spent", () => {
    expect(find(audit({ valid: false }), "valid").severity).toBe("blocking");
  });

  it("catches a duration that can follow onto the renewals", () => {
    const finding = find(audit({ duration: "forever" }), "duration");
    expect(finding.severity).toBe("blocking");
    expect(finding.message).toContain("maintenance");
  });

  /* "It ends when the slots run out, never on a date" — foundersOffer.ts:5. */
  it("catches an expiry date the offer never had", () => {
    const finding = find(audit({ redeemBy: 1789545600 }), "redeem_by");
    expect(finding.severity).toBe("blocking");
    expect(finding.actual).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("catches a test-mode coupon under a live key", () => {
    expect(fields({ livemode: false })).toContain("livemode");
  });

  it("reports a coupon that does not exist rather than assuming it is fine", () => {
    const findings = auditFoundersCoupon(null, CONTEXT);
    expect(findings).toHaveLength(1);
    expect(findings[0].field).toBe("existence");
    expect(findings[0].severity).toBe("blocking");
  });
});

/* ── applies_to: report, never accuse ──
   Stripe accepts the field on create, validates it, and never returns it. An
   earlier version of the create wizard failed the run on its absence — which
   is always — and two correctly restricted coupons were deleted and rebuilt on
   its word. `null` (the API said nothing) and `[]` (the API said none) must
   therefore never be collapsed. */
describe("applies_to, which the API does not hand back", () => {
  it("reports an unreadable restriction as unverifiable, not as a failure", () => {
    const findings = audit({ appliesToProducts: null });
    const finding = find(findings, "applies_to");
    expect(finding.severity).toBe("unverifiable");
    expect(summariseCouponFindings(findings).blocking).toBe(0);
    /* An unverifiable finding must hand over somewhere to look. */
    expect(finding.remedy).toContain("dashboard.stripe.com");
    expect(finding.remedy).toContain(CREATION_PRODUCT);
  });

  it("points at the test Dashboard when the key is a test key", () => {
    const findings = auditFoundersCoupon(validFacts({ appliesToProducts: null }), {
      creationProductId: CREATION_PRODUCT,
      liveMode: false,
    });
    expect(find(findings, "applies_to").remedy).toContain("/test/coupons/");
  });

  it("accuses an EMPTY restriction, which is unambiguous", () => {
    const finding = find(audit({ appliesToProducts: [] }), "applies_to");
    expect(finding.severity).toBe("blocking");
    /* The failure mode that no total-based check can see. */
    expect(finding.message).toContain("prorata");
  });

  it("accuses a restriction that names the wrong product", () => {
    expect(
      find(audit({ appliesToProducts: ["prod_creation_premium"] }), "applies_to")
        .severity,
    ).toBe("blocking");
  });

  it("says the check did not run when no creation product is configured", () => {
    const findings = auditFoundersCoupon(validFacts({ appliesToProducts: null }), {
      creationProductId: null,
      liveMode: true,
    });
    const finding = find(findings, "coverage");
    expect(finding.severity).toBe("unverifiable");
    expect(finding.message).toContain("pas un succès");
  });
});

/* ── The gate has to be able to open ──
   Its first form counted an unverifiable finding as not-ok. Stripe never
   returns applies_to, so that made `ok` false on every correctly configured
   account, whatever an operator fixed — a gate that never opens is read once
   and then ignored, the same failure as one that never closes, reached from
   the other side. */
describe("resolveAuditVerdict", () => {
  const unreadableAppliesTo = audit({ appliesToProducts: null });

  it("opens on a correct account even though applies_to is never readable", () => {
    const verdict = resolveAuditVerdict({
      priceFindingCount: 0,
      couponChecked: true,
      couponFindings: unreadableAppliesTo,
    });
    expect(verdict.ok).toBe(true);
    /* …and says, in the same breath, what it could not check. */
    expect(verdict.unverified).toEqual(["applies_to"]);
  });

  it("stays shut on a blocking coupon finding", () => {
    expect(
      resolveAuditVerdict({
        priceFindingCount: 0,
        couponChecked: true,
        couponFindings: audit({ percentOff: 50 }),
      }).ok,
    ).toBe(false);
  });

  it("stays shut on a Price finding, whatever the coupon says", () => {
    expect(
      resolveAuditVerdict({
        priceFindingCount: 1,
        couponChecked: true,
        couponFindings: [],
      }).ok,
    ).toBe(false);
  });

  /* An unset STRIPE_FOUNDERS_COUPON_ID is not a pass: it is the variable whose
     absence makes resolveFoundersPricing refuse every Essentielle sale. */
  it("stays shut when the coupon was never checked at all", () => {
    expect(
      resolveAuditVerdict({
        priceFindingCount: 0,
        couponChecked: false,
        couponFindings: [],
      }).ok,
    ).toBe(false);
  });

  it("does not let a warning hold the gate shut", () => {
    const verdict = resolveAuditVerdict({
      priceFindingCount: 0,
      couponChecked: true,
      couponFindings: audit({ timesRedeemed: 4 }),
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.unverified).toEqual([]);
  });
});

describe("summarising", () => {
  it("calls a clean coupon clean", () => {
    expect(summariseCouponFindings([])).toMatchObject({
      blocking: 0,
      warnings: 0,
      unverifiable: 0,
    });
    expect(summariseCouponFindings([]).summary).toContain("conforme");
  });

  it("counts each severity separately", () => {
    const findings = audit({
      percentOff: 50,
      timesRedeemed: 2,
      appliesToProducts: null,
    });
    expect(summariseCouponFindings(findings)).toMatchObject({
      blocking: 1,
      warnings: 1,
      unverifiable: 1,
    });
  });
});

/* toCouponFacts decides which Stripe field each rule reads — the place where a
   wrong field name reads a broken coupon as a correct one, and nothing
   downstream could tell. Same reasoning as toFacts for the Prices. */
describe("toCouponFacts", () => {
  const stripeCoupon = (over: Partial<Stripe.Coupon> = {}): Stripe.Coupon =>
    ({
      id: "beyours-founders-creation",
      object: "coupon",
      amount_off: null,
      applies_to: { products: [CREATION_PRODUCT] },
      created: 1_757_000_000,
      currency: null,
      duration: "once",
      livemode: true,
      max_redemptions: 10,
      metadata: {},
      name: "Offre fondateurs",
      percent_off: 100,
      redeem_by: null,
      times_redeemed: 0,
      valid: true,
      ...over,
    }) as Stripe.Coupon;

  it("reads each field the audit rules depend on", () => {
    expect(toCouponFacts(stripeCoupon())).toEqual({
      id: "beyours-founders-creation",
      valid: true,
      percentOff: 100,
      amountOff: null,
      currency: null,
      duration: "once",
      maxRedemptions: 10,
      timesRedeemed: 0,
      redeemBy: null,
      appliesToProducts: [CREATION_PRODUCT],
      livemode: true,
    });
  });

  /* The distinction the whole applies_to policy rests on. An absent field must
     arrive as null (unreadable); a present-but-empty one as [] (unrestricted).
     Collapsing them is how a correct coupon gets deleted. */
  it("keeps an absent applies_to as null, not as an empty restriction", () => {
    const facts = toCouponFacts(stripeCoupon({ applies_to: undefined }));
    expect(facts.appliesToProducts).toBeNull();
    expect(auditFoundersCoupon(facts, CONTEXT).map((f) => f.severity)).toEqual([
      "unverifiable",
    ]);
  });

  it("keeps an empty applies_to as an empty array, not as null", () => {
    const facts = toCouponFacts(stripeCoupon({ applies_to: { products: [] } }));
    expect(facts.appliesToProducts).toEqual([]);
  });

  /* 0 % and 0 cents are real values Stripe can return, and `||` would turn
     either into null — reading a coupon that discounts NOTHING as one whose
     discount is simply expressed the other way, and passing it. */
  it("does not mistake a zero discount for an absent one", () => {
    expect(toCouponFacts(stripeCoupon({ percent_off: 0 })).percentOff).toBe(0);
    expect(
      toCouponFacts(stripeCoupon({ percent_off: null, amount_off: 0 })).amountOff,
    ).toBe(0);
  });

  it("keeps an uncapped coupon's null rather than coercing it to a number", () => {
    expect(toCouponFacts(stripeCoupon({ max_redemptions: null })).maxRedemptions)
      .toBeNull();
  });
});
