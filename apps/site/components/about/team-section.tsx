"use client";

import { Target, Palette, Code2, ChefHat, Quote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const expertise: {
  area: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    area: "Produit & Stratégie",
    description:
      "Vision produit, cadrage fonctionnel, stratégie de lancement et accompagnement client.",
    Icon: Target,
  },
  {
    area: "Design & UX",
    description:
      "Interfaces premium, expérience utilisateur pensée pour la restauration, branding digital.",
    Icon: Palette,
  },
  {
    area: "Développement",
    description:
      "Stack moderne, architecture scalable, intégrations métier et performance au rendez-vous.",
    Icon: Code2,
  },
  {
    area: "Connaissance terrain",
    description:
      "Expérience directe dans la restauration pour comprendre les vrais besoins du quotidien.",
    Icon: ChefHat,
  },
];

const stats = [
  { value: "100%", label: "Focus restauration" },
  { value: "Sur mesure", label: "Chaque projet est unique" },
  { value: "Premium", label: "Design & technologie" },
  { value: "Humain", label: "Accompagnement dédié" },
];

export function TeamSection() {
  return (
    <section className="relative overflow-hidden border-y border-[color:var(--border)] bg-secondary py-20 sm:py-28 lg:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="L'équipe" />
          <div className="mx-auto mt-6 mb-16 max-w-3xl text-center lg:mb-20">
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance text-foreground sm:text-4xl lg:text-5xl">
              Des experts.{" "}
              <span className="text-primary-ink">Une seule mission.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              On ne croit pas aux stars solo. BeYours, c&apos;est une
              équipe soudée qui combine expertise tech, sensibilité design et
              connaissance terrain de la restauration.
            </p>
          </div>
        </FadeIn>

        {/* Quote block — visually prominent */}
        <FadeIn delay={0.1}>
          <div className="relative mb-16 overflow-hidden rounded-2xl border border-[color:var(--border-accent)] bg-surface-1 p-8 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] sm:p-10">
            <div className="relative z-10 mx-auto max-w-3xl text-center">
              <Quote
                className="mx-auto mb-4 h-8 w-8 text-primary-ink/40"
                strokeWidth={1.8}
              />
              <p className="font-display text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
                On a choisi de ne pas mettre des noms en avant, mais des
                compétences. Ce qui compte, c&apos;est ce qu&apos;on construit
                ensemble pour nos clients.
              </p>
              <p className="mt-4 text-sm font-medium text-primary-ink">
                L&apos;équipe BeYours
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Expertise grid */}
        <StaggerContainer
          stagger={0.1}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2"
        >
          {expertise.map((item) => {
            const { Icon } = item;
            return (
              <StaggerItem key={item.area}>
                <div className="group h-full rounded-2xl border border-[color:var(--border)] bg-surface-1 p-6 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-7">
                  <div className="flex items-start gap-5">
                    <span className="inline-grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-ink">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3 className="mb-2 font-display text-base font-semibold text-foreground transition-colors duration-300 group-hover:text-primary-ink sm:text-lg">
                        {item.area}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Stats row */}
        <FadeIn delay={0.3}>
          <div className="mt-16 grid grid-cols-2 gap-8 border-t border-[color:var(--border)] pt-12 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-2xl font-bold text-primary-ink sm:text-3xl lg:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-xs text-muted-foreground sm:text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
