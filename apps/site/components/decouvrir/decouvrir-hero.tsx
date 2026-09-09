"use client";

import { motion } from "framer-motion";
import { MousePointerClick, ArrowRight, Sparkles } from "lucide-react";
import { StorefrontPreview } from "@/components/storefront-preview";
import { DiscoveryCallButton } from "./discovery-call-button";

export function DecouvrirHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Colonne texte */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-accent)] bg-primary/[0.06] px-3.5 py-1.5 text-xs font-medium text-primary-ink"
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            Démonstration interactive
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-6xl"
          >
            Ne regardez pas une démo.{" "}
            <span className="text-gradient-primary">Jouez-la.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Tournez la roue, grattez la carte, parcourez le site de commande.
            Découvrez, pour de vrai, ce que votre restaurant offrira à ses
            clients, et surtout ce que ça vous rapporte face aux plateformes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a
              href="#jeu"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-olive px-7 py-3.5 text-base font-semibold text-[color:var(--background)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <Sparkles className="h-4 w-4" />
              Essayer le jeu
            </a>
            <DiscoveryCallButton className="!bg-transparent !text-foreground !shadow-none border border-[color:var(--border-contrast)] hover:!bg-secondary">
              Réserver un appel
              <ArrowRight className="h-4 w-4" />
            </DiscoveryCallButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {[
              "0 % de commission en direct",
              "Fidélité incluse",
              "Sans installation pour vos clients",
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Visual column — the real product */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <StorefrontPreview />
          <div className="pointer-events-none absolute -right-3 -top-4 hidden rotate-6 rounded-2xl border border-[color:var(--border-accent)] bg-surface-1 px-3 py-2 text-xs font-semibold text-primary-ink shadow-[0_10px_30px_-14px_rgba(112,60,34,0.5)] sm:block">
            Site à votre marque
          </div>
        </motion.div>
      </div>
    </section>
  );
}
