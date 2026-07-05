/* ═══════════════════════════════════════════════
   Pricing Model — "Pourquoi ce modèle de prix ?"
   ═══════════════════════════════════════════════ */

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";

const modelPoints = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Création",
    description:
      "Un investissement unique pour concevoir votre solution sur mesure, de A à Z, sans compromis sur la qualité.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "Maintenance",
    description:
      "Un accompagnement continu pour garder une solution stable, sécurisée et performante dans le temps.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    ),
    title: "Première année obligatoire",
    description:
      "Pour garantir un lancement réussi, un suivi technique de qualité et un accompagnement dans la prise en main.",
  },
];

export function PricingModel() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]">
            Pourquoi ce modèle de prix&nbsp;?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Un paiement unique pour la création, puis une maintenance claire
            pour garder une solution stable, sécurisée et accompagnée dans le
            temps.
          </p>
        </FadeIn>

        <StaggerContainer
          className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          stagger={0.12}
        >
          {modelPoints.map((point) => (
            <StaggerItem key={point.title}>
              <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center h-full">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary mb-4">
                  {point.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {point.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
