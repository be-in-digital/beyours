import { describe, it, expect } from "vitest";
import { validateSiteEnv, formatSiteEnvReport } from "../lib/env";
import { resolveTvaEnabled, TVA_ENABLED } from "../lib/payment-providers";
import { VAT } from "../lib/legal/company";
import { foundersOffer } from "../convex/foundersOffer";
import {
  CREATION_PRODUCT_ENV,
  MAINTENANCE_PRICE_ENV,
} from "../convex/stripePriceAudit";
import {
  SIGNER_IP_SECRET_ENV,
  SIGNER_IP_SECRET_MIN_LENGTH,
} from "../lib/security/signer-attestation";

/** What the regime in force requires of both charging flags. */
const CHARGING = String(VAT.regime === "reel");
const NOT_CHARGING = String(VAT.regime !== "reel");

/** The minimum the Next server needs to serve a correct page.
 *
 *  The charging flag is part of that minimum and used not to be. It decides
 *  the total the checkout summary prints, it is frozen into the client bundle
 *  at build time, and absent it read as "quote no VAT" — so a fixture without
 *  it described a deployment that shows the wrong price, not a valid one. */
const VALID = {
  NEXT_PUBLIC_CONVEX_URL: "https://fearless-poodle-133.convex.cloud",
  NEXT_PUBLIC_SITE_URL: "https://beyours.fr",
  NEXT_PUBLIC_TVA_ENABLED: CHARGING,
};

