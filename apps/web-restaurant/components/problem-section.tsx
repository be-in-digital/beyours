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
    visual: <DependencyVisual />,
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
    visual: <WeakImageVisual />,
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
    visual: <LoyaltyVisual />,
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
    <MagicCard className="group h-full backdrop-blur-md">
      {/* Top neon line — visible on hover */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Visual area */}
      <div className="relative h-44 flex items-center justify-center overflow-hidden">
        {problem.visual}
      </div>

      {/* Content area */}
      <div className="p-6 pt-2">
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

/* ── Card Visuals ── */

function DependencyVisual() {
  return (
    <div className="relative w-36 h-24">
      <div className="absolute top-2 left-4 w-14 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
        <div className="w-6 h-1.5 rounded bg-red-500/40" />
      </div>
      <div className="absolute top-2 right-4 w-14 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
        <div className="w-6 h-1.5 rounded bg-orange-500/40" />
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
        <div className="w-6 h-1.5 rounded bg-yellow-500/40" />
      </div>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 144 96">
        <line x1="46" y1="25" x2="98" y2="25" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="72" y1="25" x2="72" y2="72" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    </div>
  );
}

function WeakImageVisual() {
  return (
    <div className="relative w-40 h-28">
      <div className="absolute inset-0 rounded-lg bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
        </div>
        <div className="p-2 space-y-1.5">
          <div className="h-2 w-3/4 rounded bg-white/[0.06]" />
          <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
          <div className="h-8 w-full rounded bg-white/[0.03] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          <div className="h-2 w-2/3 rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500/15 border border-red-500/25 backdrop-blur-sm flex items-center justify-center">
        <span className="text-[10px] text-red-400 font-bold">!</span>
      </div>
    </div>
  );
}

function LoyaltyVisual() {
  return (
    <div className="relative w-40 h-28 flex items-center justify-center">
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
              <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <div className="w-6 h-1 rounded bg-white/[0.06]" />
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          </div>
          <div className="w-6 h-1 rounded bg-white/[0.04]" />
        </div>
      </div>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 112">
        <line x1="62" y1="56" x2="76" y2="56" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="2 4" />
        <line x1="84" y1="56" x2="98" y2="56" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>
    </div>
  );
}
