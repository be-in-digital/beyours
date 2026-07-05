"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { features, pillars, type Pillar, type Feature } from "./features-data";

/* ═══════════════════════════════════════════════
   Ecosystem Recap — Creative constellation layout
   Two-row circuit with animated connections
   ═══════════════════════════════════════════════ */

const pillarStyle: Record<
  Pillar,
  { text: string; bg: string; border: string; glow: string; glowHex: string }
> = {
  attirer: {
    text: "text-emerald-400",
    bg: "bg-emerald-400",
    border: "border-emerald-400/20",
    glow: "rgba(52,211,153,0.12)",
    glowHex: "rgba(52,211,153,0.4)",
  },
  vendre: {
    text: "text-primary",
    bg: "bg-primary",
    border: "border-primary/20",
    glow: "rgba(82,207,175,0.12)",
    glowHex: "rgba(82,207,175,0.4)",
  },
  gerer: {
    text: "text-sky-400",
    bg: "bg-sky-400",
    border: "border-sky-400/20",
    glow: "rgba(56,189,248,0.12)",
    glowHex: "rgba(56,189,248,0.4)",
  },
  fideliser: {
    text: "text-amber-400",
    bg: "bg-amber-400",
    border: "border-amber-400/20",
    glow: "rgba(251,191,36,0.12)",
    glowHex: "rgba(251,191,36,0.4)",
  },
};

function FeatureNode({ feature }: { feature: Feature }) {
  const style = pillarStyle[feature.pillar];

  return (
    <div className="group relative h-full">
      {/* Hover glow backdrop */}
      <div
        className="absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none"
        style={{ backgroundColor: style.glow }}
      />

      <div className="relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 lg:p-5 transition-all duration-300 group-hover:border-white/[0.12] group-hover:bg-white/[0.05] overflow-hidden">
        {/* Large watermark number */}
        <span className="absolute -top-3 -right-1 text-[72px] lg:text-[80px] font-black leading-none text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500 select-none pointer-events-none">
          {feature.tag}
        </span>

        {/* Accent glow line on top edge */}
        <div
          className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(90deg, transparent, ${style.glowHex}, transparent)`,
          }}
        />

        {/* Number badge */}
        <div
          className={`w-11 h-11 rounded-xl ${style.border} border bg-white/[0.03] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}
        >
          <span className={`text-sm font-bold ${style.text}`}>
            {feature.tag}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[13px] lg:text-sm font-semibold text-foreground/90 mb-2 leading-tight group-hover:text-foreground transition-colors">
          {feature.title}
        </h3>

        {/* Pillar label */}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${style.bg} opacity-50`} />
          <span className="text-[10px] text-muted-foreground/35 uppercase tracking-wider font-medium">
            {pillars[feature.pillar].label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EcosystemRecap() {
  const sorted = [...features].sort(
    (a, b) => parseInt(a.tag) - parseInt(b.tag)
  );
  const topRow = sorted.slice(0, 5);
  const bottomRow = sorted.slice(5, 10);

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060608]" />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none" />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(rgba(82,207,175,0.12) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 75%)",
        }}
      />

      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, rgba(82,207,175,0.08) 50%, transparent 90%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <FadeIn>
          <div className="text-center mb-14 lg:mb-16">
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary/50 font-medium mb-4">
              Écosystème complet
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-semibold tracking-[-0.03em] leading-tight">
              Une plateforme,{" "}
              <span className="relative inline-block">
                <span className="text-primary">10 fonctionnalités</span>
                <span
                  className="absolute -bottom-1.5 left-0 right-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(82,207,175,0.4), transparent)",
                  }}
                />
              </span>
            </h2>
            <p className="mt-5 text-sm sm:text-base text-muted-foreground/50 max-w-lg mx-auto">
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
            <div className="relative h-20 flex items-center justify-center my-1">
              {/* Horizontal line */}
              <div className="absolute inset-x-12 top-1/2 h-px overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
                {/* Animated shimmer */}
                <div className="absolute top-0 h-full w-1/4 ecosystem-shimmer" />
              </div>

              {/* Vertical connector ticks */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-between"
                  style={{ left: `${10 + i * 20}%` }}
                >
                  <div className="w-px h-3 bg-gradient-to-b from-white/[0.06] to-transparent" />
                  <div className="w-px h-3 bg-gradient-to-t from-white/[0.06] to-transparent" />
                </div>
              ))}

              {/* Center hub */}
              <div className="relative z-10 flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#0c0c10]/90 border border-primary/15 backdrop-blur-md shadow-[0_0_40px_rgba(82,207,175,0.06)]">
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                <span className="text-[11px] font-semibold text-primary/80 tracking-[0.15em] uppercase">
                  Be in Digital
                </span>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
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
            {/* Vertical glowing line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px">
              <div className="w-full h-full bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />
            </div>

            {sorted.map((feature) => (
              <StaggerItem
                key={feature.id}
                className="relative pl-14 pb-6 last:pb-0"
              >
                {/* Timeline dot */}
                <div className="absolute left-2.5 top-3 w-[18px] h-[18px] rounded-full bg-[#0c0c10] border-2 border-primary/25 flex items-center justify-center">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${pillarStyle[feature.pillar].bg} opacity-70`}
                  />
                </div>

                {/* Card */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 relative overflow-hidden">
                  {/* Watermark */}
                  <span className="absolute top-1 right-2 text-[48px] font-black text-white/[0.02] select-none pointer-events-none leading-none">
                    {feature.tag}
                  </span>

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${pillarStyle[feature.pillar].border} border bg-white/[0.03] flex items-center justify-center shrink-0`}
                    >
                      <span
                        className={`text-xs font-bold ${pillarStyle[feature.pillar].text}`}
                      >
                        {feature.tag}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {feature.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-1 h-1 rounded-full ${pillarStyle[feature.pillar].bg} opacity-50`}
                        />
                        <span className="text-[10px] text-muted-foreground/35 uppercase tracking-wider">
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
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, rgba(82,207,175,0.08) 50%, transparent 90%)",
        }}
      />
    </section>
  );
}
