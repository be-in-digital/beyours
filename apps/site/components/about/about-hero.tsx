"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChefHat, Sparkles, Users, ArrowUpRight, ArrowDown } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";
import { useBookingModal } from "@/lib/store";

/* ═══════════════════════════════════════════════
   About Hero — warm food-editorial
   ═══════════════════════════════════════════════ */

const pillars = [
  {
    Icon: ChefHat,
    title: "Restaurant-first",
    description:
      "Chaque fonctionnalité est pensée pour les réalités du terrain.",
  },
  {
    Icon: Sparkles,
    title: "Design premium",
    description:
      "Une image digitale qui reflète la qualité de votre établissement.",
  },
  {
    Icon: Users,
    title: "Accompagnement",
    description:
      "Une équipe dédiée du cadrage initial à la montée en puissance.",
  },
];

export function AboutHero() {
  const { open: openBooking } = useBookingModal();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24"
    >
      {/* Warm halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-radial"
      />

      {/* Content */}
      <motion.div
        className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6"
        style={{ y: contentY }}
      >
        <FadeIn delay={0.1}>
          <SectionBadge text="À propos de BeYours" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-balance text-foreground sm:text-5xl lg:text-6xl">
            Une équipe au service
            <br className="hidden sm:block" />
            de la <span className="text-primary-ink">restauration digitale</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.35}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Derrière BeYours, il y a des passionnés du digital et de la
            restauration qui croient qu&apos;un restaurant mérite une présence en
            ligne à la hauteur de son assiette.
          </p>
        </FadeIn>

        <FadeIn delay={0.5}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => openBooking()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition-all duration-200 hover:brightness-105"
            >
              Nous contacter
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <a
              href="#story"
              className="inline-flex items-center gap-2 text-base text-secondary-foreground transition-colors duration-200 hover:text-primary-ink"
            >
              Découvrir notre histoire
              <ArrowDown className="h-4 w-4" strokeWidth={1.8} />
            </a>
          </div>
        </FadeIn>
      </motion.div>

      {/* Three-pillar card — central visual anchor */}
      <FadeIn
        delay={0.65}
        className="relative z-10 mx-auto mt-16 w-full max-w-4xl px-4 sm:mt-20 sm:px-6"
      >
        <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-8 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] sm:p-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {pillars.map((pillar, i) => {
              const { Icon } = pillar;
              return (
                <div
                  key={pillar.title}
                  className={`text-center sm:text-left ${
                    i === 1
                      ? "sm:border-x sm:border-[color:var(--border)] sm:px-6"
                      : ""
                  }`}
                >
                  <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary-ink">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
