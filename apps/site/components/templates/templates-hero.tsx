"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

export function TemplatesHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden"
    >
      {/* ── Warm paper base ── */}
      <div className="absolute inset-0 bg-background" />

      {/* ── Terracotta halo ── */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-radial"
        style={{ y: bgY }}
      />

      {/* ── Grain ── */}
      <div className="noise-overlay" aria-hidden="true" />

      {/* ── Content ── */}
      <motion.div
        className="relative z-10 mx-auto max-w-5xl px-4 pt-32 pb-16 text-center sm:px-6 sm:pt-36"
        style={{ y: contentY }}
      >
        <FadeIn delay={0.1}>
          <SectionBadge text="Modèles restaurant" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 className="mt-8 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
            Un design premium pour
            <br className="hidden sm:block" />{" "}
            <span className="text-primary-ink">chaque type de cuisine</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.35}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            50 directions artistiques, dix par univers — pizzeria, fast-food,
            food truck, poulet, asiatique. De vraies captures des sites livrés,
            personnalisables à vos couleurs.
          </p>
        </FadeIn>
      </motion.div>

      {/* ── Bottom fade to page ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />
    </section>
  );
}
