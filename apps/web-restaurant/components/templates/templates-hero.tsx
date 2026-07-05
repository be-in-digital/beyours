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
      className="relative min-h-[70vh] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* ── Deep dark base ── */}
      <div className="absolute inset-0 bg-background" />

      {/* ── Spotlight ── */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
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
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] animate-[pulse_6s_ease-in-out_infinite] bg-primary/[0.06] rounded-full blur-[120px]" />
        <div className="absolute top-[15%] right-[15%] w-[250px] h-[250px] bg-primary/[0.04] rounded-full blur-[80px]" />
      </motion.div>

      {/* ── Grid ── */}
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

      {/* ── Beams ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[200px] -left-[100px] w-[1px] h-[800px] rotate-[25deg] opacity-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.15) 30%, rgba(82,207,175,0.05) 70%, transparent 100%)",
          }}
        />
        <div
          className="absolute -top-[200px] -right-[100px] w-[1px] h-[800px] -rotate-[25deg] opacity-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.15) 30%, rgba(82,207,175,0.05) 70%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Noise ── */}
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
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-32 sm:pt-36 pb-16"
        style={{ y: contentY }}
      >
        <FadeIn delay={0.1}>
          <SectionBadge text="Templates restaurant" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 className="mt-8 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-[-0.03em] leading-[1.08]">
            Un design premium pour
            <br className="hidden sm:block" />{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #52CFAF 0%, #7DDBC3 50%, #52CFAF 100%)",
              }}
            >
              chaque type de cuisine
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.35}>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Parcourez nos templates conçus sur mesure pour chaque univers de la
            restauration. Choisissez votre catégorie, personnalisez et lancez
            votre présence digitale.
          </p>
        </FadeIn>
      </motion.div>

      {/* ── Bottom vignette ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-20"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />
    </section>
  );
}
