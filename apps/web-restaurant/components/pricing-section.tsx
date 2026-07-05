"use client";

import { useState } from "react";
import { SectionBadge } from "@/components/ui/section-badge";
import { useWhitelistModal } from "@/lib/store";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";

type BillingPeriod = "monthly" | "yearly";

const plans = [
  {
    name: "Essentielle",
    subtitle: "Site web restaurant",
    description:
      "Une solution complète pour disposer d'une présence digitale moderne, professionnelle et performante.",
    creation: 3500,
    maintenanceYearly: 1000,
    maintenanceMonthly: 100,
    featured: true,
    features: [
      "Site vitrine premium à votre image",
      "Optimisé mobile, tablette & desktop",
      "Menu digital consultable en ligne",
      "Hébergement sécurisé & nom de domaine inclus",
      "Commande en ligne & click and collect",
      "Programme de fidélité intégré",
      "Référencement local Google (SEO)",
      "Campagnes email marketing",
      "Formation à Google Business Profile",
    ],
  },
  {
    name: "Premium",
    subtitle: "Site web + application mobile",
    description:
      "Une offre complète pour les restaurants qui souhaitent disposer d'un site web professionnel et d'une application mobile sur iOS et Android.",
    creation: 7500,
    maintenanceYearly: 2000,
    maintenanceMonthly: 200,
    featured: false,
    features: [
      "Tout ce qui est inclus dans l'Essentielle",
      "Application mobile native iOS & Android",
      "Notifications push pour vos clients",
      "Dashboard analytics & suivi des performances",
      "Expérience de marque unifiée web + mobile",
      "Mises à jour prioritaires & support dédié",
    ],
  },
];

function formatPrice(n: number) {
  return n.toLocaleString("fr-FR");
}

export function PricingSection() {
  const [billing, setBilling] = useState<BillingPeriod>("yearly");

  return (
    <section id="pricing" className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/[0.02] rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <FadeIn>
          <SectionBadge text="Tarification" />
          <div className="text-center max-w-3xl mx-auto mt-6 mb-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
              Des offres pensées pour{" "}
              <span className="text-primary">votre croissance</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Un investissement clair, sans surprise. Chaque offre inclut la
              création complète et un accompagnement continu.
            </p>
          </div>
        </FadeIn>

        {/* Billing toggle */}
        <FadeIn delay={0.1} className="flex items-center justify-center gap-3 mb-12 lg:mb-16">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              billing === "monthly"
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground/80 border border-transparent"
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              billing === "yearly"
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-foreground/80 border border-transparent"
            }`}
          >
            Annuel
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              -2 mois
            </span>
          </button>
        </FadeIn>

        {/* Pricing cards */}
        <StaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8 items-stretch" stagger={0.12}>
          {plans.map((plan) => (
            <StaggerItem key={plan.name} className="flex">
              <PricingCard plan={plan} billing={billing} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Option complémentaire */}
        <FadeIn delay={0.1} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-6 sm:p-8">
          {/* Subtle top line */}
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(82,207,175,0.2), transparent)",
            }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Option complémentaire —{" "}
                  <span className="text-primary">Design personnalisé</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                  Pour les restaurants souhaitant une identité visuelle plus
                  poussée et un design davantage aligné sur leur image de marque.
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium">
                À partir de
              </span>
              <div className="text-2xl font-semibold text-foreground mt-0.5">
                500 <span className="text-base text-muted-foreground">€</span>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Footnotes */}
        <FadeIn delay={0.15} className="mt-8 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-center gap-4 sm:gap-10">
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span className="text-sm text-foreground/70">Frais de création inclus dans la première facture</span>
          </div>
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span className="text-sm text-foreground/70">Première année de maintenance obligatoire</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-foreground/50">TVA non applicable, art. 293 B du CGI</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════
   Pricing Card
   ════════════════════════════════════════════════ */

function PricingCard({
  plan,
  billing,
}: {
  plan: (typeof plans)[number];
  billing: BillingPeriod;
}) {
  const { open } = useWhitelistModal();
  const maintenancePrice =
    billing === "yearly" ? plan.maintenanceYearly : plan.maintenanceMonthly;
  const period = billing === "yearly" ? "/ an" : "/ mois";

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 group flex flex-col flex-1 ${
        plan.featured
          ? "border border-primary/20 bg-white/[0.03] backdrop-blur-md shadow-[0_0_60px_rgba(82,207,175,0.06)]"
          : "border border-white/[0.06] bg-white/[0.02] backdrop-blur-md"
      }`}
    >
      {/* Top neon line */}
      <div
        className={`absolute top-0 left-0 right-0 h-px ${
          plan.featured ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition-opacity duration-300`}
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(82,207,175,0.5), transparent)",
        }}
      />

      {/* Glow on featured card */}
      {plan.featured && (
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/[0.04] rounded-full blur-[80px] pointer-events-none" />
      )}

      <div className="relative p-6 sm:p-8 flex flex-col flex-1">
        {/* Badge for featured */}
        {plan.featured && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/[0.08] mb-5 self-start">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[11px] font-medium text-primary/80 uppercase tracking-wider">
              Recommandée
            </span>
          </div>
        )}

        {/* Plan name */}
        <div className="mb-4">
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground">
            {plan.name}
          </h3>
          <p className="text-sm text-primary/70 font-medium mt-1">
            {plan.subtitle}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {plan.description}
        </p>

        {/* Pricing */}
        <div className="space-y-3 mb-8">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
              {formatPrice(maintenancePrice)}
            </span>
            <span className="text-base text-muted-foreground">
              € {period}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              +{" "}
              <span className="text-foreground/80 font-medium">
                {formatPrice(plan.creation)} €
              </span>{" "}
              de mise en service (1<sup>ère</sup> facture)
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="h-px mb-6"
          style={{
            background: plan.featured
              ? "linear-gradient(90deg, transparent, rgba(82,207,175,0.15), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />

        {/* Features */}
        <ul className="space-y-3 mb-8">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-primary/60 shrink-0 mt-0.5"
              >
                <path
                  d="M5 12l5 5L20 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Spacer to push CTA to bottom */}
        <div className="flex-1" />

        {/* CTA */}
        <button
          onClick={() => open(plan.name.toLowerCase() as "essentielle" | "premium")}
          className={`inline-flex items-center justify-center w-full gap-2 rounded-full px-6 py-3.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
            plan.featured
              ? "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_20px_rgba(82,207,175,0.2)]"
              : "bg-white/[0.05] text-foreground border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12]"
          }`}
        >
          S&apos;inscrire à la waitlist
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 13L13 1M13 1H3M13 1V11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
