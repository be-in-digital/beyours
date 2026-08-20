/* ═══════════════════════════════════════════════
   Commission Calculator — platform revenue → real cost
   ═══════════════════════════════════════════════ */

"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FadeIn } from "@/components/ui/motion";
import { FOUNDERS_OFFER } from "@/lib/payment-providers";
import { formatPrice } from "./pricing-data";

/* Combined marketplace + delivery rate charged by the platforms (up to 30 %). */
const COMMISSION_RATE = 0.3;
/* Essentielle: build + 1st year of maintenance, then maintenance alone. */
const CATALOG_YEAR_ONE_COST = 4500;
const FOUNDERS_YEAR_ONE_COST = FOUNDERS_OFFER.creationCents / 100 + 1000;
const NEXT_YEARS_COST = 1000;

export function CommissionCalculator() {
  const [monthlySales, setMonthlySales] = useState(5000);

  const foundersSold = useQuery(
    api.orders.countFoundersSold,
    FOUNDERS_OFFER.enabled ? {} : "skip",
  );
  const foundersLive =
    FOUNDERS_OFFER.enabled &&
    (foundersSold ?? 0) < FOUNDERS_OFFER.totalSlots;
  const yearOneCost = foundersLive
    ? FOUNDERS_YEAR_ONE_COST
    : CATALOG_YEAR_ONE_COST;

  const monthlyCommission = Math.round(monthlySales * COMMISSION_RATE);
  const yearlyCommission = monthlyCommission * 12;
  const paybackMonths =
    monthlyCommission > 0
      ? Math.max(1, Math.ceil(yearOneCost / monthlyCommission))
      : null;

  return (
    <section className="relative py-8 sm:py-12">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-6 sm:p-10 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">
                Faites le calcul
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.02em] leading-[1.15] mt-2">
                Ce que les commissions vous coûtent vraiment
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Slider */}
              <div>
                <label
                  htmlFor="platform-sales"
                  className="text-sm font-medium text-foreground"
                >
                  Vos ventes mensuelles via les plateformes de livraison
                </label>
                <div className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
                  {formatPrice(monthlySales)}&nbsp;€
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    /mois
                  </span>
                </div>
                <input
                  id="platform-sales"
                  type="range"
                  min={0}
                  max={20000}
                  step={500}
                  value={monthlySales}
                  onChange={(e) => setMonthlySales(Number(e.target.value))}
                  className="mt-4 w-full cursor-pointer"
                  style={{ accentColor: "var(--primary)" }}
                  aria-valuetext={`${formatPrice(monthlySales)} euros par mois`}
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground/60">
                  <span>0&nbsp;€</span>
                  <span>20&nbsp;000&nbsp;€</span>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[color:var(--border)]">
                  <span className="text-sm text-muted-foreground">
                    Commissions reversées aux plateformes
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-2xl font-semibold text-primary">
                      {formatPrice(yearlyCommission)}&nbsp;€/an
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      soit {formatPrice(monthlyCommission)}&nbsp;€ chaque mois
                    </span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[color:var(--border)]">
                  <span className="text-sm text-muted-foreground">
                    Votre site en direct, commission 0&nbsp;%
                  </span>
                  <span className="text-right">
                    <span className="block text-base font-semibold text-foreground">
                      {formatPrice(yearOneCost)}&nbsp;€&nbsp;HT la 1ère année
                      {foundersLive ? " (fondateurs)" : ""}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {foundersLive ? "création offerte" : "maintenance comprise"},
                      puis {formatPrice(NEXT_YEARS_COST)}&nbsp;€&nbsp;HT/an
                    </span>
                  </span>
                </div>
                {paybackMonths !== null ? (
                  <p className="text-sm text-foreground leading-relaxed">
                    En basculant ces commandes sur votre site, l&apos;offre
                    Essentielle est{" "}
                    <span className="font-semibold text-primary">
                      rentabilisée en{" "}
                      {paybackMonths === 1
                        ? "1 mois"
                        : `${paybackMonths} mois`}
                    </span>
                    {yearlyCommission > yearOneCost && (
                      <>
                        , et vous gardez{" "}
                        <span className="font-semibold">
                          {formatPrice(yearlyCommission - yearOneCost)}
                          &nbsp;€
                        </span>{" "}
                        de marge dès la première année
                      </>
                    )}
                    .
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Déplacez le curseur pour estimer ce que les plateformes
                    prélèvent sur vos ventes.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-8 text-xs text-muted-foreground/60 leading-relaxed">
              Estimation indicative basée sur une commission de 30&nbsp;%
              (marketplace + livraison), hors frais fixes des plateformes. Les
              commandes passées en direct sur votre site ne supportent aucune
              commission.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
