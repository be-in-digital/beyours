"use client";

import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn, BlurIn } from "@/components/ui/motion";
import { features, pillarOrder, pillars } from "./features-data";

/* ═══════════════════════════════════════════════
   Features Hero — Double orbit visualization
   ═══════════════════════════════════════════════ */

const pillarIcons: Record<string, React.ReactNode> = {
  attirer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  ),
  vendre: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  gerer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  fideliser: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
};

const featureIcons: Record<string, string> = {
  "site-web-premium": "W",
  "formation-google-business": "G",
  "commande-en-ligne": "C",
  "experience-mobile": "M",
  "dashboard-administrateur": "D",
  "gestion-menu": "M",
  "centralisation-commandes": "U",
  "integration-plateformes": "I",
  "fidelisation-gamification": "F",
  analytics: "A",
};

export function FeaturesHero() {
  return (
    <section className="relative py-20 sm:py-28 lg:py-36 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060608]" />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/[0.04] rounded-full blur-[100px] pointer-events-none" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: "radial-gradient(rgba(82,207,175,0.12) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 20%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* Text */}
        <div className="text-center mb-16 lg:mb-20">
          <FadeIn direction="down">
            <SectionBadge text="Fonctionnalités" />
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-semibold tracking-[-0.03em] leading-[1.08] mt-4">
              Tout ce qu&apos;il faut pour{" "}
              <span className="text-primary">digitaliser</span>
              <br className="hidden sm:block" /> votre restaurant
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Une plateforme complète organisée autour de 4 piliers pour attirer,
              vendre, gérer et fidéliser.
            </p>
          </FadeIn>

          {/* Pillar pills */}
          <FadeIn delay={0.3} className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {pillarOrder.map((key) => (
              <div
                key={key}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-muted-foreground"
              >
                <span className="text-primary/70">{pillarIcons[key]}</span>
                <span>{pillars[key].label}</span>
              </div>
            ))}
          </FadeIn>
        </div>

        {/* Orbit visualization — Desktop only */}
        <BlurIn className="hidden lg:block">
          <div className="relative w-[600px] h-[600px] mx-auto">
            {/* Outer orbit ring */}
            <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
            {/* Inner orbit ring */}
            <div className="absolute inset-[100px] rounded-full border border-white/[0.06]" />

            {/* Central orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_60px_rgba(82,207,175,0.15)] z-20">
              <span className="text-xs font-semibold text-primary tracking-wider">BID</span>
            </div>

            {/* Glow behind orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/[0.08] rounded-full blur-[40px] pointer-events-none" />

            {/* Inner ring: 4 Pillars */}
            <div className="absolute inset-0 animate-[spin_60s_linear_infinite_reverse]">
              {pillarOrder.map((key, i) => {
                const angle = (i / 4) * 2 * Math.PI - Math.PI / 2;
                const radius = 200;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <div
                    key={key}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${x}px - 32px)`,
                      top: `calc(50% + ${y}px - 32px)`,
                    }}
                  >
                    {/* Counter-rotate to keep text upright */}
                    <div className="animate-[spin_60s_linear_infinite]">
                      <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col items-center justify-center gap-1 backdrop-blur-sm shadow-lg">
                        <span className="text-primary/80">{pillarIcons[key]}</span>
                        <span className="text-[8px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                          {pillars[key].label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Outer ring: 10 Features */}
            <div className="absolute inset-0 animate-[spin_90s_linear_infinite]">
              {features.map((feature, i) => {
                const angle = (i / features.length) * 2 * Math.PI - Math.PI / 2;
                const radius = 280;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <div
                    key={feature.id}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${x}px - 18px)`,
                      top: `calc(50% + ${y}px - 18px)`,
                    }}
                  >
                    {/* Counter-rotate */}
                    <div className="animate-[spin_90s_linear_infinite_reverse]">
                      <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-muted-foreground/50 hover:text-primary/70 hover:border-primary/20 transition-colors">
                        {featureIcons[feature.id] ?? feature.tag}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BlurIn>

        {/* Mobile: 2x2 Pillar grid */}
        <div className="lg:hidden grid grid-cols-2 gap-3 mt-4">
          {pillarOrder.map((key, i) => (
            <FadeIn key={key} delay={0.1 * i}>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 mb-3 text-primary/80">
                  {pillarIcons[key]}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {pillars[key].label}
                </div>
                <div className="text-[11px] text-muted-foreground/60 mt-1">
                  {pillars[key].description}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
      />
    </section>
  );
}
