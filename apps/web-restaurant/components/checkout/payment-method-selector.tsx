"use client";

import { motion } from "framer-motion";
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
            className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all hover:border-primary/30 hover:bg-primary/[0.03] cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {option.label}
                </div>
                <div className="text-xs text-muted-foreground/70 mt-0.5">
                  {option.description}
                </div>
              </div>
              <div className="text-right">
                {option.slug === "card" ? (
                  <div className="text-sm font-semibold text-foreground">
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
    </div>
  );
}
