"use client";

import { LayoutGrid, BookOpen, Star, Check, type LucideIcon } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { compactFeatures, pillars } from "./features-data";

/* ═══════════════════════════════════════════════
   Compact Block — "Et aussi..." for secondary features
   ═══════════════════════════════════════════════ */

const compactIcons: Record<string, LucideIcon> = {
  "dashboard-administrateur": LayoutGrid,
  "gestion-menu": BookOpen,
  "formation-google-business": Star,
};

export function FeaturesCompactBlock() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      {/* Top separator */}
      <div
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-[color:var(--border)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mb-10 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Et aussi…
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Des fonctionnalités essentielles intégrées nativement dans la
              plateforme.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer
          className="grid grid-cols-1 gap-5 sm:grid-cols-3"
          stagger={0.1}
        >
          {compactFeatures.map((feature) => {
            const Icon = compactIcons[feature.id] ?? Star;
            return (
              <StaggerItem key={feature.id} className="flex">
                <div
                  id={feature.id}
                  className="flex-1 rounded-2xl border border-[color:var(--border)] bg-surface-1 p-6 scroll-mt-24 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]"
                >
                  {/* Pillar badge */}
                  <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-accent)] bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-ink">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    {pillars[feature.pillar].label}
                  </span>

                  {/* Icon */}
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary-ink">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </div>

                  <h3 className="mb-2 font-display text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    {feature.shortDescription}
                  </p>

                  {/* Benefits as bullets */}
                  <ul className="space-y-2">
                    {feature.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-ink"
                          strokeWidth={2.4}
                        />
                        <span className="text-xs text-secondary-foreground">
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
