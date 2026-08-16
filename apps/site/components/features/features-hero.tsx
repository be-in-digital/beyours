"use client";

import {
  Globe,
  ShoppingBag,
  Settings,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn, BlurIn } from "@/components/ui/motion";
import { Orbit3D } from "./orbit-3d";
import { pillarOrder, pillars, type Pillar } from "./features-data";

/* ═══════════════════════════════════════════════
   Features Hero — ecosystem in a 3D orbit (warm)
   ═══════════════════════════════════════════════ */

const pillarIcons: Record<Pillar, LucideIcon> = {
  attirer: Globe,
  vendre: ShoppingBag,
  gerer: Settings,
  fideliser: Heart,
};

export function FeaturesHero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
      {/* Warm halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-radial"
      />

      {/* Dot pattern, faded toward edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(rgba(34,28,21,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 50% 50% at 50% 50%, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 50% at 50% 50%, black 20%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Text */}
        <div className="mb-16 text-center lg:mb-20">
          <FadeIn direction="down">
            <SectionBadge text="Fonctionnalités" />
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-4xl lg:text-5xl xl:text-6xl">
              Tout ce qu&apos;il faut pour{" "}
              <span className="text-primary">digitaliser</span>
              <br className="hidden sm:block" /> votre restaurant
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Une plateforme complète organisée autour de 4 piliers pour attirer,
              vendre, gérer et fidéliser.
            </p>
          </FadeIn>

          {/* Pillar pills */}
          <FadeIn
            delay={0.3}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {pillarOrder.map((key) => {
              const Icon = pillarIcons[key];
              return (
                <div
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-surface-1 px-4 py-2 text-sm text-secondary-foreground shadow-[0_6px_18px_-14px_rgba(112,60,34,0.4)]"
                >
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                  <span>{pillars[key].label}</span>
                </div>
              );
            })}
          </FadeIn>
        </div>

        {/* Ecosystem in a 3D orbit — desktop only */}
        <BlurIn className="hidden lg:block">
          <Orbit3D />
        </BlurIn>

        {/* Mobile: 2x2 Pillar grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:hidden">
          {pillarOrder.map((key, i) => {
            const Icon = pillarIcons[key];
            return (
              <FadeIn key={key} delay={0.1 * i}>
                <div className="h-full rounded-2xl border border-[color:var(--border)] bg-surface-1 p-4 text-center shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {pillars[key].label}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {pillars[key].description}
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
