import { planPrices } from "@/convex/planPrices";
import { VAT } from "@/lib/legal/company";

/* ═══════════════════════════════════════════════
   Payment Providers — Config, matrice, helpers
   ═══════════════════════════════════════════════ */

export type BuyerType = "business" | "personal";
export type OrderType = "creation" | "maintenance";
export type BillingPeriod = "monthly" | "yearly";
export type PaymentMethodSlug = "card" | "alma" | "klarna";

export interface PaymentOption {
  slug: PaymentMethodSlug;
  label: string;
  description: string;
  installments?: number[];
}

/* ── Eligibility matrix ── */
/* The first payment always includes maintenance,
   so BNPL is always available. */

export function getAllowedPaymentMethods(
  buyerType: BuyerType,
): PaymentMethodSlug[] {
  const methods: PaymentMethodSlug[] = ["card", "alma"];
  if (buyerType === "personal") {
    methods.push("klarna");
  }
  return methods;
}

/* ── Options displayed in the UI ── */

export const paymentOptions: PaymentOption[] = [
  {
    slug: "card",
    label: "Carte bancaire",
    description: "Paiement immédiat par carte",
  },
  {
    slug: "alma",
    label: "Alma",
    description: "Payez en 2x, 3x ou 4x sans frais",
    installments: [2, 3, 4],
  },
  {
    slug: "klarna",
    label: "Klarna",
    description: "Payez en 3x (achat en nom propre uniquement)",
    installments: [3],
  },
];

/* ── Per-instalment amount ── */

export function getInstallmentAmount(
  totalCents: number,
  installments: number,
): number {
  return Math.ceil(totalCents / installments);
}

/* ── VAT ── */
/* Every price (planPrices, pricing-data) is quoted excluding tax — the right
   B2B convention here, since restaurants recover the VAT.

   The company is on the régime réel (VAT.regime in lib/legal/company.ts), so
   this flag belongs at "true", together with STRIPE_TAX_ENABLED on the Convex
   side (see convex/stripe.ts). The two go together and both are measured
   against the regime, not against each other: `validateSiteEnv` (lib/env.ts)
   refuses a deployment whose NEXT_PUBLIC_TVA_ENABLED disagrees with it or is
   simply missing, and `createCheckoutSession` refuses the sale rather than
   issue an invoice stating a VAT position the company does not hold.

   This flag decides what is CHARGED and displayed as a total. What the site
   CLAIMS about the regime — the pricing footnote, the CGV, the legal notice,
   the invoice — is read from VAT.regime instead, because that is a legal fact
   and not a deployment toggle. */

/**
 * Read the charging flag, falling back to the declared regime.
 *
 * `process.env.X === "true"` was the whole expression here, and it has one
 * property that made a forgotten variable expensive: an unset flag is
 * `undefined`, `undefined === "true"` is `false`, and `false` means "quote no
 * VAT". So a fresh Vercel project — where absent is the default state —
 * rendered the no-VAT branch of the checkout summary under the régime réel,
 * showing the buyer 8 750 € while Stripe, tax enabled on its own env, charged
 * 10 500 €.
 *
 * Absent now resolves to the regime instead of to silence. That is not a way
 * of tolerating the missing variable — `validateSiteEnv` still refuses the
 * deployment, and it is the caller's job to set it — it is a choice about
 * which way to be wrong while nobody has: a total that matches the invoice the
 * company is legally issuing, rather than one that undercuts it by 20 %.
 *
 * Only the two exact strings decide anything. A typo ("TRUE", "1", "oui")
 * falls back with them, and is reported at boot as a format error.
 */
export function resolveTvaEnabled(raw: string | undefined): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return VAT.regime === "reel";
}

/* Written as a direct static member access so Next still inlines the value
   into the client bundle at build time — a computed lookup would not be
   substituted, and the flag would read as undefined in the browser. */
export const TVA_ENABLED = resolveTvaEnabled(
  process.env.NEXT_PUBLIC_TVA_ENABLED,
);
export const TVA_RATE_PERCENT = 20;

/* ── Founders offer ──
   The first 10 Essentielle builds have their creation waived entirely (list
   price 3 500 €): the client pays the annual maintenance and nothing else,
   in exchange for contractual commitments (case study, testimonial, reference).
   It ends when the slots run out (api.orders.countFoundersSold counter), never
   on a date. Not stackable with a referral: applying a code switches to the
   list price −10 %. The list price itself never changes.
   Duplicated in convex/foundersOffer.ts (foundersOffer) — keep them in sync. */

export const FOUNDERS_OFFER = {
  enabled: true,
  plan: "essentielle" as const,
  totalSlots: 10,
  creationCents: 0,
} as const;

/* ── Plan prices (in cents, excluding tax) ── */

/* Prices live in convex/planPrices.ts — the single source of truth shared with
   the checkout and the superadmin console. Re-exported here so the existing
   `@/lib/payment-providers` import sites keep working unchanged. */
export { planPrices };

/* ── First-payment breakdown (build + 1st maintenance period) ── */

export function getFirstPaymentBreakdown(
  plan: "essentielle" | "premium",
  billingPeriod: BillingPeriod,
): { creation: number; maintenance: number; total: number } {
  const prices = planPrices[plan];
  const maintenance =
    billingPeriod === "monthly"
      ? prices.maintenanceMonthly
      : prices.maintenanceYearly;
  return {
    creation: prices.creation,
    maintenance,
    total: prices.creation + maintenance,
  };
}

/* ── Checkout totals (referral discount + VAT when it applies) ──
   The single source for the order summary and the instalment amounts, so that
   the 2x/3x/4x preview matches exactly what Stripe will charge (discount
   deducted, VAT included where applicable). */

export function getCheckoutTotals(
  plan: "essentielle" | "premium",
  billingPeriod: BillingPeriod,
  discountPercent?: number,
  /** Founders offer applies (slots remaining, no referral code) */
  foundersActive?: boolean,
): {
  creation: number;
  /** List price of the build (shown for reference under the founders offer) */
  catalogCreation: number;
  maintenance: number;
  discount: number;
  foundersApplied: boolean;
  /** pre-tax amount after discount */
  subtotal: number;
  tva: number;
  /** Amount actually charged (tax included when VAT is on, otherwise = subtotal) */
  total: number;
} {
  const { creation: catalogCreation, maintenance } = getFirstPaymentBreakdown(
    plan,
    billingPeriod,
  );
  const hasReferral = Boolean(discountPercent && discountPercent > 0);
  // No stacking: the referral code applies to the list price.
  const foundersApplied = Boolean(
    foundersActive &&
      FOUNDERS_OFFER.enabled &&
      plan === FOUNDERS_OFFER.plan &&
      !hasReferral,
  );
  const creation = foundersApplied
    ? FOUNDERS_OFFER.creationCents
    : catalogCreation;
  const discount = hasReferral
    ? Math.round((creation * discountPercent!) / 100)
    : 0;
  const subtotal = creation + maintenance - discount;
  const tva = TVA_ENABLED
    ? Math.round((subtotal * TVA_RATE_PERCENT) / 100)
    : 0;
  return {
    creation,
    catalogCreation,
    maintenance,
    discount,
    foundersApplied,
    subtotal,
    tva,
    total: subtotal + tva,
  };
}
