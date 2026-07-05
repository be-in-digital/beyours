"use client";

import Link from "next/link";
import { useCalendlyModal } from "@/lib/store";
import { FadeIn } from "@/components/ui/motion";
import { MagneticButton } from "@/components/ui/magnetic-button";

function CtaContent() {
  const { open: openCalendly } = useCalendlyModal();

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
      {/* Decorative badge */}
      <FadeIn direction="down">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/[0.06] mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
          <span className="text-xs text-primary/80 font-medium">
            Appel découverte gratuit &bull; Sans engagement
          </span>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <h2 className="text-balance text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-medium tracking-[-0.03em] leading-[1.08]">
          Prêt à vendre{" "}
          <span className="font-serif italic text-primary">sans commission</span>&nbsp;?
        </h2>
      </FadeIn>
      <FadeIn delay={0.2}>
        <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Réservez un appel : on fait le point sur votre présence digitale,
          on vous montre le produit en direct et on chiffre ce que la vente
          sans commission changerait pour votre restaurant.
        </p>
      </FadeIn>

      <FadeIn delay={0.3} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <MagneticButton
          onClick={openCalendly}
          strength={24}
          className="bg-primary text-primary-foreground px-8 py-4 text-base glow-primary hover:brightness-110"
        >
          Réserver un appel
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 13L13 1M13 1H3M13 1V11" />
          </svg>
        </MagneticButton>
        <Link
          href="/templates"
          className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-white/[0.02] px-6 py-3 text-sm text-foreground hover:bg-white/[0.05] hover:border-[color:var(--border-contrast)] transition-colors duration-300"
        >
          Voir des exemples de sites
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </FadeIn>
    </div>
  );
}

export function CtaSection() {
  return (
    <section id="cta" className="relative py-20 sm:py-32 lg:py-44 overflow-hidden">
      {/* ── Deep dark base ── */}
      <div className="absolute inset-0 bg-[#060608]" />

      {/* ── Perspective grid floor ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(82,207,175,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(82,207,175,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          backgroundPosition: "center center",
          transform: "perspective(500px) rotateX(55deg) translateY(100px)",
          transformOrigin: "center top",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 80%)",
        }}
      />

      {/* ── Vertical light streaks ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Center beam */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-[2px] h-full"
          style={{
            background: "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.12) 30%, rgba(82,207,175,0.06) 60%, transparent 100%)",
          }}
        />
        {/* Left beam */}
        <div
          className="absolute left-[20%] top-0 w-px h-full"
          style={{
            background: "linear-gradient(to bottom, transparent 10%, rgba(82,207,175,0.05) 40%, transparent 80%)",
          }}
        />
        {/* Right beam */}
        <div
          className="absolute right-[20%] top-0 w-px h-full"
          style={{
            background: "linear-gradient(to bottom, transparent 10%, rgba(82,207,175,0.05) 40%, transparent 80%)",
          }}
        />
        {/* Far left beam */}
        <div
          className="absolute left-[8%] top-0 w-px h-full opacity-50"
          style={{
            background: "linear-gradient(to bottom, transparent 20%, rgba(82,207,175,0.04) 50%, transparent 90%)",
          }}
        />
        {/* Far right beam */}
        <div
          className="absolute right-[8%] top-0 w-px h-full opacity-50"
          style={{
            background: "linear-gradient(to bottom, transparent 20%, rgba(82,207,175,0.04) 50%, transparent 90%)",
          }}
        />
      </div>

      {/* ── Central glow orb ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none">
        <div className="absolute inset-0 bg-primary/[0.06] rounded-full blur-[80px]" />
        <div className="absolute inset-[15%] bg-primary/[0.04] rounded-full blur-[80px]" />
      </div>

      {/* ── Top horizontal light streak ── */}
      <div
        className="absolute top-[30%] left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 10%, rgba(82,207,175,0.08) 30%, rgba(82,207,175,0.15) 50%, rgba(82,207,175,0.08) 70%, transparent 90%)",
        }}
      />
      {/* ── Bottom horizontal light streak ── */}
      <div
        className="absolute bottom-[30%] left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 15%, rgba(82,207,175,0.06) 35%, rgba(82,207,175,0.1) 50%, rgba(82,207,175,0.06) 65%, transparent 85%)",
        }}
      />

      {/* ── Corner glow accents ── */}
      <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-primary/[0.02] rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary/[0.02] rounded-full blur-[60px] pointer-events-none" />

      {/* ── Dot pattern overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: "radial-gradient(rgba(82,207,175,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 20%, transparent 70%)",
        }}
      />

      {/* ── Content ── */}
      <CtaContent />

      {/* ── Bottom fade to background ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />
      {/* ── Top fade from background ── */}
      <div
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to top, transparent, var(--background))",
        }}
      />
    </section>
  );
}
