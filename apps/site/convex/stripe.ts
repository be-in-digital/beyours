"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const planPrices = {
  essentielle: { creation: 350000, maintenanceMonthly: 10000, maintenanceYearly: 100000 },
  premium: { creation: 750000, maintenanceMonthly: 20000, maintenanceYearly: 200000 },
} as const;

/* ── Founders offer ──
   The first 10 Essentielle builds with the creation offered (list price
   3 500 € excl. tax), only the annual maintenance staying due, in exchange for
   contractual commitments (case study, testimonial, right to name them as a
   reference). It ends when the slots run out, never on a date.
   Not stackable with a referral: a code applied = list price −10 %.
   Duplicated in lib/payment-providers.ts (FOUNDERS_OFFER) — keep them in sync. */
const foundersOffer = {
  enabled: true,
  plan: "essentielle" as const,
  totalSlots: 10,
  creationCents: 0,
};

/* ── Maps plan + billingPeriod → env var holding the recurring Stripe Price ID ──
   NO hard-coded fallback: a TEST Price ID charged with a Live key would make
   subscriptions.create fail (« No such price ») AFTER the payment — the customer
   is debited but silently never provisioned. So we require all 4 STRIPE_PRICE_*
   (Convex env) and fail LOUDLY when one is missing.
   At go-live: set the 4 STRIPE_PRICE_* (prod Convex env) to the live Price IDs
   of the Be in Digital account. */
const MAINTENANCE_PRICE_ENV: Record<string, string> = {
  "essentielle:monthly": "STRIPE_PRICE_ESSENTIELLE_MONTHLY",
  "essentielle:yearly": "STRIPE_PRICE_ESSENTIELLE_YEARLY",
  "premium:monthly": "STRIPE_PRICE_PREMIUM_MONTHLY",
  "premium:yearly": "STRIPE_PRICE_PREMIUM_YEARLY",
};

/**
 * Resolves the maintenance Stripe Price ID for a plan/period pair.
 * Throws an explicit error when the matching env var is missing.
 * Called BEFORE collecting payment (createCheckoutSession, the provisioning
 * guardrail) AND in createSubscription — we never sell what we cannot bill.
 */
function resolveMaintenancePriceId(
  plan: string,
  billingPeriod: string,
): string {
  const key = `${plan}:${billingPeriod}`;
  const envName = MAINTENANCE_PRICE_ENV[key];
  if (!envName) {
    throw new Error(
      `Aucun Price ID de maintenance connu pour « ${key} » (plan/période invalide).`,
    );
  }
  const priceId = process.env[envName];
  if (!priceId) {
    throw new Error(
      `${envName} manquant en env : le Price ID de maintenance « ${key} » n'est pas configuré. ` +
        `Poser les 4 STRIPE_PRICE_* (env Convex) avec les Price IDs live avant toute vente.`,
    );
  }
  return priceId;
}

/* ── Maps plan → env var holding the PERSISTENT Stripe Product of the creation line ──
   The founders coupon is restricted to that product (applies_to), so its
   3 500 € land entirely on the creation line. Without it Stripe spreads an
   amount_off pro rata over EVERY line of the session: a « creation offerte »
   would bill 777,78 € of creation and 222,22 € of maintenance on the customer's
   invoice — the right total, the wrong split between an amortizable investment
   and a deductible charge. A product built on the fly (product_data) cannot be
   targeted by applies_to, hence these persistent ones. */
const CREATION_PRODUCT_ENV: Record<string, string> = {
  essentielle: "STRIPE_PRODUCT_CREATION_ESSENTIELLE",
  premium: "STRIPE_PRODUCT_CREATION_PREMIUM",
};

/**
 * Persistent Stripe Product ID of the creation line, or null when not
 * configured. Never throws: a missing product must not block a sale, it only
 * costs the targeted discount (see useFoundersCoupon).
 */
function resolveCreationProductId(plan: string): string | null {
  const envName = CREATION_PRODUCT_ENV[plan];
  if (!envName) return null;
  return process.env[envName] ?? null;
}

/* ── Seller details carried by the Stripe invoice for the 1st payment ──
   The business profile (name, address, VAT) stays configured in the Stripe
   dashboard; here we add the legal invoice footer + the SIRET as a custom field.
   Keep in sync with apps/web-restaurant/lib/legal/company.ts (COMPANY). */
