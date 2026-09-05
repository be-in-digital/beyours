"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { planPrices } from "./planPrices";
import { foundersOffer, resolveFoundersPricing } from "./foundersOffer";
import { resolveStripeAccess } from "./stripeMode";
import {
  MAINTENANCE_PRICE_ENV,
  CREATION_PRODUCT_ENV,
} from "./stripePriceAudit";
import {
  invoiceLegalSettings,
  vatConfigurationProblem,
} from "./invoiceLegal";

/* ── Maps plan + billingPeriod → env var holding the recurring Stripe Price ID ──
   NO hard-coded fallback: a TEST Price ID charged with a Live key would make
   subscriptions.create fail (« No such price ») AFTER the payment — the customer
   is debited but silently never provisioned. So we require all 4 STRIPE_PRICE_*
   (Convex env) and fail LOUDLY when one is missing.
   At go-live: set the 4 STRIPE_PRICE_* (prod Convex env) to the live Price IDs
   of the Be in Digital account.
   The map itself lives in ./stripePriceAudit, the module that also knows what
   those Prices must CONTAIN — so the checkout and the audit that verifies it
   cannot read two different lists. */

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
   targeted by applies_to, hence these persistent ones.
   Map in ./stripePriceAudit, alongside the maintenance one. */

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

/* ── Seller details carried by every Stripe invoice ──
   The business profile (name, address, VAT) stays configured in the Stripe
   dashboard; the legal mentions come from convex/invoiceLegal.ts, which reads
   lib/legal/company.ts. They used to be two hard-coded strings here, pointing
   at a file path that no longer existed. */

/**
 * Stripe for a path that moves money, or `null` on the deliberate test path.
 *
 * `null` now means one thing only — this deployment asked for the no-payment
 * path by name. An unconfigured deployment throws instead of selling for free.
 * See ./stripeMode.
 */
function getStripeOrTestMode(operation: string): Stripe | null {
  const access = resolveStripeAccess(operation);
  return access.mode === "test" ? null : new Stripe(access.secretKey);
}

