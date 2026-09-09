"use client";

import { UtensilsCrossed } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { features, pillars, type Feature } from "./features-data";

/* ═══════════════════════════════════════════════
   Ecosystem Recap — Creative constellation layout
   Two-row circuit with animated connections
   ═══════════════════════════════════════════════ */

function FeatureNode({ feature }: { feature: Feature }) {
  return (
    <div className="group relative h-full">
      <div className="relative h-full overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 p-4 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[color:var(--border-accent)] lg:p-5">
        {/* Large watermark number */}
        <span className="pointer-events-none absolute -right-1 -top-3 select-none font-display text-[72px] font-black leading-none text-primary-ink/[0.06] transition-colors duration-500 group-hover:text-primary-ink/[0.10] lg:text-[80px]">
          {feature.tag}
        </span>

        {/* Number badge */}
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--border-accent)] bg-primary/10 transition-transform duration-300 group-hover:scale-110">
          <span className="text-sm font-bold text-primary-ink">{feature.tag}</span>
        </div>

        {/* Title */}
        <h3 className="mb-2 font-display text-[13px] font-semibold leading-tight text-foreground lg:text-sm">
          {feature.title}
        </h3>

        {/* Pillar label */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {pillars[feature.pillar].label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EcosystemRecap() {
  const sorted = [...features].sort(
    (a, b) => parseInt(a.tag) - parseInt(b.tag),
  );
  const topRow = sorted.slice(0, 5);
  const bottomRow = sorted.slice(5, 10);

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Warm halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      {/* Dot grid, faded toward edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(rgba(34,28,21,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 75%)",
        }}
      />

      {/* Top separator */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, var(--border-contrast) 50%, transparent 90%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <FadeIn>
          <div className="mb-14 text-center lg:mb-16">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary-ink">
              Écosystème complet
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl lg:text-5xl">
              Une plateforme,{" "}
              <span className="relative inline-block">
                <span className="text-primary-ink">10 fonctionnalités</span>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 right-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--primary), transparent)",
                  }}
                />
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm text-muted-foreground sm:text-base">
              Chaque brique s&apos;intègre parfaitement pour créer votre
              écosystème digital sur mesure.
            </p>
          </div>
        </FadeIn>

        {/* ── Desktop: Circuit layout ── */}
        <div className="hidden md:block">
          {/* Row 1: Features 01→05 */}
          <StaggerContainer
            className="grid grid-cols-5 gap-3 lg:gap-4"
            stagger={0.07}
          >
            {topRow.map((f) => (
              <StaggerItem key={f.id} className="h-full">
                <FeatureNode feature={f} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Connecting bridge */}
          <FadeIn delay={0.4}>
            <div className="relative my-1 flex h-20 items-center justify-center">
              {/* Horizontal line */}
              <div className="absolute inset-x-12 top-1/2 h-px overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-transparent via-[color:var(--border-contrast)] to-transparent" />
                {/* Animated shimmer */}
                <div className="ecosystem-shimmer absolute top-0 h-full w-1/4" />
              </div>

              {/* Vertical connector ticks */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="absolute bottom-0 top-0 flex flex-col items-center justify-between"
                  style={{ left: `${10 + i * 20}%` }}
                >
                  <div className="h-3 w-px bg-gradient-to-b from-[color:var(--border-contrast)] to-transparent" />
                  <div className="h-3 w-px bg-gradient-to-t from-[color:var(--border-contrast)] to-transparent" />
                </div>
              ))}

              {/* Center hub */}
              <div className="relative z-10 flex items-center gap-3 rounded-full border border-[color:var(--border-accent)] bg-surface-1 px-5 py-2.5 shadow-[0_14px_34px_-20px_rgba(197,84,44,0.5)]">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-primary text-primary-foreground">
                  <UtensilsCrossed className="h-3 w-3" strokeWidth={2} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary-ink">
                  BeYours
                </span>
                <span className="h-2 w-2 rounded-full bg-primary" />
              </div>
            </div>
          </FadeIn>

          {/* Row 2: Features 06→10 */}
          <StaggerContainer
            className="grid grid-cols-5 gap-3 lg:gap-4"
            stagger={0.07}
            delay={0.3}
          >
            {bottomRow.map((f) => (
              <StaggerItem key={f.id} className="h-full">
                <FeatureNode feature={f} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* ── Mobile: Vertical timeline ── */}
        <div className="md:hidden">
          <StaggerContainer className="relative" stagger={0.05}>
            {/* Vertical line */}
            <div className="absolute bottom-2 left-[19px] top-2 w-px">
              <div className="h-full w-full bg-gradient-to-b from-primary/40 via-primary/15 to-transparent" />
            </div>

            {sorted.map((feature) => (
              <StaggerItem
                key={feature.id}
                className="relative pb-6 pl-14 last:pb-0"
              >
                {/* Timeline dot */}
                <div className="absolute left-2.5 top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[color:var(--border-accent)] bg-surface-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>

                {/* Card */}
                <div className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-surface-1 p-4 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
                  {/* Watermark */}
                  <span className="pointer-events-none absolute right-2 top-1 select-none font-display text-[48px] font-black leading-none text-primary-ink/[0.06]">
                    {feature.tag}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-accent)] bg-primary/10">
                      <span className="text-xs font-bold text-primary-ink">
                        {feature.tag}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {pillars[feature.pillar].label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>

      {/* Bottom separator */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, var(--border-contrast) 50%, transparent 90%)",
        }}
      />
    </section>
  );
}
