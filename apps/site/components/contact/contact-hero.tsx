"use client";

import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

export function ContactHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
      {/* Warm halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-radial"
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <FadeIn delay={0.1}>
          <SectionBadge text="Contact" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-balance text-foreground sm:text-5xl lg:text-6xl">
            Parlons de votre <span className="text-primary-ink">projet digital</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.35}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Une question, un projet, une idée ? Notre équipe est là pour vous
            accompagner. Choisissez le moyen qui vous convient le mieux.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
