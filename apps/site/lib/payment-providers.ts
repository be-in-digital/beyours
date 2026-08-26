import { planPrices } from "@/convex/planPrices";

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
/* Every price (planPrices, pricing-data) is quoted excluding tax.
   While the company is under franchise en base (art. 293 B of the French tax
   code) the flag stays off: no VAT is added and the checkout displays the legal
   mention. The day it becomes VAT-liable (company on the régime réel), set
   NEXT_PUBLIC_TVA_ENABLED=true on the Next side AND STRIPE_TAX_ENABLED=true on
   the Convex side (see convex/stripe.ts) — the two go together. */

export const TVA_ENABLED = process.env.NEXT_PUBLIC_TVA_ENABLED === "true";
export const TVA_RATE_PERCENT = 20;

/* ── Founders offer ──
   The first 10 Essentielle builds have their creation waived entirely (list
   price 3 500 €): the client pays the annual maintenance and nothing else,
   in exchange for contractual commitments (case study, testimonial, reference).
   It ends when the slots run out (api.orders.countFoundersSold counter), never
   on a date. Not stackable with a referral: applying a code switches to the
   list price −10 %. The list price itself never changes.
   Duplicated in convex/stripe.ts (foundersOffer) — keep them in sync. */

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
