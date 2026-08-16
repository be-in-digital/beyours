"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useCalendlyModal } from "@/lib/store";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { RevealText } from "@/components/ui/reveal-text";
import { StorefrontPreview } from "@/components/storefront-preview";
import { Tilt3D } from "@/components/ui/tilt-3d";

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

const trust = [
  "Prix fixe, sans frais cachés",
  "En ligne en 4 à 6 semaines",
  "Support français",
];

export function HeroSection() {
  const { open: openCalendly } = useCalendlyModal();

  return (
    <section
      className="relative overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* Warm halo, very soft */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-hero-radial"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-8 pt-24 pb-14 sm:gap-10 lg:grid-cols-[1fr_1.02fr] lg:gap-10 lg:pb-20 lg:pt-28">
          {/* ── Colonne texte ── */}
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.05 }}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-surface-1 px-3.5 py-1.5 text-xs font-medium text-secondary-foreground shadow-sm"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Pensé pour les restaurateurs indépendants
            </motion.div>

            <h1
              id="hero-title"
              className="mt-6 font-display text-[2.5rem] font-semibold leading-[1.03] tracking-[-0.02em] text-balance sm:text-5xl lg:text-[3.5rem]"
            >
              <RevealText
                as="span"
                text="Vendez en direct,"
                splitBy="word"
                stagger={0.06}
                delay={0.12}
                className="block"
              />
              <span className="mt-1 block text-primary">
                <RevealText
                  as="span"
                  text="sans commission."
                  splitBy="word"
                  stagger={0.06}
                  delay={0.4}
                  className="inline-block"
                />
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.85 }}
              className="mt-6 max-w-md text-lg leading-relaxed text-secondary-foreground text-pretty"
            >
              Un site de commande en ligne à l&apos;image de votre
              établissement. Vos clients commandent chez vous, vous gardez vos
              marges et vos données.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 1 }}
              className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <MagneticButton
                onClick={openCalendly}
                strength={20}
                className="glow-primary bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground hover:brightness-105"
              >
                Réserver un appel
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 13L13 1M13 1H3M13 1V11" />
                </svg>
              </MagneticButton>
              <Link
                href="/templates"
                className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--border-contrast)] bg-surface-1 px-6 py-3 text-base font-medium text-foreground transition-colors duration-300 hover:bg-secondary"
              >
                Voir un exemple de site
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          </div>

          {/* ── Colonne produit ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.3 }}
            className="relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:max-w-none lg:justify-self-end"
          >
            <Tilt3D maxTilt={8}>
              <StorefrontPreview />
            </Tilt3D>
          </motion.div>
        </div>
      </div>

      {/* Reassurance strip, below the hero */}
      <div className="relative border-y border-[color:var(--border)] bg-surface-1/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-4 sm:px-6">
          {trust.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
