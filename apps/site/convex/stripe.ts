"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { planPrices } from "./planPrices";
import {
  isPlanOpenForSale,
  planClosedForSaleMessage,
} from "./planAvailability";
import { foundersOffer, resolveFoundersPricing } from "./foundersOffer";
import { resolveStripeAccess, StripeNotConfiguredError } from "./stripeMode";
import type { UnbillableReason } from "./subscriptions";
import { isSameMailbox } from "./emailIdentity";
import {
  MAINTENANCE_PRICE_ENV,
  CREATION_PRODUCT_ENV,
} from "./stripePriceAudit";
import {
  invoiceLegalSettings,
  taxDisplayMismatch,
  vatConfigurationProblem,
} from "./invoiceLegal";
import {
  WITHDRAWAL_WAIVER,
  WITHDRAWAL_WAIVER_REQUIRED,
} from "../lib/legal/withdrawal-waiver";
import {
  findSubscriptionForOrder,
  maintenanceIdempotencyKey,
  maintenanceSubscriptionParams,
} from "./maintenanceSubscription";

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

   Absent reads as "off", which is the fail-closed direction under the régime
   réel: left off — forgotten or deliberate — while the regime says otherwise,
   the sale is refused below rather than invoiced wrongly. This is also the
   only place the variable is checked at all: it lives on the Convex
   deployment, and validateSiteEnv (lib/env.ts) reads the Next env. */
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
    /* ── art. L. 221-28: the express request for immediate performance ──
       Required, never defaulted. It used to live only in React state
       (components/checkout/checkout-flow.tsx), which meant two things: the
       company could produce no evidence of the waiver its own CGV rely on, and
       the gate was a client-side one on a public action — the deployment URL
       ships in the browser bundle, so skipping the checkbox was a matter of
       calling this directly. Same shape as `affiliateSignature.consented`. */
    withdrawalWaiverConsent: v.boolean(),
    // Referral (optional)
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
       Removing them rather than ignoring them is deliberate: Convex refuses an
       unknown argument, so an old client that still sends a percent fails
       loudly instead of being quietly overruled. (Refuses ALMOST any — an
       argument named after an `Object.prototype` member, `__proto__` or
       `toString`, is accepted and ignored. That costs nothing here, since none
       of the three removed names is one, and every price is derived rather
       than read from the arguments; it is recorded so the sentence above is
       not read as a stronger guarantee than it is.) */
    referralCode: v.optional(v.string()),
    /* Whether the summary the customer just read quoted VAT — the value of
       TVA_ENABLED in the bundle that rendered it, not a preference. Required,
       and deliberately so: a caller that cannot say what it displayed cannot
       be checked against what Stripe is about to charge, and this argument
       exists precisely because that comparison had no home. An old bundle is
       refused by the validator until it is redeployed, which is the safe
       direction — a retried sale costs a minute, a wrong invoice cannot be
       taken back. */
    taxDisplayed: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ url: string | null; orderId: string; testMode: boolean }> => {
    /* ── Is this plan even on sale? ──
       First, ahead of every env-dependent check, because this one does not
       depend on the environment: a plan that is not open is not open in test
       mode either, and the keyless path below marks an order paid without ever
       calling Stripe. `plan` arrives from the query string
       (components/checkout/checkout-content.tsx), so the pricing page's
       « À venir » badge gates nothing on its own — this is what gates it. */
    if (!isPlanOpenForSale(args.plan)) {
      throw new Error(planClosedForSaleMessage(args.plan));
    }

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

       `validateSiteEnv` refuses the deployment over the Next-side flag for the
       same reason, but it cannot see this one: STRIPE_TAX_ENABLED lives on the
       Convex deployment, which no Next-side function reads. This is the only
       place it is checked at all. */
    const vatProblem = vatConfigurationProblem(stripeTaxEnabled());
    if (vatProblem) throw new Error(`[TVA] ${vatProblem}`);

    /* ── The two envs, finally compared ──
       Both flags being individually right does not make them agree: they are
       read from two different envs, and the Next one was frozen into the
       client bundle at build time, possibly before the deployment was
       finished. A summary that quoted no VAT against a Stripe that adds it
       shows the buyer one total and debits another. Refuse, still before any
       write. */
    const displayProblem = taxDisplayMismatch(
      stripeTaxEnabled(),
      args.taxDisplayed,
    );
    if (displayProblem) throw new Error(`[TVA] ${displayProblem}`);

    /* ── The waiver, refused before anything exists ──
       Fourth, and above the order insert for the same reason as the three
       checks above it: a refused sale must leave no row behind for the ops
       console to count. The consent is recorded on the order below, from the
       server's own copy of the clause, so what is stored is the wording the
       company published rather than a string a caller chose. */
    if (!args.withdrawalWaiverConsent) {
      throw new Error(WITHDRAWAL_WAIVER_REQUIRED);
    }

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

    /* Anti-self-referral: against the owner of THIS code rather than an
       affiliate id the caller picked, and on the MAILBOX rather than the
       string. A raw comparison was walked through with `+facture` — same
       inbox, different string, 750 € off and a 500 € commission to the
       affiliate, repeatable because each tag is also a fresh rate-limit
       subject. See ./emailIdentity. */
    const selfReferral = isSameMailbox(
      resolvedReferral?.referrerEmail,
      args.customerEmail,
    );

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
      withdrawalWaiver: {
        consentedAt: Date.now(),
        version: WITHDRAWAL_WAIVER.version,
        text: WITHDRAWAL_WAIVER.text,
        cgvClause: WITHDRAWAL_WAIVER.cgvClause,
      },
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
      /* ── Keep the card, or nothing can bill the maintenance ──
         This is a one-off `payment` session; the maintenance subscription it
         provisions is `charge_automatically`. Without this, NOTHING attached a
         reusable payment method to the customer, so every first renewal
         invoice — 240 to 2 400 € — landed on a customer with no card, failed,
         and dunned a client a year after they bought (#322).

         Stated per METHOD, not as `payment_intent_data.setup_future_usage`.
         That form applies to the whole intent, and Stripe removes from
         Checkout every method that cannot honour it — which would silently
         drop Alma and Klarna, the BNPL options this page deliberately offers.
         Per-method saves the card when a card is used and leaves BNPL on the
         page untouched.

         BNPL therefore still ends with no reusable method. That is a property
         of Alma and Klarna, not something to work around here: the gap is made
         VISIBLE at provisioning time instead — see `createSubscription`. */
      payment_method_options: {
        card: { setup_future_usage: "off_session" },
      },
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

/**
 * The payment method a renewal can actually be charged to, or null.
 *
 * Null is a real answer, not a failure. Alma and Klarna settle the first
 * payment and cannot be reused off-session, so a BNPL buyer legitimately
 * leaves no reusable method behind — the caller records that rather than
 * pretending the subscription is billable.
 *
 * Never throws: this runs after the money is collected, on a webhook that must
 * not 500 (see `handleCheckoutCompleted`). A Stripe read that fails here costs
 * the default payment method, and the caller reports that; it must not cost
 * the subscription itself.
 */
async function resolveReusablePaymentMethod(
  stripe: Stripe,
  paymentIntentId: string | undefined,
): Promise<
  | { method: string; reason?: undefined }
  | { method: null; reason: UnbillableReason }
> {
  /* Three ways to end up with nothing, and they are NOT the same fact.
     Answering `null` to all three is what let the ops feed report a Stripe
     outage as « Paiement initial réglé en BNPL (Alma/Klarna) » (#411). The
     caller writes that line, so it is given the cause rather than left to
     assume the most flattering one. */
  if (!paymentIntentId) return { method: null, reason: "no_intent" };
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const method = intent.payment_method;
    const id = typeof method === "string" ? method : (method?.id ?? null);
    /* The intent WAS read and carries no reusable method. Alma and Klarna
       settle a payment and cannot be represented off-session, so this is the
       one case that genuinely is BNPL. */
    return id ? { method: id } : { method: null, reason: "bnpl" };
  } catch (err) {
    console.error(
      `[STRIPE] Lecture du PaymentIntent ${paymentIntentId} impossible — ` +
        `l'abonnement sera créé sans moyen de paiement par défaut:`,
      err,
    );
    return { method: null, reason: "unreadable" };
  }
}

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
    /* The intent that collected the first period. Its payment method is what
       every renewal after it will be charged to — see below. Optional because
       a replay of an older event carries no such field, and a subscription
       that already exists must still be adoptable. */
    stripePaymentIntentId: v.optional(v.string()),
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

    const order = {
      orderId: args.orderId,
      plan: args.plan,
      billingPeriod: args.billingPeriod,
    };

    /* ── Legal mentions on the renewal invoices ──
       invoice_creation on the Checkout session covers the FIRST invoice only.
       Every renewal after it is raised by Stripe from the subscription, and
       carried nothing: no seller identity, no SIRET, no VAT mention, no late
       payment terms. That is the whole recurring revenue billed on invoices
       that do not hold up.

       Stripe has no footer field on a subscription — the setting lives on the
       customer and applies to every invoice raised for them from now on. Set
       before the subscription so the first renewal already has it. */

    /* ── The card the renewals will be charged to ──
       The Checkout session saves it off-session (`payment_method_options.card`
       there); this is what makes it BILLABLE. Both halves are needed: Stripe
       attaches a saved method to the customer but does not make it the default
       any invoice charges, so without this the renewal still finds nothing.

       Read off the PaymentIntent rather than listing the customer's methods:
       it names the method that actually paid for this order, which is the one
       the buyer consented to keep.

       On the CUSTOMER, deliberately, and not in the subscription parameters.
       Stripe bills a subscription that names no `default_payment_method`
       against `customer.invoice_settings.default_payment_method`, so the
       effect is the same — and the parameters stay a pure function of the
       order. `maintenanceIdempotencyKey` depends on that: Stripe refuses a
       repeated key whose body changed, so a replay that resolved the method
       differently (an unreadable intent, say) would turn a harmless retry into
       a hard failure. See ./maintenanceSubscription. */
    const reusable = await resolveReusablePaymentMethod(
      stripe,
      args.stripePaymentIntentId,
    );

    await stripe.customers.update(args.stripeCustomerId, {
      invoice_settings: {
        ...invoiceLegalSettings(args.buyerType),
        ...(reusable.method
          ? { default_payment_method: reusable.method }
          : {}),
      },
    });

    /* ── Does Stripe already bill this order? ──
       Asked before creating, because neither our row nor the idempotency key
       is guaranteed to still be there: a delivery that created the subscription
       and then died leaves no row, and Stripe forgets an idempotency key after
       24 h while it keeps retrying the webhook for three days. Checkout opens
       one Customer per session, so a page of a hundred is far more than this
       customer can hold — the number is a guard against an unbounded call, not
       a cap on anything real. */
    const known = await stripe.subscriptions.list({
      customer: args.stripeCustomerId,
      limit: 100,
    });
    const adopted = findSubscriptionForOrder(known.data, args.orderId);

    if (adopted) {
      /* Worth seeing: it means an earlier delivery got as far as Stripe and
         never came back to record it. Nothing is broken now, but the sale went
         through a path that lost its footing halfway. */
      console.warn(
        `[STRIPE] Order ${args.orderId} already carries subscription ${adopted.id} at Stripe — ` +
          `adopting it instead of creating a second one.`,
      );
    }

    /* The deterministic key is what stops the concurrent case: the delivery
       that loses the race gets THIS subscription back from Stripe rather than
       a second one that would bill on every renewal. See
       ./maintenanceSubscription for why the parameters may not read a clock. */
    const subscription =
      adopted ??
      (await stripe.subscriptions.create(
        maintenanceSubscriptionParams({
          order,
          stripeCustomerId: args.stripeCustomerId,
          priceId,
          automaticTax: stripeTaxEnabled(),
        }),
        { idempotencyKey: maintenanceIdempotencyKey(order) },
      ));

    /* Read off the subscription Stripe returned, never off a local clock: an
       adopted subscription may be hours old, and a replay hands back the
       original object. `trial_end` is when billing actually starts — the first
       period was collected at checkout. */
    const periodStartMs = subscription.start_date * 1000;
    const periodEndMs = subscription.trial_end
      ? subscription.trial_end * 1000
      : undefined;

    await ctx.runMutation(internal.subscriptions.create, {
      orderId: args.orderId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: args.stripeCustomerId,
      customerEmail: args.customerEmail,
      plan: args.plan,
      billingPeriod: args.billingPeriod,
      status: "active",
      currentPeriodStart: periodStartMs,
      currentPeriodEnd: periodEndMs,
      /* A subscription with nothing to charge is not an error — Alma and
         Klarna cannot be reused off-session — but it IS a sale that will dun a
         client at the end of the trial unless somebody collects a card first.
         Reported where ops look rather than left to be discovered by the
         failed invoice, and reported with the CAUSE: an unreadable intent and
         a BNPL sale need different things done about them (#411). */
      ...(reusable.method === null
        ? { unbillableReason: reusable.reason }
        : {}),
    });

    console.log(
      `Subscription ${subscription.id} recorded for order ${args.orderId}` +
        (periodEndMs
          ? ` (trial until ${new Date(periodEndMs).toISOString()})`
          : ""),
    );
  },
});

