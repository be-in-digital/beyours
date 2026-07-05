"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const expertise = [
  {
    area: "Produit & Stratégie",
    description:
      "Vision produit, cadrage fonctionnel, stratégie de lancement et accompagnement client.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    area: "Design & UX",
    description:
      "Interfaces premium, expérience utilisateur pensée pour la restauration, branding digital.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
        <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
  },
  {
    area: "Développement",
    description:
      "Stack moderne, architecture scalable, intégrations métier et performance au rendez-vous.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    area: "Connaissance terrain",
    description:
      "Expérience directe dans la restauration pour comprendre les vrais besoins du quotidien.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    ),
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
    <section className="relative py-20 sm:py-28 lg:py-36 overflow-hidden">
      {/* Strong background to separate from other sections */}
      <div className="absolute inset-0 bg-[#080809]" />

      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/[0.04] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-[80px]" />
      </div>

      {/* Top separator line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, rgba(82,207,175,0.15) 30%, rgba(82,207,175,0.25) 50%, rgba(82,207,175,0.15) 70%, transparent 90%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="L'équipe" />
          <div className="text-center max-w-3xl mx-auto mt-6 mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.1]">
              Des experts.{" "}
              <span className="text-primary">Une seule mission.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              On ne croit pas aux stars solo. Be in Digital, c&apos;est une
              équipe soudée qui combine expertise tech, sensibilité design et
              connaissance terrain de la restauration.
            </p>
          </div>
        </FadeIn>

        {/* Quote block — visually prominent */}
        <FadeIn delay={0.1}>
          <div className="relative mb-16 p-8 sm:p-10 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent overflow-hidden">
            <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-primary/[0.06] rounded-full blur-[60px] pointer-events-none" />
            <div className="relative z-10 max-w-3xl mx-auto text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-primary/40">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" fill="currentColor" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" fill="currentColor" />
              </svg>
              <p className="text-xl sm:text-2xl font-medium leading-relaxed">
                On a choisi de ne pas mettre des noms en avant, mais des
                compétences. Ce qui compte, c&apos;est ce qu&apos;on construit
                ensemble pour nos clients.
              </p>
              <p className="mt-4 text-sm text-primary/60 font-medium">
                — L&apos;équipe Be in Digital
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Expertise grid */}
        <StaggerContainer stagger={0.1} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {expertise.map((item) => (
            <StaggerItem key={item.area}>
              <div className="group relative h-full p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] hover:border-primary/20 transition-all duration-300">
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-primary/[0.03] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10 flex items-start gap-5">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0 group-hover:bg-primary/15 transition-colors duration-300">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-300">
                      {item.area}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Stats row */}
        <FadeIn delay={0.3}>
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 pt-12 border-t border-white/[0.06]">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
                  {stat.value}
                </div>
                <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      {/* Bottom separator line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, rgba(82,207,175,0.15) 30%, rgba(82,207,175,0.25) 50%, rgba(82,207,175,0.15) 70%, transparent 90%)",
        }}
      />
    </section>
  );
}
