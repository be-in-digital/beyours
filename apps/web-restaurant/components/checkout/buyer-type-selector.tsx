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
    label: "À titre personnel",
    description: "Achat en nom propre, pour un usage personnel",
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
              className={`relative h-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
                selected
                  ? "border-primary/40 bg-primary/[0.06] shadow-[0_0_20px_rgba(82,207,175,0.08)]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected
                      ? "border-primary bg-primary"
                      : "border-white/[0.2]"
                  }`}
                >
                  {selected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div>
                  <div
                    className={`text-sm font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {option.label}
                  </div>
                  <div className="text-xs text-muted-foreground/70 mt-0.5">
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
