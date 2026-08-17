"use client";

import Link from "next/link";
import Image from "next/image";
import { useCalendlyModal } from "@/lib/store";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { MagicCard } from "@/components/ui/magic-card";
import { SectionBadge } from "@/components/ui/section-badge";

/* Univers restauration — photos locales (licence Unsplash) */
const moods = [
  {
    src: "/photos/plat-gastronomie.webp",
    alt: "Dressage d'un plat gastronomique en cuisine",
    label: "Bistronomie & gastro",
  },
  {
    src: "/photos/burger-premium.webp",
    alt: "Burger gourmet sur fond sombre",
    label: "Fast food premium",
  },
  {
    src: "/photos/salle-restaurant2.webp",
    alt: "Table dressée dans une salle de restaurant à l'ambiance chaleureuse",
    label: "Bistrot & café",
  },
];

/* ═══════════════════════════════════════════════
   Proof section — « jugez sur pièce »
   No placeholder testimonials and no figures nobody
   can check: we point at what a visitor can verify
   (templates, live demo, public pricing).
   ═══════════════════════════════════════════════ */

/* ── Component ── */

interface ProofItem {
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: boolean;
}

export function SocialProofSection() {
  const { open: openCalendly } = useCalendlyModal();

  const proofs: ProofItem[] = [
    {
      title: "Parcourez les modèles",
      description:
        "Des maquettes complètes par type d'établissement — pizzeria, gastro, fast food, café. Ce que vous voyez est ce que vous obtenez.",
      cta: "Voir les modèles",
      href: "/templates",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="14" rx="2" />
          <path d="M3 8h18M8 21h8" />
        </svg>
      ),
    },
    {
      title: "Voyez le produit en direct",
      description:
        "Lors de l'appel, on vous montre le dashboard, le parcours de commande et la gestion du menu — en conditions réelles, pas en slides.",
      cta: "Réserver un appel",
      onClick: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 9l5 3-5 3V9z" />
        </svg>
      ),
    },
    {
      title: "Comparez les tarifs",
      description:
        "Tout est public : prix de création, maintenance détaillée, ce qui est inclus et ce qui ne l'est pas. Aucune surprise au devis.",
      cta: "Voir les tarifs",
      href: "/tarifs",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
  ];

  return (
    <section
      className="relative py-16 sm:py-24 lg:py-32 overflow-hidden"
      aria-labelledby="social-proof-title"
    >
      {/* Ambient glow */}
      <div aria-hidden="true" className="absolute inset-0 bg-section-radial pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <FadeIn>
          <div className="text-center">
            <SectionBadge text="Jugez sur pièce" />
          </div>
          <div className="text-center max-w-3xl mx-auto mt-6 mb-12">
            <h2
              id="social-proof-title"
              className="text-balance text-3xl sm:text-4xl lg:text-5xl font-medium tracking-[-0.03em] leading-[1.08]"
            >
              La meilleure preuve&nbsp;?{" "}
              <span className="font-serif italic text-primary">Le produit.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Pas de longs discours&nbsp;: regardez exactement ce que vous
              achetez avant de nous parler — les maquettes, le produit et les
              prix sont publics.
            </p>
          </div>
        </FadeIn>

        {/* Restaurant world — asymmetric editorial composition */}
        <StaggerContainer
          className="grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-2 gap-4 lg:gap-5 mb-12 lg:mb-14"
          stagger={0.1}
        >
          {moods.map((mood, index) => (
            <StaggerItem
              key={mood.src}
              className={index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}
            >
              <Link
                href="/templates"
                className={`group relative block h-full rounded-2xl overflow-hidden border border-[color:var(--border-subtle)] ${
                  index === 0 ? "aspect-[4/3] sm:aspect-auto sm:min-h-full" : "aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[180px]"
                }`}
              >
                <Image
                  src={mood.src}
                  alt={mood.alt}
                  fill
                  sizes={index === 0 ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, 33vw"}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {/* Bottom gradient + label */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/90">
                    {mood.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Voir le template
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
                {/* Subtle mint ring on hover */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-primary/0 group-hover:ring-primary/30 transition-all duration-300 pointer-events-none" />
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Proof cards */}
        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6"
          stagger={0.12}
        >
          {proofs.map((proof) => (
            <StaggerItem key={proof.title} className="h-full">
              <MagicCard className="h-full p-6 sm:p-7 flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mb-5 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:text-primary">
                  {proof.icon}
                </div>

                <h3 className="text-base font-medium text-foreground">
                  {proof.title}
                </h3>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed flex-1">
                  {proof.description}
                </p>

                <div className="mt-6 pt-5 border-t border-[color:var(--border-subtle)]">
                  {proof.onClick ? (
                    <button
                      onClick={openCalendly}
                      className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:brightness-110 transition-all cursor-pointer"
                    >
                      {proof.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <Link
                      href={proof.href!}
                      className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:brightness-110 transition-all"
                    >
                      {proof.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </MagicCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
