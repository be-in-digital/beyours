"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useCalendlyModal } from "@/lib/store";

// Scène 3D (braises) chargée après hydratation uniquement — jamais SSR
const HeroScene = dynamic(
  () => import("@/components/webgl/hero-scene").then((m) => m.HeroScene),
  { ssr: false },
);
import { MagneticButton } from "@/components/ui/magnetic-button";
import { RevealText } from "@/components/ui/reveal-text";
import { ContainerScroll } from "@/components/ui/container-scroll";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";

const chartHeights = [35, 55, 45, 70, 60, 85, 75, 90, 65, 80, 50, 70];
const stats = [
  { label: "Commandes", value: 1284, width: 65 },
  { label: "Revenus", value: 9450, width: 78, suffix: " €" },
  { label: "Clients", value: 842, width: 52 },
  { label: "Conversion", value: 12.4, width: 83, suffix: " %" },
];

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function HeroSection() {
  const { open: openCalendly } = useCalendlyModal();

  return (
    <section
      className="relative flex flex-col overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* ── Toile de fond cinématique : le feu de la cuisine, plein écran ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[100dvh] overflow-hidden"
      >
        <motion.div
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 12, ease: "linear" }}
          className="absolute inset-0"
        >
          <Image
            src="/photos/chef-flammes.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_center]"
          />
        </motion.div>
        {/* Scrims : zone de lecture à gauche, flamme qui respire à droite,
            fondu vers le fond du site en bas */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-transparent to-background" />
      </div>
      <div className="noise-overlay" aria-hidden="true" />

      {/* Braises — voile de particules au-dessus des flammes */}
      <HeroScene />

      {/* ── Contenu, aligné à gauche façon éditorial ── */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 min-h-[100dvh] flex flex-col justify-center pt-28 pb-24">
        <div className="max-w-3xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.05 }}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-background/40 px-3 py-1.5 text-xs backdrop-blur-md"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-muted-foreground">
            La plateforme digitale pensée pour la restauration
          </span>
        </motion.div>

        {/* Title */}
        <h1
          id="hero-title"
          className="mt-8 text-balance text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-medium tracking-[-0.035em] leading-[1.04]"
        >
          <RevealText
            as="span"
            text="Vendez en direct,"
            splitBy="word"
            stagger={0.06}
            delay={0.15}
            className="block"
          />
          <span className="block mt-2">
            <RevealText
              as="span"
              text="sans"
              splitBy="word"
              stagger={0.06}
              delay={0.35}
              className="inline-block"
            />{" "}
            <motion.span
              initial={{ opacity: 0, filter: "blur(12px)", y: "0.4em" }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.9, ease, delay: 0.9 }}
              className="inline-block font-serif italic text-primary"
            >
              commission.
            </motion.span>
          </span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 1.15 }}
          className="mt-6 text-pretty text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed"
        >
          Un site de commande en ligne d&apos;exception, à l&apos;image de
          votre établissement : vos clients commandent chez vous, vous gardez
          vos marges et vos données clients.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 1.3 }}
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
        >
          <MagneticButton
            onClick={openCalendly}
            strength={22}
            className="bg-primary text-primary-foreground px-7 py-3.5 text-base glow-primary hover:brightness-110"
          >
            Réserver un appel
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 13L13 1M13 1H3M13 1V11" />
            </svg>
          </MagneticButton>
          <Link
            href="/fonctionnalites"
            className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-white/[0.02] px-6 py-3 text-base text-foreground hover:bg-white/[0.05] hover:border-[color:var(--border-contrast)] transition-colors duration-300"
          >
            Découvrir la plateforme
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </motion.div>

        {/* Trust row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease, delay: 1.55 }}
          className="mt-8 text-xs text-muted-foreground/80 flex flex-wrap items-center gap-3"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Prix fixe, sans frais cachés
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            En ligne en 4 à 6 semaines
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Support français
          </span>
        </motion.div>
        </div>
      </div>

      {/* Dashboard — ContainerScroll 3D reveal */}
      <div className="relative z-10 -mt-10 sm:-mt-6 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <ContainerScroll>
          <div className="relative rounded-2xl border border-[color:var(--border-subtle)] bg-surface-1 overflow-hidden shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(82,207,175,0.06)]">
            <BorderBeam size={260} duration={12} colorFrom="#52cfaf" colorTo="rgba(82,207,175,0)" />

            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border-subtle)] bg-surface-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-surface-3" />
                <div className="w-3 h-3 rounded-full bg-surface-3" />
                <div className="w-3 h-3 rounded-full bg-surface-3" />
              </div>
              <div className="flex-1 mx-4">
                <div className="max-w-md mx-auto h-6 rounded-md bg-background/50 flex items-center justify-center gap-2 px-3">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70" aria-hidden="true">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    dashboard.beindigital.fr
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-md bg-surface-3/50" />
                <div className="h-5 w-5 rounded-md bg-surface-3/50" />
              </div>
            </div>

            {/* Dashboard body */}
            <div className="p-3 sm:p-5 flex gap-3 sm:gap-5 min-h-[340px] sm:min-h-[440px]">
              {/* Sidebar */}
              <aside className="hidden sm:flex flex-col gap-2 w-44 lg:w-52 p-3 rounded-xl bg-background/50 border border-[color:var(--border-subtle)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30" />
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-3/4 rounded bg-surface-3/70" />
                    <div className="h-1.5 w-1/2 rounded bg-surface-3/40" />
                  </div>
                </div>
                {[
                  { active: true, w: 75 },
                  { active: false, w: 60 },
                  { active: false, w: 80 },
                  { active: false, w: 55 },
                  { active: false, w: 70 },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={
                      "flex items-center gap-2 h-8 px-2 rounded-lg " +
                      (item.active
                        ? "bg-primary/10 border border-primary/20"
                        : "")
                    }
                  >
                    <div className={
                      "h-3 w-3 rounded " +
                      (item.active ? "bg-primary/50" : "bg-surface-3/60")
                    } />
                    <div className={
                      "h-2 rounded " +
                      (item.active ? "bg-primary/40" : "bg-surface-3/50")
                    } style={{ width: `${item.w}%` }} />
                  </div>
                ))}
                <div className="mt-auto flex items-center gap-2 p-2 rounded-lg bg-surface-2">
                  <div className="h-6 w-6 rounded-full bg-primary/30" />
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 w-3/4 rounded bg-surface-3/70" />
                    <div className="h-1 w-1/2 rounded bg-surface-3/40" />
                  </div>
                </div>
              </aside>

              {/* Main panel */}
              <div className="flex-1 flex flex-col gap-3 sm:gap-4 min-w-0">
                {/* Heading + date */}
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="h-3 w-32 rounded bg-surface-3/70" />
                    <div className="h-2 w-48 rounded bg-surface-3/40" />
                  </div>
                  <div className="h-7 w-24 rounded-md bg-surface-3/40" />
                </div>

                {/* Stats with NumberTicker */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="p-3 rounded-xl bg-background/50 border border-[color:var(--border-subtle)]"
                    >
                      <div className="text-[10px] text-muted-foreground">
                        {stat.label}
                      </div>
                      <div className="mt-1.5 text-sm font-semibold tracking-tight text-foreground">
                        <NumberTicker value={stat.value} suffix={stat.suffix} />
                      </div>
                      <div className="mt-2 h-1 w-full rounded-full bg-surface-3/30 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${stat.width}%` }}
                          viewport={{ once: true, margin: "-10%" }}
                          transition={{ duration: 1.2, ease, delay: 0.2 }}
                          className="h-full rounded-full bg-primary/50"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="flex-1 rounded-xl bg-background/50 border border-[color:var(--border-subtle)] p-3 sm:p-4 flex flex-col gap-2 min-h-[180px]">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-20 rounded bg-surface-3/60" />
                    <div className="flex gap-1.5">
                      <div className="h-5 w-12 rounded bg-primary/15 border border-primary/20" />
                      <div className="h-5 w-12 rounded bg-surface-3/30" />
                      <div className="h-5 w-12 rounded bg-surface-3/30" />
                    </div>
                  </div>
                  <div className="flex-1 flex items-end gap-1 sm:gap-1.5">
                    {chartHeights.map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        whileInView={{ height: `${h}%` }}
                        viewport={{ once: true, margin: "-15%" }}
                        transition={{
                          duration: 0.8,
                          ease,
                          delay: 0.2 + i * 0.04,
                        }}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary/15"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ContainerScroll>

        {/* Soft glow under mockup */}
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[70%] h-52 rounded-full blur-[100px] bg-primary/15 pointer-events-none"
        />
      </div>
    </section>
  );
}
