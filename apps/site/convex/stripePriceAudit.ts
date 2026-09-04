/* ── Maintenance Price audit ──

   Compares the four recurring Stripe Prices the renewal is billed on against
   `planPrices`, the single source of truth for what we charge.

   Why this exists: nothing did. A Price created in the dashboard at the wrong
   amount, in the wrong currency, on the wrong tax behaviour or against the
   wrong Product was undetectable from the repo — the first signal would have
   been a customer disputing a renewal invoice, a year after the sale. The four
   `STRIPE_PRICE_*` env vars are opaque ids: `resolveMaintenancePriceId`
   (convex/stripe.ts) checks that they are SET, never that they are RIGHT.

   Plain module on purpose — no "use node", no Stripe import, no Convex
   registration — so the whole decision is unit-testable without credentials.
   The action that talks to Stripe lives in convex/stripeAudit.ts and does
   nothing but fetch and hand the facts here. Same split as
   resolveFoundersPricing. */

import { planPrices, type PlanId } from "./planPrices";

export type BillingPeriod = "monthly" | "yearly";

/**
 * Which env var holds the persistent creation Product for a plan.
 *
 * The founders coupon is restricted to one of these with `applies_to`, and a
 * maintenance Price must never hang off one. Single definition, same reason as
 * MAINTENANCE_PRICE_ENV below.
 */
export const CREATION_PRODUCT_ENV: Record<string, string> = {
  essentielle: "STRIPE_PRODUCT_CREATION_ESSENTIELLE",
  premium: "STRIPE_PRODUCT_CREATION_PREMIUM",
} satisfies Record<PlanId, string>;

/**
 * Which env var holds the recurring Price for a `plan:period` pair.
 *
 * Defined here, in the module that has no dependencies, and imported by
 * convex/stripe.ts and convex/stripeAudit.ts — both of which are "use node".
 * One definition on purpose: a checkout reading one list while the audit that
 * blesses it reads another is the very drift this file exists to catch.
 */
export const MAINTENANCE_PRICE_ENV: Record<string, string> = {
  "essentielle:monthly": "STRIPE_PRICE_ESSENTIELLE_MONTHLY",
  "essentielle:yearly": "STRIPE_PRICE_ESSENTIELLE_YEARLY",
  "premium:monthly": "STRIPE_PRICE_PREMIUM_MONTHLY",
  "premium:yearly": "STRIPE_PRICE_PREMIUM_YEARLY",
};

/** What a maintenance Price must look like in Stripe for the sale to be right. */
export interface ExpectedPrice {
  envName: string;
  plan: PlanId;
  period: BillingPeriod;
  /** Cents, excluding tax — straight from planPrices. */
  unitAmount: number;
  currency: "eur";
  taxBehavior: "exclusive";
  interval: "month" | "year";
}

/** The subset of a Stripe Price this audit reads. */
export interface StripePriceFacts {
  id: string;
  active: boolean;
  currency: string;
  /** `null` on a tiered price, which cannot be checked against a flat amount. */
  unitAmount: number | null;
  taxBehavior: string | null;
  /** `null` on a one-time price — one that cannot carry a subscription. */
  recurringInterval: string | null;
  recurringIntervalCount?: number | null;
  productId: string;
  livemode: boolean;
}

/** One thing wrong with one Price, named so an operator can go and fix it. */
export interface PriceFinding {
  envName: string;
  priceId: string;
  field: string;
  expected: string;
  actual: string;
  message: string;
}

const PERIOD_INTERVAL: Record<BillingPeriod, "month" | "year"> = {
  monthly: "month",
  yearly: "year",
};

const MAINTENANCE_KEY: Record<BillingPeriod, "maintenanceMonthly" | "maintenanceYearly"> = {
  monthly: "maintenanceMonthly",
  yearly: "maintenanceYearly",
};

const PLANS: PlanId[] = ["essentielle", "premium"];
const PERIODS: BillingPeriod[] = ["monthly", "yearly"];

