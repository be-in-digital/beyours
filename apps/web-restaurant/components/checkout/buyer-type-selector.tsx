"use client";

import { motion } from "framer-motion";
import type { BuyerType } from "@/lib/payment-providers";

const options: { value: BuyerType; label: string; description: string }[] = [
  {
    value: "business",
    label: "Pour mon restaurant",
    description: "Achat professionnel au nom de votre établissement",
  },
  {
    value: "personal",
    label: "Restaurant en cours de création",
    description:
      "Pas encore immatriculé ? Achetez en nom propre, en attendant votre SIRET",
  },
];

export function BuyerTypeSelector({
  value,
  onChange,
}: {
  value: BuyerType;
  onChange: (type: BuyerType) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Type d&apos;achat
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <motion.button
              key={option.value}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`relative h-full text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-[color:var(--border)] bg-surface-1 hover:bg-secondary"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected
                      ? "border-primary bg-primary"
                      : "border-[color:var(--border-contrast)]"
                  }`}
                >
                  {selected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div>
                  <div
                    className={`text-sm font-medium ${selected ? "text-foreground" : "text-secondary-foreground"}`}
                  >
                    {option.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
