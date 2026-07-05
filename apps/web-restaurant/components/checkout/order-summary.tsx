"use client";

import {
  getFirstPaymentBreakdown,
  type BillingPeriod,
} from "@/lib/payment-providers";

function formatEur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR");
}

export function OrderSummary({
  plan,
  billingPeriod,
  discountPercent,
}: {
  plan: "essentielle" | "premium";
  billingPeriod: BillingPeriod;
  discountPercent?: number;
}) {
  const { creation, maintenance, total } = getFirstPaymentBreakdown(
    plan,
    billingPeriod,
  );
  const discountAmountCents =
    discountPercent && discountPercent > 0
      ? Math.round(creation * discountPercent / 100)
      : 0;
  const finalTotal = total - discountAmountCents;
  const planLabel = plan === "essentielle" ? "Essentielle" : "Premium";
  const periodLabel = billingPeriod === "monthly" ? "1er mois" : "1ère année";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h3 className="text-sm font-medium text-foreground mb-3">
        Récapitulatif
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Offre</span>
          <span className="text-foreground font-medium">{planLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mise en service</span>
          <span className="text-foreground">{formatEur(creation)} €</span>
        </div>
        {discountAmountCents > 0 && (
          <div className="flex justify-between">
            <span className="text-primary">
              Réduction parrainage (-{discountPercent}%)
            </span>
            <span className="text-primary">
              -{formatEur(discountAmountCents)} €
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Maintenance ({periodLabel})
          </span>
          <span className="text-foreground">{formatEur(maintenance)} €</span>
        </div>
        <div className="border-t border-white/[0.06] my-2" />
        <div className="flex justify-between">
          <span className="text-foreground font-medium">Total</span>
          <span className="text-foreground font-semibold text-base">
            {formatEur(finalTotal)} €
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          TVA non applicable, art. 293 B du CGI
        </p>
      </div>
    </div>
  );
}