/**
 * The env var for a plan/period pair.
 *
 * The map is total over PlanId x BillingPeriod, so the throw is unreachable —
 * but it is a narrowing the compiler can follow rather than a cast, and if the
 * map ever loses an entry this fails at module load instead of producing an
 * expectation named `undefined` that would match no variable and audit nothing.
 */
function envNameFor(plan: PlanId, period: BillingPeriod): string {
  const envName = MAINTENANCE_PRICE_ENV[`${plan}:${period}`];
  if (!envName) {
    throw new Error(`MAINTENANCE_PRICE_ENV has no entry for ${plan}:${period}`);
  }
  return envName;
}

/**
 * What the four maintenance Prices must be, derived from `planPrices`.
 *
 * Derived, never written twice: an edit to planPrices.ts moves this with it,
 * which is the whole point — the drift this catches is Stripe drifting from
 * the repo, not the repo drifting from itself.
 */
export const EXPECTED_MAINTENANCE_PRICES: ExpectedPrice[] = PLANS.flatMap((plan) =>
  PERIODS.map((period) => ({
    envName: envNameFor(plan, period),
    plan,
    period,
    unitAmount: planPrices[plan][MAINTENANCE_KEY[period]],
    currency: "eur" as const,
    taxBehavior: "exclusive" as const,
    interval: PERIOD_INTERVAL[period],
  })),
);

const euros = (cents: number) => `${(cents / 100).toFixed(2)} €`;

/**
 * Audits one maintenance Price against what `planPrices` says it must be.
 *
 * `facts` is `null` when Stripe has no such Price under the key in force —
 * which is what a TEST-mode id set on a LIVE deployment looks like from here,
 * and it fails at `subscriptions.create`, i.e. after the customer is charged.
 */
export function auditMaintenancePrice(
  expected: ExpectedPrice,
  facts: StripePriceFacts | null | undefined,
  context: { creationProductIds: string[]; liveMode: boolean },
): PriceFinding[] {
  const envName = expected.envName;

  if (!facts) {
    return [
      {
        envName,
        priceId: "—",
        field: "existence",
        expected: `un Price ${expected.currency} de ${euros(expected.unitAmount)}`,
        actual: "aucun Price sous cette clé",
        message:
          `${envName} ne correspond à aucun Price Stripe sous la clé en cours. ` +
          `Un id de test posé sur un déploiement live échoue à subscriptions.create, ` +
          `donc APRÈS le débit du client.`,
      },
    ];
  }

  const findings: PriceFinding[] = [];
  const add = (field: string, exp: string, act: string, message: string) =>
    findings.push({ envName, priceId: facts.id, field, expected: exp, actual: act, message });

  if (facts.unitAmount === null) {
    add(
      "unit_amount",
      euros(expected.unitAmount),
      "tarification par paliers",
      `${envName} pointe sur un Price à paliers : le montant du renouvellement ` +
        `ne peut pas être comparé à planPrices.`,
    );
  } else if (facts.unitAmount !== expected.unitAmount) {
    add(
      "unit_amount",
      euros(expected.unitAmount),
      euros(facts.unitAmount),
      `${envName} facture ${euros(facts.unitAmount)} au renouvellement alors que ` +
        `planPrices.${expected.plan}.${MAINTENANCE_KEY[expected.period]} vaut ` +
        `${euros(expected.unitAmount)}. Le client est prélevé du mauvais montant.`,
    );
  }

  if (facts.currency !== expected.currency) {
    add(
      "currency",
      expected.currency,
      facts.currency,
      `${envName} est libellé en ${facts.currency} : le montant est juste, la devise non.`,
    );
  }

  /* The company is on the régime réel (lib/legal/company.ts). An inclusive
     Price makes the amount sent VAT-inclusive, so 100 € HT is invoiced as
     83,33 € HT + 16,67 € de TVA — under-billed by 20% on every renewal. */
  if (facts.taxBehavior !== expected.taxBehavior) {
    add(
      "tax_behavior",
      expected.taxBehavior,
      facts.taxBehavior ?? "non défini",
      `${envName} est en tax_behavior="${facts.taxBehavior ?? "non défini"}" au lieu de ` +
        `"exclusive" : la TVA serait prise DANS le montant au lieu de s'y ajouter.`,
    );
  }

  if (facts.recurringInterval === null) {
    add(
      "recurring",
      `récurrent (${expected.interval})`,
      "paiement unique",
      `${envName} pointe sur un Price à paiement unique : subscriptions.create ` +
        `le refuse, après le débit du client.`,
    );
  } else if (facts.recurringInterval !== expected.interval) {
    add(
      "recurring.interval",
      expected.interval,
      facts.recurringInterval,
      `${envName} est facturé par « ${facts.recurringInterval} » alors que la ` +
        `période vendue est « ${expected.period} ».`,
    );
  } else if (
    facts.recurringIntervalCount !== undefined &&
    facts.recurringIntervalCount !== null &&
    facts.recurringIntervalCount !== 1
  ) {
    add(
      "recurring.interval_count",
      "1",
      String(facts.recurringIntervalCount),
      `${envName} facture tous les ${facts.recurringIntervalCount} ${facts.recurringInterval}(s) : ` +
        `la fréquence ne correspond pas à la période vendue.`,
    );
  }

  if (!facts.active) {
    add(
      "active",
      "true",
      "false",
      `${envName} pointe sur un Price archivé : il ne peut plus porter d'abonnement.`,
    );
  }

  /* The founders coupon is restricted (applies_to) to the creation Product. A
     maintenance Price hanging off that same Product would be zeroed by it too:
     the build AND the first year of maintenance given away, silently. */
  if (context.creationProductIds.includes(facts.productId)) {
    add(
      "product",
      "un produit de maintenance",
      facts.productId,
      `${envName} est rattaché au produit de CRÉATION ${facts.productId}, celui que ` +
        `le coupon fondateurs vise avec applies_to : la maintenance serait offerte ` +
        `en même temps que la création.`,
    );
  }

  if (facts.livemode !== context.liveMode) {
    add(
      "livemode",
      String(context.liveMode),
      String(facts.livemode),
      `${envName} pointe sur un objet ${facts.livemode ? "live" : "de test"} alors que la ` +
        `clé en cours est ${context.liveMode ? "live" : "de test"}.`,
    );
  }

  return findings;
}