describe("validateSiteEnv — required", () => {
  it("accepts the minimum viable env", () => {
    expect(validateSiteEnv(VALID).ok).toBe(true);
  });

  // The gap issue #156 reports: apps/site had no instrumentation at all, so
  // beyours.fr booted with nothing checked.
  //
  // This case used to assert that an empty env produces EXACTLY the two
  // required URLs, and passed — which is how it blessed the defect it was
  // meant to catch. An empty env is a fresh Vercel project, the state where
  // the charging flag is missing and the checkout quotes a total 20 % below
  // the one Stripe debits. The third name is the point of the assertion now.
  it("refuses an empty env and names the charging flag with the two URLs", () => {
    const { ok, problems } = validateSiteEnv({});
    expect(ok).toBe(false);
    expect(problems.map((p) => p.name).sort()).toEqual([
      "NEXT_PUBLIC_CONVEX_URL",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_TVA_ENABLED",
    ]);
    expect(
      problems.filter((p) => p.name.endsWith("_URL")).every((p) => p.tier === "required")
    ).toBe(true);
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
    expect(problems[0]!.message).toContain("placeholder");
  });

  it("rejects a non-absolute URL", () => {
    const { ok, problems } = validateSiteEnv({ ...VALID, NEXT_PUBLIC_SITE_URL: "beyours.fr" });
    expect(ok).toBe(false);
    expect(problems[0]!.message).toContain("URL absolue");
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
        CONTACT_EMAIL: "contact@be-yours.fr",
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
  // is normal and must not be reported. Its absence is not unguarded — the
  // checkout measures it against the same regime (tests/convex/vatGuard).
  it("stays quiet when only the client-side TVA flag is visible", () => {
    expect(validateSiteEnv({ ...VALID, NEXT_PUBLIC_TVA_ENABLED: CHARGING }).ok).toBe(true);
  });

  /* ── The state that actually occurs ──
     The regime cross-check used to skip any flag that was not set, so it
     refused a flag set to the WRONG value and never a forgotten one. Forgotten
     is the default state of a fresh Vercel project, and the two are not
     symmetric: this function holds the Next env, so it is the only thing that
     can see NEXT_PUBLIC_TVA_ENABLED go missing at all. Measured before the
     fix: no flags at all -> ok = true, problems = []. */

  it("refuses a deployment that never set the client-side charging flag", () => {
    const { ok, problems } = validateSiteEnv({
      NEXT_PUBLIC_CONVEX_URL: VALID.NEXT_PUBLIC_CONVEX_URL,
      NEXT_PUBLIC_SITE_URL: VALID.NEXT_PUBLIC_SITE_URL,
    });
    expect(ok).toBe(false);
    expect(problems.map((p) => p.name)).toContain("NEXT_PUBLIC_TVA_ENABLED");
  });

  it("says the flag is missing rather than that it holds a wrong value", () => {
    const { problems } = validateSiteEnv({
      NEXT_PUBLIC_CONVEX_URL: VALID.NEXT_PUBLIC_CONVEX_URL,
      NEXT_PUBLIC_SITE_URL: VALID.NEXT_PUBLIC_SITE_URL,
    });
    const message = problems.find((p) => p.name === "NEXT_PUBLIC_TVA_ENABLED")?.message;
    expect(message).toContain("non définie");
    expect(message).toContain(CHARGING);
  });

  it("treats an empty string as missing, not as a declared value", () => {
    const { ok, problems } = validateSiteEnv({ ...VALID, NEXT_PUBLIC_TVA_ENABLED: "" });
    expect(ok).toBe(false);
    expect(
      problems.find((p) => p.name === "NEXT_PUBLIC_TVA_ENABLED")?.message
    ).toContain("non définie");
  });

  // The asymmetry, stated as an assertion so it cannot be flattened back into
  // one loop: the Convex-side flag is invisible here and its absence is not a
  // problem; the Next-side flag is visible here and its absence is.
  it("demands the Next-side flag and not the Convex-side one", () => {
    const names = validateSiteEnv({
      NEXT_PUBLIC_CONVEX_URL: VALID.NEXT_PUBLIC_CONVEX_URL,
      NEXT_PUBLIC_SITE_URL: VALID.NEXT_PUBLIC_SITE_URL,
    }).problems.map((p) => p.name);
    expect(names).toContain("NEXT_PUBLIC_TVA_ENABLED");
    expect(names).not.toContain("STRIPE_TAX_ENABLED");
  });
});

/* ── The read site ──
   The guard above reports the missing flag; this is what the storefront does
   with it in the meantime. `process.env.X === "true"` mapped unset to `false`
   and `false` to "quote no VAT", so the two states the operator most needs
   told apart were indistinguishable. */

describe("resolveTvaEnabled — what an unset flag resolves to", () => {
  it("honours both declared values", () => {
    expect(resolveTvaEnabled("true")).toBe(true);
    expect(resolveTvaEnabled("false")).toBe(false);
  });

  it("falls back to the declared regime rather than to 'no VAT'", () => {
    expect(resolveTvaEnabled(undefined)).toBe(VAT.regime === "reel");
  });

  it("treats a typo like a missing value, not like 'false'", () => {
    for (const junk of ["TRUE", "True", "1", "oui", "", " true "]) {
      expect(resolveTvaEnabled(junk)).toBe(VAT.regime === "reel");
    }
  });

  // What the bundle actually shipped with: the module-level constant the
  // checkout summary branches on.
  //
  // Checked against a rule written out here rather than against
  // `resolveTvaEnabled(process.env…)`. That was the first version and it pinned
  // nothing: both sides call the same function on the same value in the same
  // process, so `f(x) === f(x)` holds even if the module read a different
  // variable entirely. Restating the rule independently is what makes the
  // assertion capable of failing — and it holds whatever the machine running
  // the suite happens to export, which asserting a bare `undefined` would not.
  it("carries the declared value, or the regime's stance when there is none", () => {
    const raw = process.env.NEXT_PUBLIC_TVA_ENABLED;
    const expected =
      raw === "true" ? true : raw === "false" ? false : VAT.regime === "reel";
    expect(TVA_ENABLED).toBe(expected);
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

describe("validateSiteEnv — one variable, one problem", () => {
  /* STRIPE_PRODUCT_CREATION_ESSENTIELLE belongs to both the founders group and
     the creation-products group. It was reported once per group: one variable
     to set, printed twice and counted as two, sending the operator looking for
     a second thing that did not exist. */
  it("reports a variable shared by two groups only once", () => {
    const { problems } = validateSiteEnv({
      ...VALID,
      STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS10",
      STRIPE_PRODUCT_CREATION_PREMIUM: "prod_premium",
    });
    expect(problems.map((p) => p.name)).toEqual([
      "STRIPE_PRODUCT_CREATION_ESSENTIELLE",
    ]);
  });

  it("attributes it to the most blocking group that wants it", () => {
    const { problems } = validateSiteEnv({
      ...VALID,
      STRIPE_FOUNDERS_COUPON_ID: "FONDATEURS10",
      STRIPE_PRODUCT_CREATION_PREMIUM: "prod_premium",
    });
    expect(problems[0]!.message).toContain("Offre fondateurs");
  });
});

/* lib/env.ts keeps its own list of these names — it is deliberately
   dependency-free and does not import the Convex maps. These pin the two
   together: a variable renamed in convex/stripePriceAudit.ts and not here
   would otherwise leave the boot check silently guarding a name nothing reads. */
describe("validateSiteEnv knows every variable the Convex maps name", () => {
  it.each(Object.values(CREATION_PRODUCT_ENV))("guards %s", (name) => {
    const { problems } = validateSiteEnv({ ...VALID, STRIPE_FOUNDERS_COUPON_ID: "F" });
    const known = problems.some((p) => p.name === name);
    const setAlone = validateSiteEnv({ ...VALID, [name]: "prod_x" });
    expect(known || !setAlone.ok).toBe(true);
  });

  it.each(Object.values(MAINTENANCE_PRICE_ENV))("guards %s", (name) => {
    const { ok, problems } = validateSiteEnv({ ...VALID, [name]: "price_x" });
    expect(ok).toBe(false);
    expect(problems.some((p) => p.tier === "feature")).toBe(true);
  });
});

/* The one secret shared between THIS server and the Convex deployment. A
   Convex action cannot see the request's IP, so the affiliate signature's
   « Adresse IP » row is observed by /api/signer-ip and HMAC'd with this;
   convex/affiliateSignature.ts verifies it before recording anything. Same
   pinning as the Stripe ids above: lib/env.ts holds the name as a literal so it
   stays dependency-free, and this keeps the two from drifting apart. */
describe("validateSiteEnv guards the signer-IP secret", () => {
  it("knows it by the name the code reads", () => {
    const short = "x".repeat(SIGNER_IP_SECRET_MIN_LENGTH - 1);
    const { ok, problems } = validateSiteEnv({
      ...VALID,
      [SIGNER_IP_SECRET_ENV]: short,
    });
    expect(ok).toBe(false);
    expect(problems.map((p) => p.name)).toEqual([SIGNER_IP_SECRET_ENV]);
    expect(problems[0]!.tier).toBe("format");
  });

  it("accepts one long enough to be a secret", () => {
    expect(
      validateSiteEnv({
        ...VALID,
        [SIGNER_IP_SECRET_ENV]: "s".repeat(SIGNER_IP_SECRET_MIN_LENGTH),
      }).ok,
    ).toBe(true);
  });

  it("is optional — a deployment without it still boots", () => {
    // Unset, the signature is recorded with no address rather than an
    // unverified one. That is a thinner audit trail, not a broken deployment.
    expect(validateSiteEnv(VALID).ok).toBe(true);
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
