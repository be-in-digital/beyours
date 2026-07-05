"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const planPrices = {
  essentielle: { creation: 350000, maintenanceMonthly: 10000, maintenanceYearly: 100000 },
  premium: { creation: 750000, maintenanceMonthly: 20000, maintenanceYearly: 200000 },
} as const;

/* ── Mapping plan + billingPeriod → Stripe Price ID (récurrents) ── */
const maintenancePriceIds: Record<string, string> = {
  "essentielle:monthly": "price_1TEnXVK8R9QQdjlQTj4Ntwvu",
  "essentielle:yearly": "price_1TEnXWK8R9QQdjlQcWaCMZSF",
  "premium:monthly": "price_1TEnXWK8R9QQdjlQH8cIgkOd",
  "premium:yearly": "price_1TEnXXK8R9QQdjlQgbpX7ne0",
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
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

    // Calcul montant côté serveur (jamais confiance au client)
    const prices = planPrices[args.plan];
    const creationCents = prices.creation;
    const maintenanceCents =
      args.billingPeriod === "monthly"
        ? prices.maintenanceMonthly
        : prices.maintenanceYearly;
    const totalCents = creationCents + maintenanceCents;

    // ── Referral discount (mise en service uniquement) ──
    let discountAmountCents = 0;
    let isReferral = false;

    if (args.referralCodeId && args.referrerId && args.discountPercent) {
      // Anti-self-referral : comparer l'email du client avec celui de l'affilié
      const affiliateEmail: string | null = await ctx.runQuery(
        internal.affiliateUsers.getEmailById,
        { affiliateUserId: args.referrerId },
      );

      if (
        !affiliateEmail ||
        affiliateEmail.toLowerCase() !== args.customerEmail.toLowerCase()
      ) {
        discountAmountCents = Math.round(
          creationCents * args.discountPercent / 100,
        );
        isReferral = true;
      } else {
        console.log(
          `[REFERRAL] Self-referral detected (${args.customerEmail}), ignoring discount`,
        );
      }
    }

    const finalTotal = totalCents - discountAmountCents;

    // Créer la commande dans Convex
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
    });

    // Metadata referral pour le webhook
    const referralMetadata: Record<string, string> = {};
    if (isReferral) {
      referralMetadata.referralCodeId = String(args.referralCodeId!);
      referralMetadata.referrerId = String(args.referrerId!);
      referralMetadata.discountPercent = String(args.discountPercent!);
      referralMetadata.discountAmountCents = String(discountAmountCents);
    }

    // ── Mode test : pas de clé Stripe configurée ──
    if (!stripe) {
      console.log(
        `[TEST MODE] Order ${orderId} created (${finalTotal} cents, discount: ${discountAmountCents}) — skipping Stripe`,
      );

      await ctx.runMutation(internal.orders.updateStatus, {
        orderId,
        status: "paid",
        paymentMethod: "card",
      });

      // Créer le referral directement en mode test
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

    // Créer un coupon Stripe si referral
    let couponId: string | undefined;
    if (isReferral && discountAmountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountAmountCents,
        currency: "eur",
        duration: "once",
        name: `Parrainage -${args.discountPercent}%`,
      });
      couponId = coupon.id;
    }

    // BNPL toujours disponible (le paiement inclut la maintenance)
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      ["card", "alma"];
    if (args.buyerType === "personal") {
      paymentMethodTypes.push("klarna");
    }

    const planLabel = args.plan === "essentielle" ? "Essentielle" : "Premium";
    const periodLabel =
      args.billingPeriod === "monthly" ? "premier mois" : "première année";

    const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      customer_email: args.customerEmail,
      customer_creation: "always",
      client_reference_id: orderId,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: creationCents,
            product_data: {
              name: `Be in Digital — ${planLabel} — Mise en service`,
              description: "Création de votre solution digitale",
            },
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "eur",
            unit_amount: maintenanceCents,
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
   Créer l'abonnement maintenance après le 1er paiement
   Appelé par le webhook checkout.session.completed
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

    const priceId = maintenancePriceIds[`${args.plan}:${args.billingPeriod}`];
    if (!priceId) {
      console.error(`No price ID found for ${args.plan}:${args.billingPeriod}`);
      return;
    }

    // Calculer le début de la prochaine période
    // (la première période est déjà payée dans le checkout)
    const now = Math.floor(Date.now() / 1000);
    const trialEnd =
      args.billingPeriod === "monthly"
        ? now + 30 * 24 * 60 * 60 // +30 jours
        : now + 365 * 24 * 60 * 60; // +365 jours

    const subscription = await stripe.subscriptions.create({
      customer: args.stripeCustomerId,
      items: [{ price: priceId }],
      trial_end: trialEnd,
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
