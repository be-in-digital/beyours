/* ═══════════════════════════════════════════════
   Pricing Plans — Cards création + toggle maintenance
   ═══════════════════════════════════════════════ */

"use client";

import { useState } from "react";
import Link from "next/link";
import { plans, formatPrice, type BillingPeriod } from "./pricing-data";
import { useWhitelistModal, useDevMode } from "@/lib/store";
import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";

export function PricingPlans({ showHeader = false }: { showHeader?: boolean }) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const { open: openWaitlist } = useWhitelistModal();
  const devMode = useDevMode((s) => s.enabled);


  return (
    <section
      id="pricing"
      className="relative py-8 sm:py-12 overflow-hidden"
    >
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        {/* Optional section header (used on homepage) */}
        {showHeader && (
          <FadeIn className="text-center mb-10">
            <SectionBadge text="Tarification" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] mt-6">
              Des offres pensées pour{" "}
              <span className="text-primary">votre croissance</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Un investissement clair, sans surprise. Chaque offre inclut la
              création complète et un accompagnement continu.
            </p>
          </FadeIn>
        )}

        {/* Toggle mensuel / annuel */}
        <FadeIn className="flex items-center justify-center gap-3 mb-12">
          <span
            className={`text-sm transition-colors ${billing === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            Mensuel
          </span>
          <button
            onClick={() =>
              setBilling((b) => (b === "monthly" ? "yearly" : "monthly"))
            }
            className="relative w-14 h-7 rounded-full bg-white/[0.08] border border-white/[0.1] transition-colors cursor-pointer"
            aria-label="Basculer entre mensuel et annuel"
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-primary shadow-[0_0_12px_rgba(82,207,175,0.4)] transition-all duration-300 ${
                billing === "yearly" ? "left-[calc(100%-1.625rem)]" : "left-0.5"
              }`}
            />
          </button>
          <span
            className={`text-sm transition-colors ${billing === "yearly" ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            Annuel
          </span>
          {billing === "yearly" && (
            <span className="text-xs text-primary font-medium bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
              -2 mois offerts
            </span>
          )}
        </FadeIn>

        {/* Cards */}
        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
          stagger={0.15}
        >
          {plans.map((plan) => {
            const maintenancePrice =
              billing === "monthly"
                ? plan.maintenanceMonthly
                : plan.maintenanceYearly;
            const maintenanceLabel =
              billing === "monthly" ? "/mois" : "/an";

            return (
              <StaggerItem key={plan.slug} className="h-full">
                <div
                  className={`relative h-full rounded-2xl border p-6 sm:p-8 flex flex-col ${
                    plan.comingSoon
                      ? "border-white/[0.06] bg-white/[0.01]"
                      : plan.featured
                        ? "border-primary/30 bg-primary/[0.04] shadow-[0_0_60px_rgba(82,207,175,0.08)]"
                        : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                >
                  {/* Badge */}
                  {plan.comingSoon ? (
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-white/[0.1] border border-white/[0.15] text-muted-foreground text-xs font-semibold rounded-full">
                      À venir
                    </div>
                  ) : plan.featured ? (
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                      Recommandé
                    </div>
                  ) : null}

                  {/* Header */}
                  <div className="mb-6">
                    <h3
                      className={`text-xl font-semibold ${plan.comingSoon ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {plan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.subtitle}
                    </p>
                  </div>

                  {/* Prix création */}
                  <div className="mb-4 pb-4 border-b border-white/[0.06]">
                    <div className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-1">
                      Création
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-3xl sm:text-4xl font-bold tracking-tight ${plan.comingSoon ? "text-muted-foreground/50" : "text-foreground"}`}
                      >
                        {formatPrice(plan.creation)}&nbsp;€
                      </span>
                      <span className="text-sm text-muted-foreground">
                        paiement unique
                      </span>
                    </div>
                  </div>

                  {/* Prix maintenance */}
                  <div className="mb-6">
                    <div className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-1">
                      Maintenance
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-2xl font-bold tracking-tight ${plan.comingSoon ? "text-muted-foreground/50" : "text-foreground"}`}
                      >
                        {formatPrice(maintenancePrice)}&nbsp;€
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {maintenanceLabel}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <svg
                          className={`w-4 h-4 mt-0.5 shrink-0 ${plan.comingSoon ? "text-muted-foreground/40" : plan.featured ? "text-primary" : "text-primary/70"}`}
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M3.5 8.5L6.5 11.5L12.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span
                          className={`text-sm leading-snug ${plan.comingSoon ? "text-muted-foreground/60" : "text-muted-foreground"}`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Option design personnalisé */}
                  <div className="mb-6 px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <span className="text-xs text-muted-foreground">
                      + Option design personnalisé à partir de{" "}
                      <span className="text-foreground font-medium">500 €</span>
                    </span>
                  </div>

                  {/* CTAs */}
                  <div className="space-y-3 mt-auto">
                    {plan.comingSoon && !devMode ? (
                      <div className="w-full rounded-full py-3.5 text-sm font-medium text-center bg-white/[0.05] text-muted-foreground/60 border border-white/[0.06] cursor-default">
                        Bientôt disponible
                      </div>
                    ) : devMode ? (
                      <Link
                        href={`/checkout?plan=${plan.slug}`}
                        className={`block w-full rounded-full py-3.5 text-sm font-medium text-center transition-all duration-200 ${
                          plan.featured
                            ? "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_24px_rgba(82,207,175,0.25)]"
                            : "bg-white/[0.08] text-foreground hover:bg-white/[0.12] border border-white/[0.1]"
                        }`}
                      >
                        Choisir cette offre
                      </Link>
                    ) : (
                      <button
                        onClick={() => openWaitlist(plan.slug)}
                        className={`w-full rounded-full py-3.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
                          plan.featured
                            ? "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_24px_rgba(82,207,175,0.25)]"
                            : "bg-white/[0.08] text-foreground hover:bg-white/[0.12] border border-white/[0.1]"
                        }`}
                      >
                        S&apos;inscrire à la waitlist
                      </button>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Notes de bas */}
        <FadeIn delay={0.4}>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 5v3.5l2.5 1.5" strokeLinecap="round" />
              </svg>
              Frais de création payés une seule fois au lancement
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M3.5 8.5L6.5 11.5L12.5 4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Première année de maintenance obligatoire
            </span>
            <span className="flex items-center gap-1.5">
              TVA non applicable, art. 293 B du CGI
            </span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
