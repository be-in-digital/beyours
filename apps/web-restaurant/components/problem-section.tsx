import Image from "next/image";
import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/section-header";
import { MobileCarousel } from "@/components/ui/mobile-carousel";
import { MagicCard } from "@/components/ui/magic-card";

const problems = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3" />
        <path d="M8 12h8" />
      </svg>
    ),
    title: "Dépendance aux plateformes",
    description:
      "Jusqu'à 30 % de commission sur chaque commande livrée — et vos données clients restent chez les plateformes.",
    photo: "/photos/burger-premium.webp",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: "Image digitale faible",
    description:
      "Un site vieillissant ou absent qui ne reflète pas la qualité de votre établissement.",
    photo: "/photos/plat-gastronomie.webp",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        <path d="m12 13-1-1 2-2-3-3 2-2" />
      </svg>
    ),
    title: "Fidélisation inexistante",
    description:
      "Aucun moyen de garder le lien avec vos clients entre deux visites.",
    photo: "/photos/salle-restaurant2.webp",
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Ambient glow behind the grid */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.03] rounded-full blur-[80px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Le constat" />
          <SectionHeader
            title="Les défis du digital en restauration"
            description="La plupart des restaurants subissent le digital au lieu de le maîtriser."
          />
        </FadeIn>

        {/* Desktop: grid with stagger animation */}
        <StaggerContainer className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5" stagger={0.08}>
          {problems.map((problem) => (
            <StaggerItem key={problem.title}>
              <ProblemCard problem={problem} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Mobile: carousel */}
        <div className="md:hidden">
          <MobileCarousel>
            {problems.map((problem) => (
              <ProblemCard key={problem.title} problem={problem} />
            ))}
          </MobileCarousel>
        </div>
      </div>
    </section>
  );
}

/* ── Problem Card ── */

function ProblemCard({ problem }: { problem: (typeof problems)[number] }) {
  return (
    <MagicCard className="group relative h-full min-h-[280px] overflow-hidden">
      {/* Texture photo — sombre, revele au hover */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src={problem.photo}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover opacity-[0.18] saturate-[0.85] transition-all duration-500 group-hover:opacity-[0.28] group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/55 to-background/30" />
      </div>

      {/* Top neon line — visible on hover */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content area — ancre en bas de carte */}
      <div className="relative flex h-full flex-col justify-end p-6 pt-32">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/[0.08] border border-primary/20 text-primary shrink-0 backdrop-blur-sm group-hover:border-primary/40 group-hover:shadow-[0_0_12px_rgba(82,207,175,0.18)] transition-all duration-300">
            {problem.icon}
          </div>
          <h3 className="text-base font-semibold">{problem.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {problem.description}
        </p>
      </div>
    </MagicCard>
  );
}
