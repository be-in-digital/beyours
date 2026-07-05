"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

export function ContactHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

  return (
    <section
      ref={sectionRef}
      className="relative pt-32 sm:pt-40 pb-20 sm:pb-28 overflow-hidden"
    >
      {/* Background layers */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ y: bgY }}
      >
        {/* Spotlight */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[800px]"
          style={{
            background:
              "conic-gradient(from 180deg at 50% 0%, transparent 32%, rgba(82,207,175,0.05) 46%, rgba(82,207,175,0.1) 50%, rgba(82,207,175,0.05) 54%, transparent 68%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 30%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 30%, transparent 100%)",
          }}
        />
        {/* Breathing glow */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] animate-[pulse_6s_ease-in-out_infinite] bg-primary/[0.05] rounded-full blur-[100px]" />
        {/* Side orbs */}
        <div className="absolute top-[20%] right-[10%] w-[200px] h-[200px] bg-primary/[0.03] rounded-full blur-[80px]" />
        <div className="absolute top-[30%] left-[8%] w-[250px] h-[250px] bg-primary/[0.02] rounded-full blur-[80px]" />
      </motion.div>

      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(82,207,175,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(82,207,175,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse 40% 35% at 50% 30%, black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 40% 35% at 50% 30%, black 0%, transparent 100%)",
        }}
      />

      {/* Center beam */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-[400px] pointer-events-none opacity-50"
        style={{
          background:
            "linear-gradient(to bottom, rgba(82,207,175,0.2) 0%, rgba(82,207,175,0.04) 70%, transparent 100%)",
        }}
      />

      {/* Noise */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <FadeIn delay={0.1}>
          <SectionBadge text="Contact" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 className="mt-8 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-[-0.03em] leading-[1.08]">
            Parlons de votre{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #52CFAF 0%, #7DDBC3 50%, #52CFAF 100%)",
              }}
            >
              projet digital
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.35}>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Une question, un projet, une idée ? Notre équipe est là pour vous
            accompagner. Choisissez le moyen qui vous convient le mieux.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
