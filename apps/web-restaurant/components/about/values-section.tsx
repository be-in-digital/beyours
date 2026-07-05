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
    <section className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Nos valeurs" />
          <div className="text-center max-w-3xl mx-auto mt-6 mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
              Ce qui nous{" "}
              <span className="text-primary">guide au quotidien</span>
            </h2>
          </div>
        </FadeIn>

        <StaggerContainer
          stagger={0.08}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {values.map((value) => (
            <StaggerItem key={value.title}>
              <div className="group relative h-full p-6 rounded-xl bg-white/[0.015] border border-white/[0.06] hover:bg-white/[0.03] hover:border-primary/15 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <span className="text-2xl font-bold text-primary/20 group-hover:text-primary/40 transition-colors duration-300 leading-none mt-0.5">
                    {value.keyword}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold mb-2">
                      {value.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
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
