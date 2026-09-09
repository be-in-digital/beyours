"use client";

import { CheckCircle2, LayoutGrid, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const pillars: {
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Digitaliser sans dénaturer",
    description:
      "Votre identité culinaire est unique. Votre présence digitale doit l'être aussi. On ne plaque pas un template, on construit une extension fidèle de votre restaurant.",
    Icon: CheckCircle2,
  },
  {
    title: "Centraliser pour simplifier",
    description:
      "Fini les 10 outils dispersés. Un seul écosystème pour gérer votre site, vos commandes, votre menu, votre fidélisation et vos données.",
    Icon: LayoutGrid,
  },
  {
    title: "Accompagner, pas juste livrer",
    description:
      "On ne vous laisse pas seul avec un outil. Notre équipe vous accompagne du cadrage initial à la montée en puissance, et au-delà.",
    Icon: Users,
  },
];

export function MissionSection() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Notre mission" />
          <div className="mx-auto mt-6 mb-16 max-w-3xl text-center lg:mb-20">
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance text-foreground sm:text-4xl lg:text-5xl">
              Donner aux restaurants les{" "}
              <span className="text-primary-ink">armes digitales</span> qu&apos;ils
              méritent
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Nous croyons que la transformation digitale de la restauration ne
              se résume pas à un site web. C&apos;est un écosystème complet,
              pensé pour le métier.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer
          stagger={0.12}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {pillars.map((pillar) => {
            const { Icon } = pillar;
            return (
              <StaggerItem key={pillar.title}>
                <div className="group h-full rounded-2xl border border-[color:var(--border)] bg-surface-1 p-8 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-transform duration-300 hover:-translate-y-1">
                  <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary-ink">
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <h3 className="mb-3 font-display text-lg font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