/* ═══════════════════════════════════════════════
   Cancel the maintenance subscription when the sale is undone
   ═══════════════════════════════════════════════ */

/**
 * Stops billing the maintenance for an order whose payment was reversed.
 *
 * WHY THIS EXISTS. `handleChargeReversal` marked the payment refunded, the
 * order cancelled and clawed the referral commission back — and left the
 * subscription running. Nothing in this app could cancel one: a refunded
 * ex-client kept a live `charge_automatically` subscription and was either
 * dunned or charged outright at the end of the trial, for a sale that had been
 * undone (#322). The money had already gone back; only the billing
 * relationship stayed.
 *
 * Never throws. It is called from a Stripe webhook that must answer 200 — a
 * 500 there makes Stripe replay the refund event for three days, re-running
 * every effect around it. A cancellation that fails is reported to ops and
 * retried by hand, which is strictly better than a retry storm.
 */
export const cancelSubscriptionForOrder = internalAction({
  args: {
    orderId: v.id("orders"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const subscription = await ctx.runQuery(internal.subscriptions.getByOrderId, {
      orderId: args.orderId,
    });
    if (!subscription) {
      // A sale refunded before provisioning ever ran. Nothing to stop.
      console.log(
        `[STRIPE] Aucun abonnement à annuler pour la commande ${args.orderId}`,
      );
      return;
    }
    if (subscription.status === "canceled") return;

    /* ── An unconfigured Stripe is not a reason to fail the webhook ──
       `getStripeOrTestMode` throws `StripeNotConfiguredError` on a deployment
       carrying neither a key nor the deliberate test flag, and that throw used
       to leave this action — and therefore `handleChargeReversal`, and
       therefore the whole webhook route, which answered 500. Stripe then
       retried `charge.refunded` for three days, replaying a reversal that had
       ALREADY marked the payment refunded, cancelled the order and clawed the
       commission back, and no operator was told any of it (#411).

       Refusing here is also pointless on its own terms: there is no key, so
       there is nothing to send a cancellation to.

       THE ROW IS STILL CLOSED, and this branch differs from the Stripe-refusal
       one below on purpose. There, Stripe answered: the subscription
       demonstrably exists and is demonstrably still billing, so a row reading
       `canceled` would be a lie nobody would ever look at again. Here nothing
       answered, and the one thing we do know is that the sale has been
       refunded. `maintenance.resolveEntitlement` reads `active` as entitled
       regardless of the period end, so leaving the row alone would serve a
       refunded — or charged-back — client « Maintenance à jour » and engine
       updates for ever. The incident line is what covers the other half: if a
       key was REMOVED after this subscription was created, Stripe may still be
       billing it, and a human has to go and cancel it by hand. */
    let stripe: Stripe | null;
    try {
      stripe = getStripeOrTestMode("annuler l'abonnement de maintenance");
    } catch (err) {
      if (!(err instanceof StripeNotConfiguredError)) throw err;
      console.error(
        `[STRIPE] Aucune clé Stripe sur ce déploiement — l'abonnement ` +
          `${subscription.stripeSubscriptionId} (commande ${args.orderId}) n'a pas pu ` +
          `être annulé chez Stripe. À vérifier et annuler à la main:`,
        err,
      );
      await ctx.runMutation(internal.subscriptions.recordCancellationFailure, {
        orderId: args.orderId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        customerEmail: subscription.customerEmail,
        detail: err.message,
      });
      stripe = null;
    }

    /* The local row is closed whether or not Stripe could be reached. Leaving
       it "active" would tell every screen the client is still under
       maintenance — and `/maintenance/status` reads it, so a refunded client
       would keep pulling updates. */
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (err) {
        /* Already gone at Stripe is the one benign failure: the end state we
           want is the state we are in, so record it and carry on closing the
           row. Anything else is reported and left for a human. */
        const code = (err as { code?: string } | null)?.code;
        if (code !== "resource_missing") {
          console.error(
            `[STRIPE] Annulation de l'abonnement ${subscription.stripeSubscriptionId} ` +
              `(commande ${args.orderId}) impossible — à annuler à la main:`,
            err,
          );
          await ctx.runMutation(internal.subscriptions.recordCancellationFailure, {
            orderId: args.orderId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            customerEmail: subscription.customerEmail,
            detail: err instanceof Error ? err.message : String(err),
          });
          return;
        }
      }
    }

    await ctx.runMutation(internal.subscriptions.updateStatus, {
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: "canceled" as const,
      canceledAt: Date.now(),
    });

    await ctx.runMutation(internal.subscriptions.recordCancellation, {
      orderId: args.orderId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      customerEmail: subscription.customerEmail,
      reason: args.reason,
    });

    console.log(
      `[STRIPE] Abonnement ${subscription.stripeSubscriptionId} annulé ` +
        `(commande ${args.orderId}) — ${args.reason}`,
    );
  },
});
