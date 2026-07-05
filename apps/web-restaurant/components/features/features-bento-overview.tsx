"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { MobileCarousel } from "@/components/ui/mobile-carousel";
import { getFeaturesByPillar, type Feature, type Pillar } from "./features-data";

/* ═══════════════════════════════════════════════
   Features Bento Overview — 10 cards grouped by pillar
   ═══════════════════════════════════════════════ */

const pillarColors: Record<Pillar, string> = {
  attirer: "text-emerald-400/70 bg-emerald-400/10 border-emerald-400/15",
  vendre: "text-primary/70 bg-primary/10 border-primary/15",
  gerer: "text-sky-400/70 bg-sky-400/10 border-sky-400/15",
  fideliser: "text-amber-400/70 bg-amber-400/10 border-amber-400/15",
};

function PillarBadge({ pillar, label }: { pillar: Pillar; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${pillarColors[pillar]}`}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {label}
    </span>
  );
}

function BentoCard({ feature, pillarLabel }: { feature: Feature; pillarLabel: string }) {
  const scrollTo = () => {
    const el = document.getElementById(feature.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      onClick={scrollTo}
      className="text-left w-full h-full flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 sm:p-6 transition-all duration-300 group hover:border-primary/20 hover:shadow-[0_0_40px_rgba(82,207,175,0.06)] cursor-pointer"
    >
      {/* Top row: badge + tag */}
      <div className="flex items-center justify-between mb-4">
        <PillarBadge pillar={feature.pillar} label={pillarLabel} />
        <span className="text-xs font-mono text-muted-foreground/30">
          {feature.tag}
        </span>
      </div>

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/[0.08] border border-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary/70"
        >
          {getFeatureIconPath(feature.id)}
        </svg>
      </div>

      {/* Title & description */}
      <h3 className="text-sm font-semibold text-foreground mb-2 group-hover:text-primary/90 transition-colors">
        {feature.title}
      </h3>
      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        {feature.shortDescription}
      </p>

      {/* Spacer to push arrow to bottom */}
      <div className="flex-1" />

      {/* Arrow indicator for deep-dive features */}
      {feature.deepDive && (
        <div className="mt-4 flex items-center gap-1.5 text-primary/40 group-hover:text-primary/70 transition-colors">
          <span className="text-[10px] font-medium uppercase tracking-wider">
            En savoir plus
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

export function FeaturesBentoOverview() {
  const grouped = getFeaturesByPillar();

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em]">
              10 fonctionnalités,{" "}
              <span className="text-primary">une seule plateforme</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              Explorez chaque brique de votre écosystème digital.
            </p>
          </div>
        </FadeIn>

        {/* Desktop: grouped by pillar, always 2 columns for symmetry */}
        <div className="hidden md:block space-y-10">
          {grouped.map((group) => (
            <div key={group.pillar}>
              <FadeIn>
                <div className="flex items-center gap-3 mb-5">
                  <PillarBadge pillar={group.pillar} label={group.label} />
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
              </FadeIn>
              <StaggerContainer className="grid grid-cols-2 gap-4" stagger={0.08}>
                {group.features.map((feature) => (
                  <StaggerItem key={feature.id} className="flex">
                    <BentoCard feature={feature} pillarLabel={group.label} />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          ))}
        </div>

        {/* Mobile: carousel per pillar */}
        <div className="md:hidden space-y-10">
          {grouped.map((group) => (
            <div key={group.pillar}>
              <FadeIn>
                <div className="flex items-center gap-3 mb-5">
                  <PillarBadge pillar={group.pillar} label={group.label} />
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
              </FadeIn>
              <MobileCarousel>
                {group.features.map((feature) => (
                  <BentoCard
                    key={feature.id}
                    feature={feature}
                    pillarLabel={group.label}
                  />
                ))}
              </MobileCarousel>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Feature icon paths ── */

function getFeatureIconPath(id: string): React.ReactNode {
  switch (id) {
    case "site-web-premium":
      return <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></>;
    case "formation-google-business":
      return <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>;
    case "commande-en-ligne":
      return <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>;
    case "experience-mobile":
      return <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>;
    case "dashboard-administrateur":
      return <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>;
    case "gestion-menu":
      return <><path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /><path d="M10 6h4M10 10h4M10 14h2" /></>;
    case "centralisation-commandes":
      return <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>;
    case "integration-plateformes":
      return <><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></>;
    case "fidelisation-gamification":
      return <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>;
    case "analytics":
      return <><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></>;
    default:
      return <circle cx="12" cy="12" r="10" />;
  }
}
