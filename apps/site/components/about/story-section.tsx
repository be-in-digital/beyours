"use client";

import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const milestones = [
  {
    year: "Le constat",
    title: "Un fossé entre cuisine et digital",
    description:
      "Trop de restaurants exceptionnels sont invisibles en ligne. Leur présence digitale ne reflète ni leur savoir-faire, ni leur identité. Les outils existants sont génériques, dispersés et pensés pour tout le monde — sauf pour la restauration.",
  },
  {
    year: "L'idée",
    title: "Et si on changeait la donne ?",
    description:
      "Be in Digital est né d'une conviction simple : chaque restaurant mérite une vitrine digitale premium et des outils pensés pour son métier. Pas un template générique. Une vraie plateforme, construite autour des réalités du terrain.",
  },
  {
    year: "Aujourd'hui",
    title: "Une plateforme complète, enfin",
    description:
      "Site web premium, commande en ligne, fidélisation, analytics — tout centralisé dans un seul écosystème. Conçu pour les restaurants ambitieux qui veulent reprendre le contrôle de leur présence digitale.",
  },
];

export function StorySection() {
  return (
    <section id="story" className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Notre histoire" />
          <div className="mx-auto mt-6 mb-16 max-w-3xl text-center lg:mb-20">
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance text-foreground sm:text-4xl lg:text-5xl">
              Né d&apos;un constat.{" "}
              <span className="text-primary">Construit avec conviction.</span>
            </h2>
          </div>
        </FadeIn>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

          <div className="space-y-12 sm:space-y-16">
            {milestones.map((milestone, i) => (
              <FadeIn
                key={milestone.year}
                delay={i * 0.15}
                direction={i % 2 === 0 ? "left" : "right"}
              >
                <div
                  className={`relative flex flex-col sm:flex-row items-start gap-6 sm:gap-12 ${
                    i % 2 === 0
                      ? "sm:flex-row"
                      : "sm:flex-row-reverse sm:text-right"
                  }`}
                >
                  {/* Content */}
                  <div className="flex-1 pl-12 sm:pl-0">
                    <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-6 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-transform duration-300 hover:-translate-y-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                        {milestone.year}
                      </span>
                      <h3 className="mb-3 mt-2 font-display text-xl font-semibold text-foreground sm:text-2xl">
                        {milestone.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {milestone.description}
                      </p>
                    </div>
                  </div>

                  {/* Timeline dot */}
                  <div className="absolute left-4 top-8 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/40 sm:left-1/2" />

                  {/* Spacer for opposite side */}
                  <div className="hidden sm:block flex-1" />
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