/**
 * Audits all four maintenance Prices.
 *
 * A variable absent from `prices` is skipped, not reported: whether it is SET
 * is `validateSiteEnv`'s job (lib/env.ts) and `resolveMaintenancePriceId`'s,
 * and reporting it twice in two vocabularies helps nobody.
 */
export function auditMaintenancePrices(input: {
  prices: Record<string, StripePriceFacts | null | undefined>;
  creationProductIds: string[];
  liveMode: boolean;
}): PriceFinding[] {
  const context = {
    creationProductIds: input.creationProductIds,
    liveMode: input.liveMode,
  };

  const findings = EXPECTED_MAINTENANCE_PRICES.flatMap((expected) =>
    expected.envName in input.prices
      ? auditMaintenancePrice(expected, input.prices[expected.envName], context)
      : [],
  );

  /* The creation-Product check is the one rule here that needs something other
     than the Price itself, and with no creation Product ids it cannot run. It
     used to return silently, so an audit that had skipped a check reported the
     same empty result as one that had passed it — a clean bill of health for a
     rule that never executed. That is the failure this module exists to make
     impossible, so it is reported rather than assumed harmless. */
  const auditedSomething = EXPECTED_MAINTENANCE_PRICES.some(
    (expected) => expected.envName in input.prices,
  );
  if (auditedSomething && context.creationProductIds.length === 0) {
    findings.push({
      envName: "STRIPE_PRODUCT_CREATION_*",
      priceId: "—",
      field: "coverage",
      expected: "au moins un produit de création connu",
      actual: "aucun",
      message:
        "Aucun STRIPE_PRODUCT_CREATION_* n'est posé sur ce déploiement, donc la " +
        "vérification « un Price de maintenance rattaché au produit de création » " +
        "n'a pas pu être faite. Les autres contrôles restent valables ; celui-ci " +
        "n'a pas été exécuté — ce n'est pas un succès.",
    });
  }

  return findings;
}
