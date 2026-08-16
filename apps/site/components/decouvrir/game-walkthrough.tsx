"use client";

import {
  QrCode,
  Star,
  Sparkles,
  Ticket,
  Repeat,
  Share2,
  Users,
} from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";

/* ═══════════════════════════════════════════════
   Step-by-step storyboard + why the game system is worth it.
   The model: ONE action = ONE play, on every visit (the loyalty loop).
   ═══════════════════════════════════════════════ */

const STEPS = [
  {
    icon: QrCode,
    title: "Il scanne le QR",
    body: "À table, en attendant sa commande. Le jeu s'ouvre, sans app.",
  },
  {
    icon: Star,
    title: "Il fait une action",
    body: "Un avis Google. Une seule action, pas dix. Puis il joue.",
  },
  {
    icon: Sparkles,
    title: "Il joue",
    body: "Roue ou carte à gratter. Taux de gain piloté par vous.",
  },
  {
    icon: Ticket,
    title: "Il gagne un lot",
    body: "Reçu par email en QR code, à retirer chez vous.",
  },
  {
    icon: Repeat,
    title: "Il revient",
    body: "Prochaine visite : nouvelle action, nouvelle partie.",
  },
  {
    icon: Share2,
    title: "Il vous recommande",
    body: "Devenu habitué, il parraine ses amis pour rejouer.",
  },
];

const VALUE = [
  {
    icon: Repeat,
    title: "Une action par visite, et il revient",
    body: "Le client revient pour rejouer. Vous récoltez avis, abonnés puis parrainages, un par visite, sans jamais le lasser. C'est une machine à fidéliser.",
    source: "Fidéliser coûte 5 à 7× moins que d'acquérir (Bain & Company)",
  },
  {
    icon: Star,
    title: "Chaque partie = un avis en plus",
    body: "Une étoile de plus sur Google, c'est jusqu'à 5 à 9 % de chiffre d'affaires supplémentaire pour un indépendant.",
    source: "Étude Harvard, Michael Luca (2011)",
  },
  {
    icon: Users,
    title: "Vous possédez le client",
    body: "Emails et contacts opt-in atterrissent dans votre base. Vous les relancez gratuitement, sans commission, à vie.",
    source: "Contact opt-in, base propriétaire",
  },
];

export function GameWalkthrough() {
  return (
    <div className="mt-20">
      {/* Storyboard */}
      <FadeIn>
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-primary">
          La boucle qui fait revenir vos clients
        </p>
      </FadeIn>
      <StaggerContainer className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <StaggerItem key={s.title}>
              <div className="relative h-full rounded-2xl border border-[color:var(--border)] bg-surface-1 p-4">
                <span className="absolute right-3 top-3 font-display text-xs font-bold text-primary/40">
                  {i + 1}
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {s.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* Why this works so well */}
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {VALUE.map((v, i) => {
          const Icon = v.icon;
          return (
            <FadeIn key={v.title} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-[color:var(--border)] bg-gradient-to-b from-primary/[0.04] to-transparent p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_rgba(197,84,44,0.7)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h4 className="mt-4 font-display text-lg font-semibold leading-snug">
                  {v.title}
                </h4>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {v.body}
                </p>
                <p className="mt-4 border-t border-[color:var(--border)] pt-3 text-[11px] font-medium text-muted-foreground/70">
                  {v.source}
                </p>
              </div>
            </FadeIn>
          );
        })}
      </div>

      {/* Callout concurrence gamification */}
      <FadeIn>
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-[color:var(--border-accent)] bg-primary/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-foreground">
            <span className="font-semibold">
              Ailleurs, une simple roue de collecte d&apos;avis se loue 49 à 226
              €/mois
            </span>{" "}
            (Drimify, Easypromos, Qualifio…), déconnectée de votre site. Ici,
            elle est incluse et branchée sur votre commande en ligne et votre
            fidélité.
          </p>
          <span className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Incluse, 0 €/mois en plus
          </span>
        </div>
      </FadeIn>
    </div>
  );
}
