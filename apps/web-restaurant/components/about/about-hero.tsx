"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";
import { useCalendlyModal } from "@/lib/store";

/* ═══════════════════════════════════════════════
   About Hero — Immersive, cinematic, alive
   ═══════════════════════════════════════════════ */

export function AboutHero() {
  const { open: openCalendly } = useCalendlyModal();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Parallax layers
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
    >
      {/* ── Layer 0: Deep dark base ── */}
      <div className="absolute inset-0 bg-background" />

      {/* ── Layer 1: Lamp / Spotlight from top ── */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        {/* Central spotlight cone */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[900px]"
          style={{
            background:
              "conic-gradient(from 180deg at 50% 0%, transparent 30%, rgba(82,207,175,0.06) 45%, rgba(82,207,175,0.12) 50%, rgba(82,207,175,0.06) 55%, transparent 70%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
          }}
        />

        {/* Breathing central glow */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] animate-[pulse_6s_ease-in-out_infinite] bg-primary/[0.06] rounded-full blur-[120px]" />

        {/* Secondary warm glow for richness */}
        <div className="absolute top-[20%] left-[30%] w-[300px] h-[300px] animate-[pulse_8s_ease-in-out_infinite_1s] bg-white/[0.02] rounded-full blur-[80px]" />

        {/* Ambient orbs */}
        <div className="absolute top-[15%] right-[15%] w-[250px] h-[250px] bg-primary/[0.04] rounded-full blur-[80px]" />
        <div className="absolute bottom-[20%] left-[10%] w-[350px] h-[350px] bg-primary/[0.03] rounded-full blur-[100px]" />
      </motion.div>

      {/* ── Layer 2: Animated grid floor ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(82,207,175,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(82,207,175,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          backgroundPosition: "center center",
          maskImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, black 0%, transparent 100%)",
        }}
      />

      {/* ── Layer 3: Background beams ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Diagonal beam left */}
        <div
          className="absolute -top-[200px] -left-[100px] w-[1px] h-[800px] rotate-[25deg] opacity-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.15) 30%, rgba(82,207,175,0.05) 70%, transparent 100%)",
          }}
        />
        {/* Diagonal beam right */}
        <div
          className="absolute -top-[200px] -right-[100px] w-[1px] h-[800px] -rotate-[25deg] opacity-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.15) 30%, rgba(82,207,175,0.05) 70%, transparent 100%)",
          }}
        />
        {/* Center beam */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-[500px] opacity-60"
          style={{
            background:
              "linear-gradient(to bottom, rgba(82,207,175,0.2) 0%, rgba(82,207,175,0.06) 60%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Layer 4: Floating decorative elements ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating ring — left */}
        <motion.div
          className="absolute top-[25%] left-[8%] w-20 h-20 rounded-full border border-primary/10 sm:block hidden"
          animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Floating ring — right */}
        <motion.div
          className="absolute top-[35%] right-[10%] w-14 h-14 rounded-full border border-primary/[0.07] sm:block hidden"
          animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Floating dot cluster */}
        <motion.div
          className="absolute bottom-[30%] right-[20%] sm:block hidden"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/20" />
            <div className="w-2 h-2 rounded-full bg-primary/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/15" />
          </div>
        </motion.div>
        {/* Floating diamond — left */}
        <motion.div
          className="absolute bottom-[35%] left-[15%] w-4 h-4 rotate-45 border border-primary/10 sm:block hidden"
          animate={{ y: [0, 10, 0], rotate: [45, 50, 45] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      </div>

      {/* ── Layer 5: Noise texture ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* ── Content ── */}
      <motion.div
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-32 sm:pt-36"
        style={{ y: contentY }}
      >
        {/* Badge */}
        <FadeIn delay={0.1}>
          <SectionBadge text="À propos de Be in Digital" />
        </FadeIn>

        {/* Headline with gradient text */}
        <FadeIn delay={0.2}>
          <h1 className="mt-8 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-[-0.03em] leading-[1.08]">
            Une équipe au service
            <br className="hidden sm:block" />
            de la{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #52CFAF 0%, #7DDBC3 50%, #52CFAF 100%)",
              }}
            >
              restauration digitale
            </span>
          </h1>
        </FadeIn>

        {/* Subtitle */}
        <FadeIn delay={0.35}>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Derrière Be in Digital, il y a des passionnés du digital et de la
            restauration qui croient qu&apos;un restaurant mérite une présence en
            ligne à la hauteur de son assiette.
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.5}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={openCalendly}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 shadow-[0_0_30px_rgba(82,207,175,0.25),0_0_80px_rgba(82,207,175,0.08)] cursor-pointer"
            >
              Nous contacter
              <svg
                width="16"
                height="16"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 13L13 1M13 1H3M13 1V11" />
              </svg>
            </button>
            <a
              href="#story"
              className="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Découvrir notre histoire
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>
        </FadeIn>
      </motion.div>

      {/* ── Floating glass card — central visual anchor ── */}
      <FadeIn delay={0.65} className="relative z-10 mt-16 sm:mt-20 mb-12 px-4 sm:px-6 w-full max-w-4xl mx-auto">
        <motion.div
          className="relative"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative rounded-2xl border border-primary/15 bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10 overflow-hidden shadow-[0_0_60px_rgba(82,207,175,0.06)]">
            {/* Inner glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/[0.06] rounded-full blur-[60px] pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
              {/* Pillar 1 */}
              <div className="text-center sm:text-left">
                <div className="inline-flex w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Restaurant-first</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Chaque fonctionnalité est pensée pour les réalités du terrain.
                </p>
              </div>

              {/* Pillar 2 — with separator */}
              <div className="text-center sm:text-left sm:border-x sm:border-white/[0.06] sm:px-6">
                <div className="inline-flex w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Design premium</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Une image digitale qui reflète la qualité de votre établissement.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="text-center sm:text-left">
                <div className="inline-flex w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Accompagnement</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Une équipe dédiée du cadrage initial à la montée en puissance.
                </p>
              </div>
            </div>
          </div>

          {/* Glow under card */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 bg-primary/[0.06] rounded-full blur-[40px] pointer-events-none" />
        </motion.div>
      </FadeIn>

      {/* ── Bottom vignette ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-20"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />

      {/* ── Scroll indicator ── */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-6 h-10 rounded-full border border-white/20 flex items-start justify-center p-1.5">
          <motion.div
            className="w-1 h-2 rounded-full bg-primary/60"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
