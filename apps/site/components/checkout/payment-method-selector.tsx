"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import {
  getAllowedPaymentMethods,
  paymentOptions,
  getInstallmentAmount,
  type BuyerType,
  type PaymentMethodSlug,
} from "@/lib/payment-providers";

function formatEur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function PaymentMethodSelector({
  buyerType,
  amountCents,
  onSelect,
}: {
  buyerType: BuyerType;
  amountCents: number;
  onSelect: (method: PaymentMethodSlug) => void;
}) {
  const allowed = getAllowedPaymentMethods(buyerType);
  const filteredOptions = paymentOptions.filter((o) =>
    allowed.includes(o.slug),
  );

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Méthode de paiement
      </label>
      <div className="space-y-3">
        {filteredOptions.map((option) => (
          <motion.button
            key={option.slug}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(option.slug)}
            className="group w-full cursor-pointer rounded-2xl border border-[color:var(--border)] bg-surface-1 p-4 text-left shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-all hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-foreground transition-colors group-hover:text-primary-ink">
                  {option.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
              <div className="text-right">
                {option.slug === "card" ? (
                  <div className="text-base font-semibold text-foreground">
                    {formatEur(amountCents)} €
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {option.installments?.map((n) => (
                      <div key={n} className="text-xs text-muted-foreground">
                        {n}x {formatEur(getInstallmentAmount(amountCents, n))} €
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary-ink" strokeWidth={1.8} />
        Paiement sécurisé, vos données ne sont jamais stockées sur ce site.
      </div>
    </div>
  );
}
