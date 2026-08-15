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

/* ── Matrice d'autorisation ── */
/* Le premier paiement inclut toujours la maintenance,
   donc le BNPL est toujours disponible. */

export function getAllowedPaymentMethods(
  buyerType: BuyerType,
): PaymentMethodSlug[] {
  const methods: PaymentMethodSlug[] = ["card", "alma"];
  if (buyerType === "personal") {
    methods.push("klarna");
  }
  return methods;
}

/* ── Options affichées côté UI ── */

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

/* ── Calcul montant par échéance ── */

export function getInstallmentAmount(
  totalCents: number,
  installments: number,
): number {
  return Math.ceil(totalCents / installments);
}

/* ── TVA ── */
/* Tous les prix (planPrices, pricing-data) s'entendent HT.
   Tant que la structure est en franchise en base (art. 293 B du CGI),
   le flag reste off : aucune TVA n'est ajoutée et le checkout affiche
   la mention légale. Le jour de l'assujettissement (société au réel),
   activer NEXT_PUBLIC_TVA_ENABLED=true côté Next ET STRIPE_TAX_ENABLED=true
   côté Convex (voir convex/stripe.ts) — les deux vont ensemble. */

export const TVA_ENABLED = process.env.NEXT_PUBLIC_TVA_ENABLED === "true";
export const TVA_RATE_PERCENT = 20;

/* ── Offre fondateurs ──
   10 premières créations Essentielle à 2 500 € HT (catalogue 3 500 €),
   contre contreparties contractuelles (étude de cas, témoignage, référence).
   S'éteint par épuisement des places (compteur api.orders.countFoundersSold),
   jamais par date. Non cumulable avec le parrainage : un code appliqué
   bascule sur le prix catalogue −10 %. Le prix catalogue ne change pas.
   Dupliqué dans convex/stripe.ts (foundersOffer) — garder en phase. */

export const FOUNDERS_OFFER = {
  enabled: true,
  plan: "essentielle" as const,
  totalSlots: 10,
  creationCents: 250000,
} as const;

/* ── Prix des plans (en centimes, HT) ── */

export const planPrices = {
  essentielle: {
    creation: 350000,
    maintenanceMonthly: 10000,
    maintenanceYearly: 100000,
  },
  premium: {
    creation: 750000,
    maintenanceMonthly: 20000,
    maintenanceYearly: 200000,
  },
} as const;

/* ── Détail du premier paiement (création + 1ère période maintenance) ── */

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

/* ── Totaux checkout (remise parrainage + TVA éventuelle) ──
   Source unique pour le récapitulatif et les montants d'échéances,
   afin que l'aperçu 2x/3x/4x reflète exactement ce que Stripe
   facturera (remise déduite, TVA incluse si applicable). */

export function getCheckoutTotals(
  plan: "essentielle" | "premium",
  billingPeriod: BillingPeriod,
  discountPercent?: number,
  /** Offre fondateurs applicable (places restantes, pas de code parrainage) */
  foundersActive?: boolean,
): {
  creation: number;
  /** Prix catalogue de la création (affiché en référence si fondateurs) */
  catalogCreation: number;
  maintenance: number;
  discount: number;
  foundersApplied: boolean;
  /** HT après remise */
  subtotal: number;
  tva: number;
  /** Montant réellement débité (TTC si TVA active, sinon = subtotal) */
  total: number;
} {
  const { creation: catalogCreation, maintenance } = getFirstPaymentBreakdown(
    plan,
    billingPeriod,
  );
  const hasReferral = Boolean(discountPercent && discountPercent > 0);
  // Non-cumul : le code parrainage s'applique au prix catalogue.
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