/* ── Stripe Tax ──
   The company is on the régime réel (VAT.regime in lib/legal/company.ts), so
   this must be "true" in the Convex env, together with NEXT_PUBLIC_TVA_ENABLED
   on the Next side. What that requires in Stripe:
   1. Stripe Tax enabled in the dashboard (registered address, FR registration),
   2. the maintenance Prices on tax_behavior=exclusive (dashboard),
   3. STRIPE_TAX_ENABLED=true here and NEXT_PUBLIC_TVA_ENABLED=true on the Next
      side (see lib/payment-providers.ts).
   The amounts sent stay pre-tax; Stripe adds French VAT (20 %).

   Left off while the regime says otherwise, the sale is refused below rather
   than invoiced wrongly. */
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
    /* ── Referral ──
       The code the customer typed, and nothing else. This action is PUBLIC and
       unauthenticated, so every argument here is attacker-chosen; it used to
       also accept `referralCodeId`, `referrerId` and `discountPercent`, and
       billed the percent it was handed. `discountPercent: 99` bought a Premium
       build for 2 075 € instead of 8 750 €, and anything above 100 wrote a
       NEGATIVE order that still reached « paid ». The affiliate id was equally
       free: it named who collected the commission, without ever being checked
       against the code.
       All three are now derived from this string by
       `referralCodes.resolveForCheckout`, an internalQuery no client can call.
       Removing them rather than ignoring them is deliberate — Convex rejects
       unknown arguments, so an old client that still sends a percent fails
       loudly instead of being quietly overruled. */
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ url: string | null; orderId: string; testMode: boolean }> => {
    /* Refuses before anything exists — the order is created 80 lines below, so
       a deployment without a key leaves no half-sale behind. */
    const stripe = getStripeOrTestMode("ouvrir une session de paiement");

    /* ── VAT configuration ──
       Second, behind the missing-key refusal: whether this deployment is wired
       to take money at all is the blunter question, and answering it first
       keeps that error unambiguous (#252). Everything between here and the
       order insert only reads, so this still refuses before an order, a coupon
       or a session exists anywhere — which is the invariant that matters.

       This used to log and carry on, because which of the two to align was a
       fiscal decision rather than an engineering one. It has been made (#174):
       régime réel, Stripe Tax on. What is left is a misconfiguration, and an
       invoice is a legal document — a refused sale can be retried once the env
       is right, an invoice stating a VAT position the company does not hold
       cannot be taken back.

       It also sat *after* the early return for the keyless path, so the one
       branch that marks an order paid without Stripe never checked at all.

       `validateSiteEnv` refuses the deployment for the same reason, so this
       only fires if the Convex env drifts from the regime afterwards. */
    const vatProblem = vatConfigurationProblem(stripeTaxEnabled());
    if (vatProblem) throw new Error(`[TVA] ${vatProblem}`);

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

    /* ── Referral (build only, not stackable with the founders offer) ──
       Everything the discount depends on is read here, server-side, from the
       code alone: which code row it is, who owns it, and what it is worth. A
       code that does not exist, is deactivated, or belongs to a suspended
       affiliate resolves to `null` and the order is billed at list price —
       the customer is never told a code is good by the thing that charges
       them. An out-of-range percent throws instead (see ./referralDiscount):
       that is a misconfiguration, and it must not read as a bad code. */
    const resolvedReferral = args.referralCode
      ? await ctx.runQuery(internal.referralCodes.resolveForCheckout, {
          code: args.referralCode,
        })
      : null;

    /* Anti-self-referral, now comparing against the owner of THIS code rather
       than against an affiliate id the caller picked. */
    const selfReferral =
      resolvedReferral?.referrerEmail != null &&
      resolvedReferral.referrerEmail.toLowerCase() ===
        args.customerEmail.toLowerCase();

    if (selfReferral) {
      console.log(
        `[REFERRAL] Self-referral detected (${args.customerEmail}), ignoring discount`,
      );
    }

    const referral = selfReferral ? null : resolvedReferral;
    const isReferral = referral !== null;

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
       coupon's max_redemptions. The Convex counter cannot hold it alone — it
       reads a snapshot, Stripe keeps the ledger — so a live checkout that
       cannot reach the coupon is REFUSED rather than served free
       (see resolveFoundersPricing). */
    const foundersCouponId = process.env.STRIPE_FOUNDERS_COUPON_ID;
    const creationProductId = resolveCreationProductId(args.plan);
    const foundersPricing = resolveFoundersPricing({
      isFounders,
      couponId: foundersCouponId,
      creationProductId,
      stripeLive: stripe !== null,
      creationProductEnvName: CREATION_PRODUCT_ENV[args.plan],
    });
    const useFoundersCoupon = foundersPricing === "coupon";

    const creationCents =
      foundersPricing === "zero-line"
        ? foundersOffer.creationCents
        : prices.creation;
    const foundersDiscountCents = useFoundersCoupon ? prices.creation : 0;
    const referralDiscountCents = referral
      ? Math.round((creationCents * referral.discountPercent) / 100)
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
    if (referral) {
      referralMetadata.referralCodeId = String(referral.referralCodeId);
      referralMetadata.referrerId = String(referral.referrerId);
      referralMetadata.discountPercent = String(referral.discountPercent);
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
      if (referral) {
        const settings = await ctx.runQuery(
          internal.affiliateSettings.getInternal,
          {},
        );
        const affiliate = await ctx.runQuery(
          internal.affiliateUsers.getById,
          { affiliateUserId: referral.referrerId },
        );
        const commissionCents =
          affiliate?.commissionOverrideCents ?? settings.defaultCommissionCents;

        await ctx.runMutation(internal.referrals.createFromCheckout, {
          referrerId: referral.referrerId,
          referralCodeId: referral.referralCodeId,
          orderId,
          customerEmail: args.customerEmail,
          customerName: `${args.customerFirstName} ${args.customerLastName}`.trim() || undefined,
          commissionCents,
          discountPercent: referral.discountPercent,
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
    } else if (referral && referralDiscountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: referralDiscountCents,
        currency: "eur",
        duration: "once",
        name: `Parrainage -${referral.discountPercent}%`,
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
        invoice_data: invoiceLegalSettings(args.buyerType),
      },
      /* The buyer's address is a mandatory mention on any invoice, whether or
         not VAT is charged — it used to be collected only when Stripe Tax was
         on, which left every invoice issued without it incomplete. */
      billing_address_collection: "required" as const,
      ...(taxOn
        ? {
            automatic_tax: { enabled: true },
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
                    name: `BeYours — ${planLabel} — Création${isFounders ? " (Offre fondateurs)" : ""}`,
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
              name: `BeYours — ${planLabel} — Maintenance`,
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
    /* Decides whether the renewal invoices carry the late payment terms. */
    buyerType: v.union(v.literal("business"), v.literal("personal")),
  },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripeOrTestMode("créer l'abonnement de maintenance");
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

    /* ── Legal mentions on the renewal invoices ──
       invoice_creation on the Checkout session covers the FIRST invoice only.
       Every renewal after it is raised by Stripe from the subscription, and
       carried nothing: no seller identity, no SIRET, no VAT mention, no late
       payment terms. That is the whole recurring revenue billed on invoices
       that do not hold up.

       Stripe has no footer field on a subscription — the setting lives on the
       customer and applies to every invoice raised for them from now on. Set
       before the subscription so the first renewal already has it. */
    await stripe.customers.update(args.stripeCustomerId, {
      invoice_settings: invoiceLegalSettings(args.buyerType),
    });

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
