/* ═══════════════════════════════════════════════
   Social Proof — Logo marquee + Stats + Testimonials
   ═══════════════════════════════════════════════ */

"use client";

import { SectionBadge } from "@/components/ui/section-badge";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { MagicCard } from "@/components/ui/magic-card";
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion";

/* ── Data ── */

const stats = [
  { value: 15, suffix: "+", label: "Restaurants accompagnés" },
  { value: 98, suffix: " %", label: "Taux de satisfaction" },
  { value: 3, suffix: "×", label: "Plus de commandes directes" },
  { value: 24, suffix: " h", label: "Support réactif" },
];

const partners = [
  "Le Comptoir Libanais",
  "Maison Soba",
  "Pizzeria Napoli",
  "Bistrot Colette",
  "Les Halles de Lyon",
  "Burger House",
  "L'Atelier du Chef",
  "Table d'Hôte",
];

const testimonials = [
  {
    quote:
      "Depuis qu'on a lancé notre site avec Be in Digital, nos commandes directes ont explosé. On ne dépend plus des plateformes pour exister en ligne.",
    name: "Karim B.",
    role: "Gérant",
    restaurant: "Le Comptoir Libanais",
    avatar: "K",
  },
  {
    quote:
      "Le design est à la hauteur de notre cuisine. Pour la première fois, notre présence digitale reflète vraiment ce qu'on fait en salle.",
    name: "Sophie M.",
    role: "Co-fondatrice",
    restaurant: "Maison Soba",
    avatar: "S",
  },
  {
    quote:
      "L'accompagnement fait toute la différence. Ce n'est pas juste un prestataire, c'est un vrai partenaire qui comprend la restauration.",
    name: "David L.",
    role: "Propriétaire",
    restaurant: "Pizzeria Napoli",
    avatar: "D",
  },
];

/* ── Component ── */

export function SocialProofSection() {
  return (
    <section
      className="relative py-16 sm:py-24 lg:py-32 overflow-hidden"
      aria-labelledby="social-proof-title"
    >
      {/* Ambient glow */}
      <div aria-hidden="true" className="absolute inset-0 bg-section-radial pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <FadeIn>
          <div className="text-center">
            <SectionBadge text="Ils nous font confiance" />
          </div>
          <div className="text-center max-w-3xl mx-auto mt-6 mb-12">
            <h2
              id="social-proof-title"
              className="text-balance text-3xl sm:text-4xl lg:text-5xl font-medium tracking-[-0.03em] leading-[1.08]"
            >
              Des restaurateurs qui{" "}
              <span className="font-serif italic text-primary">transforment</span>{" "}
              leur business
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Ils ont choisi Be in Digital pour reprendre le contrôle de leur
              présence digitale. Voici ce qu&apos;ils en disent.
            </p>
          </div>
        </FadeIn>

        {/* Partner marquee */}
        <FadeIn delay={0.05}>
          <div className="relative mb-12 lg:mb-16 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <Marquee duration={45} gap="3rem" repeat={3}>
              {partners.map((name) => (
                <span
                  key={name}
                  className="text-sm sm:text-base font-medium text-muted-foreground/60 whitespace-nowrap hover:text-foreground transition-colors duration-300"
                >
                  {name}
                </span>
              ))}
            </Marquee>
          </div>
        </FadeIn>

        {/* Stats bar with NumberTicker */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 mb-14 lg:mb-18">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative text-center py-6 px-4 rounded-2xl border border-[color:var(--border-subtle)] bg-white/[0.02]"
              >
                <div className="text-3xl sm:text-4xl font-semibold text-primary tracking-tight tabular-nums">
                  <NumberTicker value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-1.5 text-xs sm:text-sm text-muted-foreground/70">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Testimonial cards */}
        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6"
          stagger={0.12}
        >
          {testimonials.map((t) => (
            <StaggerItem key={t.name} className="h-full">
              <MagicCard className="h-full p-6 sm:p-7 flex flex-col">
                <svg
                  className="w-8 h-8 text-primary/30 mb-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M11.3 2.6C6.1 5.1 3 9.3 3 14c0 3.3 2.2 6 5 6 2.5 0 4.5-2 4.5-4.5S10.5 11 8 11c-.4 0-.8 0-1.2.1C7.4 7.5 9.5 4.8 12.5 3.4L11.3 2.6zM22.3 2.6C17.1 5.1 14 9.3 14 14c0 3.3 2.2 6 5 6 2.5 0 4.5-2 4.5-4.5S21.5 11 19 11c-.4 0-.8 0-1.2.1 .6-3.6 2.7-6.3 5.7-7.7L22.3 2.6z" />
                </svg>

                <p className="text-sm sm:text-[15px] text-foreground/85 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[color:var(--border-subtle)]">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {t.avatar}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {t.name}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      {t.role} — {t.restaurant}
                    </div>
                  </div>
                </div>
              </MagicCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
