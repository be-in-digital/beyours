import { describe, it, expect } from "vitest";
import { validateSiteEnv, formatSiteEnvReport } from "../lib/env";
import { VAT } from "../lib/legal/company";
import { foundersOffer } from "../convex/foundersOffer";

/** What the regime in force requires of both charging flags. */
const CHARGING = String(VAT.regime === "reel");
const NOT_CHARGING = String(VAT.regime !== "reel");

/** The minimum the Next server needs to serve a correct page. */
const VALID = {
  NEXT_PUBLIC_CONVEX_URL: "https://fearless-poodle-133.convex.cloud",
  NEXT_PUBLIC_SITE_URL: "https://beyours.fr",
};

describe("validateSiteEnv — required", () => {
  it("accepts the minimum viable env", () => {
    expect(validateSiteEnv(VALID).ok).toBe(true);
  });

  // The gap issue #156 reports: apps/site had no instrumentation at all, so
  // beyours.fr booted with nothing checked.
  it("refuses an empty env and names both variables", () => {
    const { ok, problems } = validateSiteEnv({});
    expect(ok).toBe(false);
    expect(problems.map((p) => p.name).sort()).toEqual([
      "NEXT_PUBLIC_CONVEX_URL",
      "NEXT_PUBLIC_SITE_URL",
    ]);
    expect(problems.every((p) => p.tier === "required")).toBe(true);
  });

  it("treats an empty string as unset", () => {
    const { ok, problems } = validateSiteEnv({ ...VALID, NEXT_PUBLIC_SITE_URL: "" });
    expect(ok).toBe(false);
    expect(problems[0]).toMatchObject({
      name: "NEXT_PUBLIC_SITE_URL",
      message: "non définie",
    });
  });

  // components/convex-provider.tsx falls back to this literal, which is how a
  // misconfigured deploy serves a site whose every query goes nowhere.
  it("rejects the placeholder Convex URL", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      NEXT_PUBLIC_CONVEX_URL: "https://placeholder.convex.cloud",
    });
    expect(ok).toBe(false);
    expect(problems[0].message).toContain("placeholder");
  });

  it("rejects a non-absolute URL", () => {
    const { ok, problems } = validateSiteEnv({ ...VALID, NEXT_PUBLIC_SITE_URL: "beyours.fr" });
    expect(ok).toBe(false);
    expect(problems[0].message).toContain("URL absolue");
  });
});

describe("validateSiteEnv — format of Convex-side vars", () => {
  it("ignores variables that are absent, since they live on Convex", () => {
    expect(validateSiteEnv(VALID).ok).toBe(true);
  });

  it.each([
    ["STRIPE_SECRET_KEY", "pk_live_oops", 'doit commencer par "sk_"'],
    ["STRIPE_WEBHOOK_SECRET", "secret", 'doit commencer par "whsec_"'],
    ["CONTACT_EMAIL", "contact-at-beyours", "adresse e-mail"],
    ["BOOKING_URL", "bookself.app/beyours", "URL absolue"],
    ["NEXT_PUBLIC_TVA_ENABLED", "oui", '"true" ou "false"'],
    ["EMAIL_PROVIDER", "sendgrid", '"ses" ou "resend"'],
  ])("rejects a malformed %s", (name, value, expected) => {
    const { ok, problems } = validateSiteEnv({ ...VALID, [name]: value });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === name)?.message).toContain(expected);
    expect(problems.find((p) => p.name === name)?.tier).toBe("format");
  });

  it("accepts well-formed optional values", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        CONVEX_SITE_URL: "https://fearless-poodle-133.convex.site",
        SITE_URL: "https://beyours.fr",
        STRIPE_SECRET_KEY: "sk_test_1",
        STRIPE_WEBHOOK_SECRET: "whsec_1",
        CONTACT_EMAIL: "contact@beyours.fr",
        BOOKING_URL: "https://bookself.app/beyours/lancement",
        // Well-formed AND consistent with the declared regime — this case is
        // about the format checks, and the regime cross-check would otherwise
        // fire on an unrelated assertion.
        NEXT_PUBLIC_TVA_ENABLED: CHARGING,
        STRIPE_TAX_ENABLED: CHARGING,
      }).ok
    ).toBe(true);
  });
});

