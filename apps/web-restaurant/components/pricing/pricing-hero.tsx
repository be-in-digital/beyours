/* ═══════════════════════════════════════════════
   Pricing Hero — Badge + titre + sous-titre + pattern
   ═══════════════════════════════════════════════ */

import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn } from "@/components/ui/motion";

export function PricingHero() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 overflow-hidden">
      {/* ── Background layers ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Central glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px]"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(82,207,175,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(rgba(82,207,175,0.15) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(ellipse 50% 60% at 50% 40%, black 10%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 50% 60% at 50% 40%, black 10%, transparent 70%)",
          }}
        />

        {/* Horizontal light streak */}
        <div
          className="absolute top-[55%] left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 10%, rgba(82,207,175,0.1) 30%, rgba(82,207,175,0.18) 50%, rgba(82,207,175,0.1) 70%, transparent 90%)",
          }}
        />

        {/* Vertical center beam */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-px h-full"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.08) 30%, rgba(82,207,175,0.04) 70%, transparent 100%)",
          }}
        />

        {/* Side glows */}
        <div className="absolute top-[20%] left-[10%] w-[250px] h-[250px] bg-primary/[0.03] rounded-full blur-[80px]" />
        <div className="absolute top-[15%] right-[10%] w-[200px] h-[200px] bg-primary/[0.03] rounded-full blur-[60px]" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <FadeIn direction="down">
          <SectionBadge text="Tarifs" />
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-[-0.03em] leading-[1.08]">
            Des tarifs clairs,{" "}
            <span className="text-primary">sans surprise</span>
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
