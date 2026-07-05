"use client";

import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const pillars = [
  {
    title: "Digitaliser sans dénaturer",
    description:
      "Votre identité culinaire est unique. Votre présence digitale doit l'être aussi. On ne plaque pas un template — on construit une extension fidèle de votre restaurant.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Centraliser pour simplifier",
    description:
      "Fini les 10 outils dispersés. Un seul écosystème pour gérer votre site, vos commandes, votre menu, votre fidélisation et vos données.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    title: "Accompagner, pas juste livrer",
    description:
      "On ne vous laisse pas seul avec un outil. Notre équipe vous accompagne du cadrage initial à la montée en puissance, et au-delà.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export function MissionSection() {
  return (
    <section className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/[0.02] rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Notre mission" />
          <div className="text-center max-w-3xl mx-auto mt-6 mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
              Donner aux restaurants les{" "}
              <span className="text-primary">armes digitales</span> qu&apos;ils
              méritent
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Nous croyons que la transformation digitale de la restauration ne
              se résume pas à un site web. C&apos;est un écosystème complet,
              pensé pour le métier.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer
          stagger={0.12}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {pillars.map((pillar) => (
            <StaggerItem key={pillar.title}>
              <div className="group relative h-full p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-primary/15 transition-all duration-300">
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-5">
                    {pillar.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
