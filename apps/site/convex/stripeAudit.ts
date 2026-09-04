"use node";

/* ── Reads Stripe, decides nothing ──

   The thin half of the maintenance Price audit: fetch the four Prices the
   renewal is billed on and hand them to convex/stripePriceAudit.ts, which
   holds every rule and is unit-tested without credentials.

   internalAction on purpose. It is an account-owner verification step, run
   from the CLI against the deployment that sells:

     pnpx convex run stripeAudit:run --prod

   Not a public action: requireAdmin (convex/admin.ts) takes a Query or
   Mutation ctx and cannot guard an action, and this returns the shape of the
   billing configuration. An unauthenticated endpoint for that is not worth the
   convenience. */

import Stripe from "stripe";
import { internalAction } from "./_generated/server";
import { resolveStripeAccess } from "./stripeMode";
import {
  CREATION_PRODUCT_ENV,
  EXPECTED_MAINTENANCE_PRICES,
  auditMaintenancePrices,
  type StripePriceFacts,
} from "./stripePriceAudit";

/**
 * Maps a Stripe Price onto the facts the audit reads.
 *
 * Exported for the tests: this is where a wrong field name would read a correct
 * Price as a broken one, or the reverse, and nothing downstream could tell.
 */
export function toFacts(price: Stripe.Price): StripePriceFacts {
  return {
    id: price.id,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    taxBehavior: price.tax_behavior ?? null,
    recurringInterval: price.recurring?.interval ?? null,
    recurringIntervalCount: price.recurring?.interval_count ?? null,
    /* Never expanded, so always the id. Narrowed rather than cast. */
    productId: typeof price.product === "string" ? price.product : price.product.id,
    livemode: price.livemode,
  };
}

/** `null` for a Price that does not exist under this key — the audit reports it. */
async function retrieveOrNull(
  stripe: Stripe,
  priceId: string,
): Promise<StripePriceFacts | null> {
  try {
    return toFacts(await stripe.prices.retrieve(priceId));
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return null;
    }
    /* Anything else — network, a revoked key, a rate limit — is not a finding
       about the configuration and must not be reported as one. */
    throw error;
  }
}

/**
 * Compares the four maintenance Prices in Stripe against `planPrices`.
 *
 * Reports, never repairs: a wrong Price may already carry live subscriptions,
 * and changing an amount under them is a decision with customers on the other
 * end of it. See tasks/stripe-founders-offer-runbook.md §7.
 */
export const run = internalAction({
  args: {},
  handler: async () => {
    const access = resolveStripeAccess("auditer les Price de maintenance");
    if (access.mode === "test") {
      return {
        audited: 0,
        skipped: EXPECTED_MAINTENANCE_PRICES.map((e) => e.envName),
        findings: [],
        summary:
          "Déploiement sans clé Stripe (BEYOURS_TEST_CHECKOUT). Rien à auditer : " +
          "aucun Price réel n'est en jeu.",
      };
    }

    const stripe = new Stripe(access.secretKey);
    const liveMode = access.secretKey.startsWith("sk_live_");

    const creationProductIds = Object.values(CREATION_PRODUCT_ENV).map(
      (name) => process.env[name],
    ).filter((id): id is string => typeof id === "string" && id !== "");

    const prices: Record<string, StripePriceFacts | null> = {};
    const skipped: string[] = [];

    for (const expected of EXPECTED_MAINTENANCE_PRICES) {
      const priceId = process.env[expected.envName];
      /* Unset is validateSiteEnv's finding and resolveMaintenancePriceId's
         error, not this audit's. Reporting it here too would say the same
         thing in a third vocabulary. */
      if (!priceId) {
        skipped.push(expected.envName);
        continue;
      }
      prices[expected.envName] = await retrieveOrNull(stripe, priceId);
    }

    const findings = auditMaintenancePrices({
      prices,
      creationProductIds,
      liveMode,
    });

    const audited = Object.keys(prices).length;
    const summary =
      findings.length === 0
        ? `${audited}/${EXPECTED_MAINTENANCE_PRICES.length} Price vérifiés, aucun écart avec planPrices.`
        : `${findings.length} écart(s) sur ${audited} Price vérifié(s) — voir findings.`;

    return { audited, skipped, findings, summary };
  },
});