const SELLER_INVOICE_FOOTER =
  "Be in Digital, nom commercial de TUUM AGENCY, SAS au capital de 1 000 €, 229 rue Saint-Honoré, 75001 Paris. R.C.S. Paris 930 817 697. TVA intracommunautaire FR31 930 817 697.";
const SELLER_SIRET = "930 817 697 00012";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/* ── Stripe Tax ──
   Off by default: the company is under franchise en base (art. 293 B of the
   French tax code), no VAT is charged and behaviour stays identical.
   The day it becomes VAT-liable (company on the régime réel):
   1. enable Stripe Tax in the dashboard (registered address, FR registration),
   2. switch the maintenance Prices to tax_behavior=exclusive (dashboard),
   3. set STRIPE_TAX_ENABLED=true here (Convex env) and
      NEXT_PUBLIC_TVA_ENABLED=true on the Next side (see lib/payment-providers.ts).
   The amounts sent stay pre-tax; Stripe adds French VAT (20 %). */
function stripeTaxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === "true";
}

export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    orderType: v.union(v.literal("creation"), v.literal("maintenance")),
    buyerType: v.union(v.literal("business"), v.literal("personal")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("yearly")),
    customerEmail: v.string(),
    customerFirstName: v.string(),
    customerLastName: v.string(),
    customerPhone: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    siret: v.optional(v.string()),
    successUrl: v.string(),
    cancelUrl: v.string(),
    // Referral (optional)
    referralCode: v.optional(v.string()),
    referralCodeId: v.optional(v.id("referralCodes")),
    referrerId: v.optional(v.id("affiliateUsers")),
    discountPercent: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ url: string | null; orderId: string; testMode: boolean }> => {
    const stripe = getStripe();

    // ── Provisioning guardrail (payment fix) ──
    // NEVER open a checkout session for a plan whose maintenance subscription
    // could not be provisioned: when a maintenance Price ID (env) is missing we
    // fail NOW — before any payment is collected and before the order is even
    // created — rather than after payment (in the webhook), which would leave a
    // customer charged but not provisioned. In test mode (no Stripe key) no real
    // subscription is created, so the check does not apply.
    if (stripe) {
      resolveMaintenancePriceId(args.plan, args.billingPeriod);
    }

    // Amount computed server-side (never trust the client)
    const prices = planPrices[args.plan];
    const maintenanceCents =
      args.billingPeriod === "monthly"
        ? prices.maintenanceMonthly
        : prices.maintenanceYearly;

    // ── Referral (build only, not stackable with the founders offer) ──
    let isReferral = false;

    if (args.referralCodeId && args.referrerId && args.discountPercent) {
      // Anti-self-referral: compare the customer's email with the affiliate's
      const affiliateEmail: string | null = await ctx.runQuery(
        internal.affiliateUsers.getEmailById,
        { affiliateUserId: args.referrerId },
      );

      if (
        !affiliateEmail ||
        affiliateEmail.toLowerCase() !== args.customerEmail.toLowerCase()
      ) {
        isReferral = true;
      } else {
        console.log(
          `[REFERRAL] Self-referral detected (${args.customerEmail}), ignoring discount`,
        );
      }
    }

    // ── Founders offer: while slots remain, and outside any referral ──
    let isFounders = false;
    if (foundersOffer.enabled && args.plan === foundersOffer.plan && !isReferral) {
      const foundersSold: number = await ctx.runQuery(
        api.orders.countFoundersSold,
        {},
      );
      isFounders = foundersSold < foundersOffer.totalSlots;
    }

    /* Founders: the creation line keeps its list price and a PERSISTENT Stripe
       coupon zeroes it, so Stripe enforces the 10-slot cap itself through the
       coupon's max_redemptions. The Convex counter cannot: countFoundersSold
       only sees orders already « paid », so checkouts opened before the first
       webhook lands never reserve a slot, and more than 10 builds could go out
       free. Without the env var configured we fall back to the old behaviour
       (a 0 € line, cap enforced by the counter alone) rather than block a sale. */
    const foundersCouponId = process.env.STRIPE_FOUNDERS_COUPON_ID;
    const creationProductId = resolveCreationProductId(args.plan);
    /* Both are required: the coupon caps the offer, the product is what the
       coupon is restricted to. With the coupon but no product the discount
       would spread over the maintenance line, so we fall back to the 0 € line
       (correct invoice, cap left to the Convex counter) rather than issue a
       wrongly split one. */
    const useFoundersCoupon =
      isFounders && !!foundersCouponId && !!creationProductId;
    if (isFounders && !foundersCouponId) {
      console.error(
        "STRIPE_FOUNDERS_COUPON_ID absent: offre fondateurs appliquée sans plafond Stripe",
      );
    } else if (isFounders && !creationProductId) {
      console.error(
        `${CREATION_PRODUCT_ENV[args.plan]} absent: offre fondateurs appliquée sans plafond Stripe ` +
          "(le coupon aurait réparti la remise sur la maintenance)",
      );
    }

    const creationCents =
      isFounders && !useFoundersCoupon
        ? foundersOffer.creationCents
        : prices.creation;
    const foundersDiscountCents = useFoundersCoupon ? prices.creation : 0;
    const referralDiscountCents = isReferral
      ? Math.round((creationCents * args.discountPercent!) / 100)
      : 0;
    const discountAmountCents = foundersDiscountCents + referralDiscountCents;
    const totalCents = creationCents + maintenanceCents;
    const finalTotal = totalCents - discountAmountCents;

    // Create the order in Convex
    const orderId: Id<"orders"> = await ctx.runMutation(internal.orders.create, {
      customerEmail: args.customerEmail,
      customerFirstName: args.customerFirstName,
      customerLastName: args.customerLastName,
      customerPhone: args.customerPhone,
      restaurantName: args.restaurantName,
      city: args.city,
      buyerType: args.buyerType,
      siret: args.siret,
      plan: args.plan,
      orderType: args.orderType,
      billingPeriod: args.billingPeriod,
      amountCents: finalTotal,
      isFounders,
    });

    // Referral metadata for the webhook
    const referralMetadata: Record<string, string> = {};
    if (isReferral) {
      referralMetadata.referralCodeId = String(args.referralCodeId!);
      referralMetadata.referrerId = String(args.referrerId!);
      referralMetadata.discountPercent = String(args.discountPercent!);
      referralMetadata.discountAmountCents = String(discountAmountCents);
    }

    // ── Test mode: no Stripe key configured ──
    if (!stripe) {
      console.log(
        `[TEST MODE] Order ${orderId} created (${finalTotal} cents, discount: ${discountAmountCents}) — skipping Stripe`,
      );

      await ctx.runMutation(internal.orders.updateStatus, {
        orderId,
        status: "paid",
        paymentMethod: "card",
      });

      // Create the referral straight away in test mode
      if (isReferral) {
        const settings = await ctx.runQuery(
          internal.affiliateSettings.getInternal,
          {},
        );
        const affiliate = await ctx.runQuery(
          internal.affiliateUsers.getById,
          { affiliateUserId: args.referrerId! },
        );
        const commissionCents =
          affiliate?.commissionOverrideCents ?? settings.defaultCommissionCents;

        await ctx.runMutation(internal.referrals.createFromCheckout, {
          referrerId: args.referrerId!,
          referralCodeId: args.referralCodeId!,
          orderId,
          customerEmail: args.customerEmail,
          customerName: `${args.customerFirstName} ${args.customerLastName}`.trim() || undefined,
          commissionCents,
          discountPercent: args.discountPercent!,
          discountAmountCents,
        });
      }

      return {
        url: `${args.successUrl}?orderId=${orderId}&test=1`,
        orderId,
        testMode: true,
      };
    }

    // ── Mode production : Stripe Checkout ──

    /* One coupon per session at most. Founders and referral are mutually
       exclusive by construction (isFounders requires !isReferral), so these
       two branches never compete. The founders coupon is reused across
       sessions on purpose: that shared redemption count is what caps the
       offer. The referral one is created per session, being customer-specific. */
    let couponId: string | undefined;
    if (useFoundersCoupon) {
      couponId = foundersCouponId;
    } else if (isReferral && referralDiscountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: referralDiscountCents,
        currency: "eur",
        duration: "once",
        name: `Parrainage -${args.discountPercent}%`,
        /* Computed on the creation only, so restrict it there: otherwise
           Stripe spreads it over the maintenance line too (see
           CREATION_PRODUCT_ENV). */
        ...(creationProductId
          ? { applies_to: { products: [creationProductId] } }
          : {}),
      });
      couponId = coupon.id;
    }

    // BNPL always available (the payment includes maintenance)
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      ["card", "alma"];
    if (args.buyerType === "personal") {
      paymentMethodTypes.push("klarna");
    }

    const planLabel = args.plan === "essentielle" ? "Essentielle" : "Premium";
    const periodLabel =
      args.billingPeriod === "monthly" ? "premier mois" : "première année";

    const taxOn = stripeTaxEnabled();
    const taxBehavior = taxOn
      ? { tax_behavior: "exclusive" as const }
      : {};

    const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      customer_email: args.customerEmail,
      customer_creation: "always",
      client_reference_id: orderId,
      // Issues a real PDF invoice for the initial payment (build + 1st year of
      // maintenance). Without this, a Checkout in "payment" mode only produces a
      // receipt, not a downloadable invoice.
      invoice_creation: {
        enabled: true,
        invoice_data: {
          footer: SELLER_INVOICE_FOOTER,
          custom_fields: [{ name: "SIRET", value: SELLER_SIRET }],
        },
      },
      ...(taxOn
        ? {
            automatic_tax: { enabled: true },
            billing_address_collection: "required" as const,
            tax_id_collection: { enabled: true },
          }
        : {}),
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: creationCents,
            ...taxBehavior,
            /* Persistent product when configured — required for the founders
               coupon to target this line only. Its name and description then
               come from the Stripe catalogue; the offer is named by the
               discount line the coupon adds to the invoice. */
            ...(creationProductId
              ? { product: creationProductId }
              : {
                  product_data: {
                    name: `Be in Digital — ${planLabel} — Création${isFounders ? " (Offre fondateurs)" : ""}`,
                    description: isFounders
                      ? "Création de votre solution digitale — Tarif fondateurs, 10 places"
                      : "Création de votre solution digitale",
                  },
                }),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "eur",
            unit_amount: maintenanceCents,
            ...taxBehavior,
            product_data: {
              name: `Be in Digital — ${planLabel} — Maintenance`,
              description: `Maintenance — ${periodLabel}`,
            },
          },
          quantity: 1,
        },
      ],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      metadata: {
        orderId,
        plan: args.plan,
        orderType: args.orderType,
        buyerType: args.buyerType,
        billingPeriod: args.billingPeriod,
        founders: String(isFounders),
        ...referralMetadata,
      },
      success_url: `${args.successUrl}?orderId=${orderId}`,
      cancel_url: `${args.cancelUrl}?orderId=${orderId}`,
    });

    await ctx.runMutation(internal.orders.setStripeSessionId, {
      orderId,
      stripeSessionId: session.id,
    });

    return { url: session.url, orderId, testMode: false };
  },
});

