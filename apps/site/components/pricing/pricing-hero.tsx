/* ═══════════════════════════════════════════════
   Pricing Hero — badge + title + subtitle + pattern
   ═══════════════════════════════════════════════ */

import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn } from "@/components/ui/motion";

export function PricingHero() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 overflow-hidden">
      {/* ── Background ── */}
      <div aria-hidden="true" className="absolute inset-0 bg-hero-radial pointer-events-none" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      {/* ── Content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <FadeIn direction="down">
          <SectionBadge text="Tarifs" />
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.02em] leading-[1.06] mt-4">
            Des tarifs clairs,{" "}
            <span className="text-primary-ink">sans surprise</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Un paiement unique pour la création de votre solution, puis une
            maintenance transparente pour un accompagnement dans la durée.
          </p>
        </FadeIn>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />
    </section>
  );
}
