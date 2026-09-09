"use client";

import {
  Globe,
  Star,
  ShoppingBag,
  Smartphone,
  LayoutGrid,
  BookOpen,
  Layers,
  Zap,
  Trophy,
  BarChart3,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { MobileCarousel } from "@/components/ui/mobile-carousel";
import { getFeaturesByPillar, type Feature } from "./features-data";

/* ═══════════════════════════════════════════════
   Features Bento Overview — 10 cards grouped by pillar
   ═══════════════════════════════════════════════ */

const featureIcons: Record<string, LucideIcon> = {
  "site-web-premium": Globe,
  "formation-google-business": Star,
  "commande-en-ligne": ShoppingBag,
  "experience-mobile": Smartphone,
  "dashboard-administrateur": LayoutGrid,
  "gestion-menu": BookOpen,
  "centralisation-commandes": Layers,
  "integration-plateformes": Zap,
  "fidelisation-gamification": Trophy,
  analytics: BarChart3,
};

function PillarBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-accent)] bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-ink">
      <span className="h-1 w-1 rounded-full bg-primary" />
      {label}
    </span>
  );
}

function BentoCard({
  feature,
  pillarLabel,
}: {
  feature: Feature;
  pillarLabel: string;
}) {
  const Icon = featureIcons[feature.id] ?? Star;

  const scrollTo = () => {
    const el = document.getElementById(feature.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      onClick={scrollTo}
      className="group flex h-full w-full flex-col rounded-2xl border border-[color:var(--border)] bg-surface-1 p-5 text-left shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--border-accent)] sm:p-6"
    >
      {/* Top row: badge + tag */}
      <div className="mb-4 flex items-center justify-between">
        <PillarBadge label={pillarLabel} />
        <span className="font-mono text-xs tabular-nums text-muted-foreground/60">
          {feature.tag}
        </span>
      </div>

      {/* Icon */}
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary-ink transition-colors group-hover:bg-primary/15">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </div>

      {/* Title & description */}
      <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        {feature.title}
        {feature.notYetAvailable && (
          <span className="inline-flex items-center rounded-full border border-[color:var(--info-border)] bg-[color:var(--info-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[color:var(--info)]">
            {feature.notYetAvailable.label}
          </span>
        )}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {feature.shortDescription}
      </p>

      {/* Spacer to push arrow to bottom */}
      <div className="flex-1" />

      {/* Arrow indicator for deep-dive features */}
      {feature.deepDive && (
        <div className="mt-4 flex items-center gap-1.5 text-primary-ink/70 transition-colors group-hover:text-primary-ink">
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            En savoir plus
          </span>
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.2}
          />
        </div>
      )}
    </button>
  );
}

export function FeaturesBentoOverview() {
  const grouped = getFeaturesByPillar();

  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl lg:text-4xl">
              10 fonctionnalités,{" "}
              <span className="text-primary-ink">une seule plateforme</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              Explorez chaque brique de votre écosystème digital.
            </p>
          </div>
        </FadeIn>

        {/* Desktop: grouped by pillar, always 2 columns for symmetry */}
        <div className="hidden space-y-10 md:block">
          {grouped.map((group) => (
            <div key={group.pillar}>
              <FadeIn>
                <div className="mb-5 flex items-center gap-3">
                  <PillarBadge label={group.label} />
                  <div className="h-px flex-1 bg-[color:var(--border)]" />
                </div>
              </FadeIn>
              <StaggerContainer
                className="grid grid-cols-2 gap-4"
                stagger={0.08}
              >
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
        <div className="space-y-10 md:hidden">
          {grouped.map((group) => (
            <div key={group.pillar}>
              <FadeIn>
                <div className="mb-5 flex items-center gap-3">
                  <PillarBadge label={group.label} />
                  <div className="h-px flex-1 bg-[color:var(--border)]" />
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
