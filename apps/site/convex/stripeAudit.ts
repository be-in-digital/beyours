"use node";

/* ── Reads Stripe, decides nothing ──

   The thin half of the billing audit: fetch the four Prices the renewal is
   billed on, plus the founders coupon, and hand them to
   convex/stripePriceAudit.ts and convex/stripeCouponAudit.ts, which hold every
   rule and are unit-tested without credentials.

   The coupon half arrived after the Prices. Until then this action audited the
   renewal — 100 to 2 000 € a year, where drift eventually shows up on an
   invoice someone reads — and skipped the object that gives away a 3 500 €
   build, where drift shows up nowhere. The runbook said so in §7 and the gap
   stayed open: the coupon's only check lived in stripe-founders-launch.sh,
   behind `command -v stripe`, so on a machine without the Stripe CLI the
   section degraded to « unknown » and the run still passed. `percent_off` —
   the field that decides whether the creation is actually free — was read by
   neither.

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
import {
  FOUNDERS_COUPON_ENV,
  FOUNDERS_CREATION_PRODUCT_ENV,
  auditFoundersCoupon,
  summariseCouponFindings,
  type CouponFinding,
  type StripeCouponFacts,
} from "./stripeCouponAudit";

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
 * Maps a Stripe Coupon onto the facts the audit reads.
 *
 * Exported for the tests, same reason as `toFacts`: this is where a wrong
 * field name reads a broken coupon as a correct one.
 *
 * The one subtlety is `appliesToProducts`, and it is the reason the type
 * distinguishes `null` from `[]`. Stripe accepts `applies_to` on create,
 * validates it, and then never returns the field — so `undefined` here means
 * « the API said nothing », not « the coupon is unrestricted ». Collapsing the
 * two to `[]` would turn every correctly restricted coupon into a blocking
 * finding, which is exactly the false accusation that cost two of them in the
 * create wizard's history.
 */
export function toCouponFacts(coupon: Stripe.Coupon): StripeCouponFacts {
  return {
    id: coupon.id,
    valid: coupon.valid,
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off ?? null,
    currency: coupon.currency ?? null,
    duration: coupon.duration,
    maxRedemptions: coupon.max_redemptions ?? null,
    timesRedeemed: coupon.times_redeemed,
    redeemBy: coupon.redeem_by ?? null,
    /* `?? null` on the OUTER field only — an applies_to that is present with an
       empty product list stays `[]`, which is a real finding. */
    appliesToProducts: coupon.applies_to?.products ?? null,
    livemode: coupon.livemode,
  };
}

/** `null` for a coupon that does not exist under this key — the audit reports it. */
async function retrieveCouponOrNull(
  stripe: Stripe,
  couponId: string,
): Promise<StripeCouponFacts | null> {
  try {
    return toCouponFacts(await stripe.coupons.retrieve(couponId));
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return null;
    }
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
    const priceSummary =
      findings.length === 0
        ? `${audited}/${EXPECTED_MAINTENANCE_PRICES.length} Price vérifiés, aucun écart avec planPrices.`
        : `${findings.length} écart(s) sur ${audited} Price vérifié(s) — voir findings.`;

    /* ── The coupon ──
       Skipped only when the variable is unset, for the same reason as a Price:
       resolveFoundersPricing already refuses the sale loudly, and saying it
       again here in a third vocabulary helps nobody. Note the asymmetry with
       the Prices above — a missing Price debits the customer and then fails,
       a missing coupon stops the checkout before any money moves. */
    const couponId = process.env[FOUNDERS_COUPON_ENV];
    let coupon: {
      checked: boolean;
      id: string | null;
      findings: CouponFinding[];
      blocking: number;
      warnings: number;
      unverifiable: number;
      summary: string;
    };

    if (!couponId) {
      skipped.push(FOUNDERS_COUPON_ENV);
      coupon = {
        checked: false,
        id: null,
        findings: [],
        blocking: 0,
        warnings: 0,
        unverifiable: 0,
        summary:
          `${FOUNDERS_COUPON_ENV} n'est pas posé sur ce déploiement : coupon NON audité. ` +
          `Ce n'est pas un succès — c'est aussi la variable dont l'absence fait refuser ` +
          `toute vente Essentielle tant qu'il reste des places fondateurs.`,
      };
    } else {
      const couponFindings = auditFoundersCoupon(
        await retrieveCouponOrNull(stripe, couponId),
        {
          /* The founders plan's creation product, and only it: the offer is
             single-plan, so the other creation product is not a legitimate
             applies_to target. Which variable that is comes from
             FOUNDERS_CREATION_PRODUCT_ENV, derived from foundersOffer.plan. */
          creationProductId:
            process.env[FOUNDERS_CREATION_PRODUCT_ENV] ?? null,
          liveMode,
        },
      );
      coupon = {
        checked: true,
        id: couponId,
        findings: couponFindings,
        ...summariseCouponFindings(couponFindings),
      };
    }

    /* `ok` is the gate, and it counts an unverifiable finding as NOT ok — the
       browser check of §6c is still owed, and a run that returned `ok: true`
       over an applies_to nobody has ever looked at would be the « green over a
       section it never looked at » the wizards were written to stop. */
    const ok =
      findings.length === 0 &&
      coupon.checked &&
      coupon.blocking === 0 &&
      coupon.unverifiable === 0;

    return {
      ok,
      audited,
      skipped,
      findings,
      priceSummary,
      coupon,
      summary: `${priceSummary} ${coupon.summary}`,
    };
  },
});