/* ═══════════════════════════════════════════════
   Create the maintenance subscription after the 1st payment
   Called by the checkout.session.completed webhook
   ═══════════════════════════════════════════════ */

export const createSubscription = internalAction({
  args: {
    orderId: v.id("orders"),
    stripeCustomerId: v.string(),
    customerEmail: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripe();
    if (!stripe) {
      console.log("[TEST MODE] Skipping subscription creation");
      return;
    }

    // Strict resolution: throws when the Price ID env var is missing, instead of
    // the silent return we had before (which left maintenance never billed). The
    // call is wrapped in a try/catch on the webhook side: the failure is recorded
    // and reported WITHOUT returning 500 (see http.ts handleCheckoutCompleted).
    const priceId = resolveMaintenancePriceId(args.plan, args.billingPeriod);

    // Work out when the next period starts
    // (the first period is already paid for at checkout)
    const now = Math.floor(Date.now() / 1000);
    const trialEnd =
      args.billingPeriod === "monthly"
        ? now + 30 * 24 * 60 * 60 // +30 jours
        : now + 365 * 24 * 60 * 60; // +365 jours

    const subscription = await stripe.subscriptions.create({
      customer: args.stripeCustomerId,
      items: [{ price: priceId }],
      trial_end: trialEnd,
      ...(stripeTaxEnabled() ? { automatic_tax: { enabled: true } } : {}),
      metadata: {
        orderId: args.orderId,
        plan: args.plan,
        billingPeriod: args.billingPeriod,
      },
    });

    await ctx.runMutation(internal.subscriptions.create, {
      orderId: args.orderId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: args.stripeCustomerId,
      customerEmail: args.customerEmail,
      plan: args.plan,
      billingPeriod: args.billingPeriod,
      status: "active",
      currentPeriodStart: now * 1000,
      currentPeriodEnd: trialEnd * 1000,
    });

    console.log(
      `Subscription ${subscription.id} created for order ${args.orderId} (trial until ${new Date(trialEnd * 1000).toISOString()})`,
    );
  },
});
