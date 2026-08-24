"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Flame } from "lucide-react";
import { FOUNDERS_OFFER } from "@/lib/payment-providers";

/* ═══════════════════════════════════════════════
   « Offre fondateurs » banner — deliberately loud.
   Remaining slots live (the Convex countFoundersSold counter).
   Hides itself when the offer runs out or is switched off.
   ═══════════════════════════════════════════════ */

export function FoundersBanner() {
  const sold = useQuery(
    api.orders.countFoundersSold,
    FOUNDERS_OFFER.enabled ? {} : "skip",
  );
  const remaining = Math.max(0, FOUNDERS_OFFER.totalSlots - (sold ?? 0));

  if (!FOUNDERS_OFFER.enabled || (sold !== undefined && remaining === 0)) {
    return null;
  }

  const foundersPrice = FOUNDERS_OFFER.creationCents / 100;
  const scarcity =
    sold === undefined
      ? "Places limitées"
      : `${remaining} place${remaining > 1 ? "s" : ""} restante${
          remaining > 1 ? "s" : ""
        } sur ${FOUNDERS_OFFER.totalSlots}`;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-olive px-6 py-5 sm:px-8 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-cta-radial opacity-70" />
      <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary-500)]/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[color:var(--primary-300)]">
            <Flame className="h-3.5 w-3.5" />
            Offre fondateurs
          </span>
          <p className="mt-3 font-display text-2xl font-semibold leading-tight text-[color:var(--background)] sm:text-3xl">
            {foundersPrice === 0
              ? "Création offerte"
              : `${foundersPrice.toLocaleString("fr-FR")} € HT`}{" "}
            <span className="text-lg font-normal text-[color:var(--background)]/45 line-through">
              3 500 €
            </span>{" "}
            <span className="text-[color:var(--background)]/90">
              pour les 10 premiers restaurants
            </span>
          </p>
          <p className="mt-1.5 text-sm text-[color:var(--background)]/60">
            En échange d&apos;un témoignage et d&apos;une étude de cas chiffrée.
            Non cumulable avec un code de parrainage.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--primary-300)]/30 bg-[color:var(--primary-500)]/15 px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--primary-300)] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--primary-300)]" />
          </span>
          <span className="text-sm font-semibold text-[color:var(--background)]">
            {scarcity}
          </span>
        </div>
      </div>
    </div>
  );
}