describe("validateSiteEnv — feature groups", () => {
  it("rejects a Stripe secret key with no webhook secret", () => {
    const { ok, problems } = validateSiteEnv({ ...VALID, STRIPE_SECRET_KEY: "sk_test_1" });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === "STRIPE_WEBHOOK_SECRET")?.tier).toBe("feature");
  });

  // convex/stripe.ts throws mid-checkout on a missing price: the customer is
  // debited and never provisioned.
  it("rejects three of the four maintenance prices", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      STRIPE_PRICE_ESSENTIELLE_MONTHLY: "price_1",
      STRIPE_PRICE_ESSENTIELLE_YEARLY: "price_2",
      STRIPE_PRICE_PREMIUM_MONTHLY: "price_3",
    });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === "STRIPE_PRICE_PREMIUM_YEARLY")?.tier).toBe(
      "feature"
    );
  });

  it("accepts all four maintenance prices", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        STRIPE_PRICE_ESSENTIELLE_MONTHLY: "price_1",
        STRIPE_PRICE_ESSENTIELLE_YEARLY: "price_2",
        STRIPE_PRICE_PREMIUM_MONTHLY: "price_3",
        STRIPE_PRICE_PREMIUM_YEARLY: "price_4",
      }).ok
    ).toBe(true);
  });

  it("rejects EMAIL_PROVIDER=resend with no API key", () => {
    const { ok, problems } = validateSiteEnv({ ...VALID, EMAIL_PROVIDER: "resend" });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === "RESEND_API_KEY")?.tier).toBe("feature");
  });

  it("rejects EMAIL_PROVIDER=ses with no AWS credentials", () => {
    const { problems } = validateSiteEnv({ ...VALID, EMAIL_PROVIDER: "ses" });
    expect(problems.map((p) => p.name)).toEqual([
      "AWS_REGION",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
    ]);
  });

  it("accepts EMAIL_PROVIDER=ses with credentials", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        EMAIL_PROVIDER: "ses",
        AWS_REGION: "eu-west-3",
        AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
        AWS_SECRET_ACCESS_KEY: "secret",
      }).ok
    ).toBe(true);
  });

  // Both flags are measured against VAT.regime, not against each other: a
  // deployment where they agree and are both wrong is exactly the state that
  // issues wrong invoices (#174).
  it("rejects a TVA flag that disagrees with the Stripe tax flag", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      NEXT_PUBLIC_TVA_ENABLED: CHARGING,
      STRIPE_TAX_ENABLED: NOT_CHARGING,
    });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === "STRIPE_TAX_ENABLED")?.message).toContain(
      "ensemble"
    );
  });

  // The replay: this is the shipped configuration issue #174 reports —
  // VAT.regime = "reel" while the charging flags say nothing is collected.
  // Both flags agreed with each other, so the old flag-versus-flag check
  // stayed silent and the deployment booted.
  it("refuses a deployment whose flags contradict the declared regime", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      NEXT_PUBLIC_TVA_ENABLED: NOT_CHARGING,
      STRIPE_TAX_ENABLED: NOT_CHARGING,
    });
    expect(ok).toBe(false);
    expect(problems.map((p) => p.name).sort()).toEqual([
      "NEXT_PUBLIC_TVA_ENABLED",
      "STRIPE_TAX_ENABLED",
    ]);
  });

  it("names the regime and the file that declares it", () => {
    const { problems } = validateSiteEnv({
      ...VALID,
      STRIPE_TAX_ENABLED: NOT_CHARGING,
    });
    const message = problems.find((p) => p.name === "STRIPE_TAX_ENABLED")?.message;
    expect(message).toContain("VAT.regime");
    expect(message).toContain("lib/legal/company.ts");
  });

  // The mirror. A check that refused every value would pass the three above.
  it("accepts flags that agree with the declared regime", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        NEXT_PUBLIC_TVA_ENABLED: CHARGING,
        STRIPE_TAX_ENABLED: CHARGING,
      }).ok
    ).toBe(true);
  });

  // In production STRIPE_TAX_ENABLED lives on Convex, so a one-sided Next env
  // is normal and must not be reported.
  it("stays quiet when only the client-side TVA flag is visible", () => {
    expect(validateSiteEnv({ ...VALID, NEXT_PUBLIC_TVA_ENABLED: CHARGING }).ok).toBe(true);
  });
});

/* ── The founders offer and the creation Products ──
   tasks/stripe-founders-offer-runbook.md §7: neither STRIPE_PRODUCT_CREATION_*
   appeared here, so a deployment holding half the founders pair passed
   validateSiteEnv and refused the first sale at checkout instead — in front of
   the customer, with FoundersOfferUnavailableError. */

/* Derived, so that moving the offer to another plan cannot silently leave this
   check guarding the old one. foundersOffer.plan is the offer's own truth. */
