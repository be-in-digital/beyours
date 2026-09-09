"use client";

import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const values = [
  {
    title: "Excellence",
    description:
      "Dans le code comme dans l'assiette, chaque détail compte. On ne livre rien qui ne soit à la hauteur.",
    keyword: "01",
  },
  {
    title: "Spécialisation",
    description:
      "Pas de généralisme. On connaît la restauration, ses contraintes et ses opportunités. C'est notre unique focus.",
    keyword: "02",
  },
  {
    title: "Transparence",
    description:
      "Pas de promesses en l'air. On dit ce qu'on fait, on fait ce qu'on dit. Nos clients savent toujours où ils en sont.",
    keyword: "03",
  },
  {
    title: "Impact",
    description:
      "Chaque fonctionnalité sert un objectif business concret. On ne construit pas pour la démo, on construit pour le résultat.",
    keyword: "04",
  },
  {
    title: "Proximité",
    description:
      "On n'est pas un outil anonyme. Derrière la plateforme, il y a une équipe accessible, réactive et impliquée.",
    keyword: "05",
  },
  {
    title: "Innovation",
    description:
      "La restauration mérite une stack technique moderne. On utilise les meilleures technologies pour offrir performance et fiabilité.",
    keyword: "06",
  },
];

export function ValuesSection() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Nos valeurs" />
          <div className="mx-auto mt-6 mb-16 max-w-3xl text-center lg:mb-20">
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance text-foreground sm:text-4xl lg:text-5xl">
              Ce qui nous{" "}
              <span className="text-primary-ink">guide au quotidien</span>
            </h2>
          </div>
        </FadeIn>

        <StaggerContainer
          stagger={0.08}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {values.map((value) => (
            <StaggerItem key={value.title}>
              <div className="group h-full rounded-2xl border border-[color:var(--border)] bg-surface-1 p-6 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 font-display text-2xl font-bold leading-none text-primary-ink/30 transition-colors duration-300 group-hover:text-primary-ink">
                    {value.keyword}
                  </span>
                  <div className="flex-1">
                    <h3 className="mb-2 font-display text-base font-semibold text-foreground">
                      {value.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {value.description}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
