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
    <section id="story" className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/[0.02] rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Notre histoire" />
          <div className="text-center max-w-3xl mx-auto mt-6 mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
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
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-primary/10 transition-all duration-300">
                      <span className="text-xs font-medium text-primary tracking-widest uppercase">
                        {milestone.year}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-semibold mt-2 mb-3">
                        {milestone.title}
                      </h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {milestone.description}
                      </p>
                    </div>
                  </div>

                  {/* Timeline dot */}
                  <div className="absolute left-4 sm:left-1/2 top-8 -translate-x-1/2 w-3 h-3 rounded-full bg-primary/40 border-2 border-primary/60 shadow-[0_0_12px_rgba(82,207,175,0.3)]" />

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
