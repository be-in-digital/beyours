import { describe, it, expect } from "vitest";
import { validateSiteEnv, formatSiteEnvReport } from "../lib/env";

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
        NEXT_PUBLIC_TVA_ENABLED: "false",
        STRIPE_TAX_ENABLED: "false",
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

  // .env.example: "On switching, set BOTH of these to true — they go together."
  it("rejects a TVA flag that disagrees with the Stripe tax flag", () => {
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      NEXT_PUBLIC_TVA_ENABLED: "true",
      STRIPE_TAX_ENABLED: "false",
    });
    expect(ok).toBe(false);
    expect(problems.find((p) => p.name === "STRIPE_TAX_ENABLED")?.message).toContain(
      "ensemble"
    );
  });

  // In production STRIPE_TAX_ENABLED lives on Convex, so a one-sided Next env
  // is normal and must not be reported.
  it("stays quiet when only the client-side TVA flag is visible", () => {
    expect(validateSiteEnv({ ...VALID, NEXT_PUBLIC_TVA_ENABLED: "true" }).ok).toBe(true);
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
