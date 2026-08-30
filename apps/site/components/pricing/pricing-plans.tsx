/* ═══════════════════════════════════════════════
   Pricing Plans — build cards + maintenance toggle
   ═══════════════════════════════════════════════ */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { plans, formatPrice, type BillingPeriod } from "./pricing-data";
import { FOUNDERS_OFFER } from "@/lib/payment-providers";
import { VAT } from "@/lib/legal/company";
import { useBookingModal, useDevMode } from "@/lib/store";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";

/* Anchor figures for the platform-commission comparison. A restaurant doing
   this much through the delivery platforms, at their top commission rate. */
const PLATFORM_MONTHLY_SALES = 8000;
const PLATFORM_COMMISSION_PERCENT = 30;

const footnoteIconProps = {
  className: "h-3.5 w-3.5",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

/* The four conditions attached to every plan. Each one carries an icon so the
   rows line up: the VAT line used to be the odd one out without one. */
const footnotes = [
  {
    label: "La création se paie une seule fois, au lancement",
    icon: (
      <svg {...footnoteIconProps}>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v3.5l2.5 1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Payable en 3 ou 4 fois avec Alma ou Klarna",
    icon: (
      <svg {...footnoteIconProps}>
        <rect x="2" y="4" width="12" height="9" rx="1.5" />
        <path d="M2 7h12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "La première année de maintenance est obligatoire",
    icon: (
      <svg {...footnoteIconProps}>
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    /* Read from VAT.regime, not from the NEXT_PUBLIC_TVA_ENABLED charging flag.
       This sentence is a claim about the company's tax position, and it was
       keyed on a deployment toggle: with the flag off under the régime réel,
       /tarifs told visitors "TVA non applicable, art. 293 B" while /cgv and
       the legal notice — which do read VAT.regime — told them the opposite on
       the same site. The regime is a legal fact; whether the checkout charges
       is a configuration, and validateSiteEnv now refuses a deployment where
       the two disagree. */
    label:
      VAT.regime === "reel"
        ? "Prix HT · TVA 20 % ajoutée au paiement, récupérable par votre établissement"
        : "TVA non applicable, art. 293 B du CGI",
    icon: (
      <svg {...footnoteIconProps}>
        <path
          d="M3.5 2.5h9v11l-2-1.2-2 1.2-2-1.2-2 1.2z"
          strokeLinejoin="round"
        />
        <path d="M6 6h4M6 8.5h4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function PricingPlans({
  showHeader = false,
  ctaMode = "call",
}: {
  showHeader?: boolean;
  /** "call" = opens the booking modal (home) · "checkout" = goes to payment (pricing page) */
  ctaMode?: "call" | "checkout";
}) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const { open: openBooking } = useBookingModal();
  const devMode = useDevMode((s) => s.enabled);
  const goCheckout = ctaMode === "checkout" || devMode;

  /* Founders offer: slots remaining, in real time */
  const foundersSold = useQuery(
    api.orders.countFoundersSold,
    FOUNDERS_OFFER.enabled ? {} : "skip",
  );
  const foundersLeft = FOUNDERS_OFFER.enabled
    ? Math.max(0, FOUNDERS_OFFER.totalSlots - (foundersSold ?? 0))
    : 0;
  const foundersLive = FOUNDERS_OFFER.enabled && foundersLeft > 0;


  return (
    <section
      id="pricing"
      className="relative py-8 sm:py-12 overflow-hidden"
    >
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        {/* Optional section header (used on homepage) */}
        {showHeader && (
          <FadeIn className="text-center mb-10">
            <p className="text-sm font-semibold text-primary">Tarification</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.9rem] font-semibold tracking-[-0.02em] leading-[1.1] mt-3">
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
            className="relative w-14 h-7 rounded-full bg-surface-3 border border-[color:var(--border)] transition-colors cursor-pointer"
            aria-label="Basculer entre mensuel et annuel"
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-primary shadow-[0_2px_8px_rgba(112,60,34,0.35)] transition-all duration-300 ${
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
            const isFounders =
              foundersLive && plan.slug === FOUNDERS_OFFER.plan;
            const creationPrice = isFounders
              ? FOUNDERS_OFFER.creationCents / 100
              : plan.creation;

            return (
              <StaggerItem key={plan.slug} className="h-full">
                <div
                  className={`relative h-full rounded-2xl border p-6 sm:p-8 flex flex-col ${
                    plan.comingSoon
                      ? "border-[color:var(--border)] bg-surface-1/60"
                      : plan.featured
                        ? "border-primary/40 bg-surface-1 shadow-[0_24px_60px_-28px_rgba(197,84,44,0.45)] ring-1 ring-primary/15"
                        : "border-[color:var(--border)] bg-surface-1 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]"
                  }`}
                >
                  {/* Badge */}
                  {plan.comingSoon ? (
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-surface-3 border border-[color:var(--border)] text-muted-foreground text-xs font-semibold rounded-full">
                      À venir
                    </div>
                  ) : isFounders ? (
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                      Offre fondateurs · {foundersLeft}{" "}
                      {foundersLeft > 1 ? "places restantes" : "place restante"}
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

                  {/* Build price */}
                  <div className="mb-4 pb-4 border-b border-[color:var(--border)]">
                    <div className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-1">
                      Création
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-3xl sm:text-4xl font-bold tracking-tight ${plan.comingSoon ? "text-muted-foreground/50" : creationPrice === 0 ? "text-primary" : "text-foreground"}`}
                      >
                        {creationPrice === 0
                          ? "Offerte"
                          : `${formatPrice(creationPrice)} €`}
                      </span>
                      {creationPrice > 0 && (
                        <span className="text-sm text-muted-foreground">
                          HT · paiement unique
                        </span>
                      )}
                    </div>
                    {isFounders && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Prix catalogue&nbsp;:{" "}
                        <span className="font-medium">
                          {formatPrice(plan.creation)}&nbsp;€&nbsp;HT
                        </span>
                        , appliqué à l&apos;épuisement des{" "}
                        {FOUNDERS_OFFER.totalSlots} places
                      </p>
                    )}
                    {creationPrice > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground/70">
                        ou 4&nbsp;×&nbsp;
                        <span className="text-foreground/90 font-medium">
                          {formatPrice(creationPrice / 4)}&nbsp;€
                        </span>{" "}
                        avec Alma, sans frais
                      </p>
                    )}
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
                        HT{maintenanceLabel}
                      </span>
                    </div>
                    {/* Spelled out as a sum: the total can land on the same
                        figure as the list creation price, and two identical
                        numbers meaning different things read as an error. */}
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      {creationPrice === 0 ? (
                        <>
                          Création offerte, vous ne payez que la maintenance
                          &nbsp;:{" "}
                          <span className="text-foreground/90 font-medium">
                            {formatPrice(plan.maintenanceYearly)}&nbsp;€&nbsp;HT
                          </span>{" "}
                          la première année, puis autant chaque année.
                        </>
                      ) : (
                        <>
                          Première année&nbsp;: {formatPrice(creationPrice)}
                          &nbsp;€ de création +{" "}
                          {formatPrice(plan.maintenanceYearly)}&nbsp;€ de
                          maintenance, soit{" "}
                          <span className="text-foreground/90 font-medium">
                            {formatPrice(creationPrice + plan.maintenanceYearly)}
                            &nbsp;€&nbsp;HT
                          </span>
                          . Puis {formatPrice(plan.maintenanceYearly)}
                          &nbsp;€&nbsp;HT/an.
                        </>
                      )}
                    </p>
                    {isFounders && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        En échange&nbsp;: une étude de cas chiffrée et un
                        témoignage publiables. Non cumulable avec un code
                        parrainage.
                      </p>
                    )}
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

                  {/* Custom design add-on */}
                  <div className="mb-6 px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-secondary">
                    <span className="text-xs text-muted-foreground">
                      + Option design personnalisé à partir de{" "}
                      <span className="text-foreground font-medium">
                        500 € HT
                      </span>
                    </span>
                  </div>

                  {/* CTAs */}
                  <div className="space-y-3 mt-auto">
                    {plan.comingSoon ? (
                      <Link
                        href="/contact"
                        className="flex w-full items-center justify-center rounded-full py-3.5 text-sm font-medium text-center bg-secondary text-secondary-foreground border border-[color:var(--border)] transition-colors hover:bg-surface-3"
                      >
                        Être prévenu au lancement
                      </Link>
                    ) : goCheckout ? (
                      <Link
                        href={`/checkout?plan=${plan.slug}`}
                        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-center transition-all duration-200 ${
                          plan.featured
                            ? "bg-primary text-primary-foreground hover:brightness-105 glow-primary"
                            : "bg-primary text-primary-foreground hover:brightness-105"
                        }`}
                      >
                        Commander cette offre
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 13L13 1M13 1H3M13 1V11" />
                        </svg>
                      </Link>
                    ) : (
                      <button
                        onClick={() => openBooking()}
                        className={`w-full rounded-full py-3.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
                          plan.featured
                            ? "bg-primary text-primary-foreground hover:brightness-105 glow-primary"
                            : "bg-surface-2 text-foreground hover:bg-surface-3 border border-[color:var(--border-contrast)]"
                        }`}
                      >
                        Réserver un appel
                      </button>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Comparison anchor — platform commissions.
            Both sides are stated per year on purpose: the earlier copy put a
            monthly commission next to a first-year cost, so the reader had to
            reconcile the units before the comparison meant anything. */}
        <FadeIn delay={0.2}>
          <div className="mt-10 rounded-2xl border border-primary/15 bg-primary/[0.03] px-6 py-5 sm:px-8 text-center">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Un restaurant qui vend{" "}
              <span className="text-foreground font-medium">
                {formatPrice(PLATFORM_MONTHLY_SALES)}&nbsp;€ par mois
              </span>{" "}
              sur les plateformes de livraison leur laisse jusqu&apos;à{" "}
              {PLATFORM_COMMISSION_PERCENT}&nbsp;% de commission, soit{" "}
              <span className="text-foreground font-medium">
                {formatPrice(
                  ((PLATFORM_MONTHLY_SALES * PLATFORM_COMMISSION_PERCENT) /
                    100) *
                    12,
                )}
                &nbsp;€ sur l&apos;année
              </span>
              .
            </p>
            <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Les mêmes commandes sur votre propre site&nbsp;:{" "}
              <span className="text-primary font-medium">
                {formatPrice(
                  (foundersLive
                    ? FOUNDERS_OFFER.creationCents / 100
                    : plans[0]!.creation) + plans[0]!.maintenanceYearly,
                )}
                &nbsp;€&nbsp;HT la première année
                {foundersLive ? " (tarif fondateurs, création offerte)" : ", maintenance comprise"}, puis{" "}
                {formatPrice(plans[0]!.maintenanceYearly)}&nbsp;€&nbsp;HT par an
              </span>
              . Et aucune commission sur vos commandes.
            </p>
          </div>
        </FadeIn>

        {/* Footnotes. These used to be a centred flex row that wrapped into a
            ragged 2 + 1 + 1 arrangement, with nothing sharing a left edge and
            labels centred on their own line. A grid keeps the same panel at
            every width: one column on mobile, two from sm. The 1px gaps show
            the panel background through, which draws the separators without a
            border on each cell. */}
        <FadeIn delay={0.4}>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-px overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--border)] text-xs text-muted-foreground sm:grid-cols-2">
            {footnotes.map((note) => (
              <li
                key={note.label}
                className="flex items-start gap-2.5 bg-surface-1 px-4 py-3"
              >
                <span className="mt-px shrink-0 text-primary/70">
                  {note.icon}
                </span>
                <span>{note.label}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </section>
  );
}
