"use client";

import { BadgeCheck } from "lucide-react";
import {
  getCheckoutTotals,
  TVA_ENABLED,
  TVA_RATE_PERCENT,
  type BillingPeriod,
} from "@/lib/payment-providers";

function formatEur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR");
}

export function OrderSummary({
  plan,
  billingPeriod,
  discountPercent,
  foundersActive,
}: {
  plan: "essentielle" | "premium";
  billingPeriod: BillingPeriod;
  discountPercent?: number;
  foundersActive?: boolean;
}) {
  const {
    creation,
    catalogCreation,
    maintenance,
    discount,
    foundersApplied,
    subtotal,
    tva,
    total,
  } = getCheckoutTotals(plan, billingPeriod, discountPercent, foundersActive);
  const planLabel = plan === "essentielle" ? "Essentielle" : "Premium";
  const periodLabel = billingPeriod === "monthly" ? "1er mois" : "1ère année";

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-5 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
      <h3 className="text-sm font-medium text-foreground mb-3">
        Récapitulatif
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Offre</span>
          <span className="text-foreground font-medium">{planLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {foundersApplied ? "Création · Offre fondateurs" : "Création"}
          </span>
          <span className="text-foreground">{formatEur(creation)} €</span>
        </div>
        {foundersApplied && (
          <p className="text-[11px] text-muted-foreground -mt-1">
            Prix catalogue : {formatEur(catalogCreation)} € · en échange
            d&apos;une étude de cas et d&apos;un témoignage
          </p>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-primary">
              Réduction parrainage (-{discountPercent}%)
            </span>
            <span className="text-primary">-{formatEur(discount)} €</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Maintenance ({periodLabel})
          </span>
          <span className="text-foreground">{formatEur(maintenance)} €</span>
        </div>
        <div className="border-t border-[color:var(--border)] my-2" />
        {TVA_ENABLED ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span className="text-foreground">{formatEur(subtotal)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                TVA ({TVA_RATE_PERCENT} %)
              </span>
              <span className="text-foreground">{formatEur(tva)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground font-medium">Total TTC</span>
              <span className="text-foreground font-semibold text-base">
                {formatEur(total)} €
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              TVA récupérable pour votre établissement.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-foreground font-medium">Total</span>
              <span className="text-foreground font-semibold text-base">
                {formatEur(total)} €
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Prix indiqués hors taxes.
            </p>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
        <BadgeCheck className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        Votre site en direct, 0 % de commission sur vos commandes.
      </div>
    </div>
  );
}
