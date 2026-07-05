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
    description: "Payez en 3x (achat personnel uniquement)",
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

/* ── Prix des plans (en centimes) ── */

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