const FOUNDERS_PRODUCT = `STRIPE_PRODUCT_CREATION_${foundersOffer.plan.toUpperCase()}`;

describe("validateSiteEnv — offre fondateurs", () => {
  it("guards the product of the plan the offer actually applies to", () => {
    expect(FOUNDERS_PRODUCT).toBe("STRIPE_PRODUCT_CREATION_ESSENTIELLE");
  });

  // The reported gap, replayed: the coupon alone used to pass.
  it("refuses the coupon without the creation product it is restricted to", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS10",
    });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === FOUNDERS_PRODUCT)?.tier).toBe("feature");
  });

  it("refuses the creation product without the coupon that caps the offer", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      [FOUNDERS_PRODUCT]: "prod_essentielle",
    });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === "STRIPE_FOUNDERS_COUPON_ID")?.tier).toBe(
      "feature"
    );
  });

  it("names the feature so the operator knows which sale breaks", () => {
    const { problems } = validateSiteEnv({
      ...VALID,
      STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS10",
    });
    expect(problems.find((p) => p.name === FOUNDERS_PRODUCT)?.message).toContain(
      "Offre fondateurs"
    );
  });

  it("accepts the complete founders configuration", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS10",
        STRIPE_PRODUCT_CREATION_ESSENTIELLE: "prod_essentielle",
        STRIPE_PRODUCT_CREATION_PREMIUM: "prod_premium",
      }).ok
    ).toBe(true);
  });

  /* Not blocking on its own: the sale completes. It costs the split on the
     invoice — a discount with no product to point at spreads pro rata. */
  it("refuses one creation product without the other", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS10",
      STRIPE_PRODUCT_CREATION_ESSENTIELLE: "prod_essentielle",
    });
    expect(ok).toBe(false);
    expect(problems.map((p) => p.name)).toEqual(["STRIPE_PRODUCT_CREATION_PREMIUM"]);
  });

  it("stays quiet when the whole founders offer is unconfigured", () => {
    expect(validateSiteEnv(VALID).ok).toBe(true);
  });
});

describe("validateSiteEnv — Stripe object ids carry their type", () => {
  /* These vars sit next to each other in the runbook and in every
     `convex env set` run. Stripe accepts a Price id in a Product var right up
     to applies_to, which then matches nothing. */
  it.each([
    ["STRIPE_PRODUCT_CREATION_ESSENTIELLE", "price_1Nope", "prod_"],
    ["STRIPE_PRODUCT_CREATION_PREMIUM", "price_1Nope", "prod_"],
    ["STRIPE_PRICE_ESSENTIELLE_MONTHLY", "prod_1Nope", "price_"],
    ["STRIPE_PRICE_PREMIUM_YEARLY", "prod_1Nope", "price_"],
  ])("rejects %s = %s", (name, value, prefix) => {
    const { ok, problems } = validateSiteEnv({ ...VALID, [name]: value });
    expect(ok).toBe(false);
    const problem = problems.find((p) => p.name === name);
    expect(problem?.tier).toBe("format");
    expect(problem?.message).toContain(prefix);
  });

  /* A coupon id is whatever the account owner typed, so it must NOT be
     prefix-checked — the mirror that stops the rule above spreading. */
  it("accepts a coupon id in any shape", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS-10-2026",
        STRIPE_PRODUCT_CREATION_ESSENTIELLE: "prod_e",
        STRIPE_PRODUCT_CREATION_PREMIUM: "prod_p",
      }).ok
    ).toBe(true);
  });
});

describe("formatSiteEnvReport", () => {
  it("groups problems by tier and counts them", () => {
    const report = formatSiteEnvReport([
      { name: "NEXT_PUBLIC_SITE_URL", message: "non définie", tier: "required" },
      { name: "CONTACT_EMAIL", message: "doit être une adresse e-mail", tier: "format" },
      { name: "STRIPE_WEBHOOK_SECRET", message: "requise dès que Stripe…", tier: "feature" },
    ]);
    expect(report).toContain("Requises");
    expect(report).toContain("Format invalide");
    expect(report).toContain("à moitié");
    expect(report).toContain("3 variable(s)");
  });

  it("points at the right template and says where the secrets live", () => {
    const report = formatSiteEnvReport([
      { name: "NEXT_PUBLIC_SITE_URL", message: "non définie", tier: "required" },
    ]);
    expect(report).toContain(".env.example");
    expect(report).toContain("CONVEX");
  });
});
