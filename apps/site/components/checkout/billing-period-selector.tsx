"use client";

import type { BillingPeriod } from "@/lib/payment-providers";

export function BillingPeriodSelector({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Fréquence de maintenance
      </label>
      <div className="flex items-center gap-3">
        <span
          className={`text-sm transition-colors ${value === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}
        >
          Mensuel
        </span>
        <button
          type="button"
          onClick={() =>
            onChange(value === "monthly" ? "yearly" : "monthly")
          }
          className="relative w-14 h-7 rounded-full bg-surface-3 border border-[color:var(--border)] transition-colors cursor-pointer"
          aria-label="Basculer entre mensuel et annuel"
        >
          <div
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-primary shadow-[0_2px_8px_rgba(112,60,34,0.35)] transition-all duration-300 ${
              value === "yearly" ? "left-[calc(100%-1.625rem)]" : "left-0.5"
            }`}
          />
        </button>
        <span
          className={`text-sm transition-colors ${value === "yearly" ? "text-foreground font-medium" : "text-muted-foreground"}`}
        >
          Annuel
        </span>
        {value === "yearly" && (
          <span className="text-xs text-primary-ink font-medium bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
            -2 mois offerts
          </span>
        )}
      </div>
    </div>
  );
}
