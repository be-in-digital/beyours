import Image from "next/image";
import { Unplug, MonitorX, HeartCrack, ImageOff, TrendingDown } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { MobileCarousel } from "@/components/ui/mobile-carousel";

const problems = [
  {
    Icon: Unplug,
    title: "Dépendance aux plateformes",
    description:
      "Jusqu'à 30 % de commission sur chaque commande livrée, et vos données clients restent chez les plateformes.",
    Visual: CommissionVisual,
  },
  {
    Icon: MonitorX,
    title: "Image digitale faible",
    description:
      "Un site vieillissant ou absent qui ne reflète pas la qualité de votre établissement.",
    Visual: OldSiteVisual,
  },
  {
    Icon: HeartCrack,
    title: "Fidélisation inexistante",
    description:
      "Aucun moyen de garder le lien avec vos clients entre deux visites.",
    Visual: LoyaltyVisual,
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="relative py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <p className="text-sm font-semibold text-primary-ink">Le constat</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance sm:text-4xl lg:text-[2.75rem]">
            La plupart des restaurants subissent le digital.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Trois pertes silencieuses, mois après mois, sur la marge, l&apos;image
            et la relation client.
          </p>
        </FadeIn>

        <StaggerContainer
          className="mt-12 hidden gap-6 md:grid md:grid-cols-3"
          stagger={0.08}
        >
          {problems.map((p) => (
            <StaggerItem key={p.title}>
              <ProblemCard problem={p} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        <div className="mt-10 md:hidden">
          <MobileCarousel>
            {problems.map((p) => (
              <ProblemCard key={p.title} problem={p} />
            ))}
          </MobileCarousel>
        </div>
      </div>
    </section>
  );
}

function ProblemCard({ problem }: { problem: (typeof problems)[number] }) {
  const { Icon, Visual } = problem;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
      {/* Visual that embodies the problem */}
      <div className="relative h-44 overflow-hidden border-b border-[color:var(--border)] bg-secondary/50">
        <Visual />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {problem.title}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {problem.description}
        </p>
      </div>
    </article>
  );
}

/* ── Visual 1: the commission eats into the order ── */
function CommissionVisual() {
  return (
    <div className="flex h-full flex-col justify-center p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">
          Sur 100 € de commandes livrées
        </span>
        <span className="font-display text-lg font-bold tabular-nums text-[color:var(--destructive)]">
          −30 €
        </span>
      </div>
      {/* Barre 70 / 30 */}
      <div className="flex h-8 overflow-hidden rounded-lg">
        <div className="flex items-center justify-center bg-surface-4" style={{ width: "70%" }}>
          <span className="text-[10px] font-semibold text-secondary-foreground">
            70 € pour vous
          </span>
        </div>
        <div
          className="flex items-center justify-center bg-[color:var(--destructive)]"
          style={{ width: "30%" }}
        >
          <span className="text-[10px] font-semibold text-white">30 €</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          Prélevé par
        </span>
        <span className="flex items-center gap-1.5">
          <Image
            src="/logos/uber-eats.png"
            alt="Uber Eats"
            width={16}
            height={16}
            className="h-4 w-4 rounded-sm object-contain opacity-80"
          />
          <Image
            src="/logos/deliveroo.png"
            alt="Deliveroo"
            width={16}
            height={16}
            className="h-4 w-4 rounded-sm object-contain opacity-80"
          />
        </span>
      </div>
    </div>
  );
}

/* ── Visual 2: an ageing website ── */
function OldSiteVisual() {
  return (
    <div className="h-full p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[color:var(--border)] bg-background">
        {/* barre navigateur terne */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-[color:var(--border)] bg-surface-2 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-surface-4" />
          <span className="h-1.5 w-1.5 rounded-full bg-surface-4" />
          <span className="ml-2 truncate font-mono text-[9px] text-muted-foreground">
            restaurant-le-vieux.fr
          </span>
        </div>
        {/* dated body — flex-1, compresses, never clips */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-3">
          <ImageOff
            className="h-6 w-6 shrink-0 text-muted-foreground/50"
            strokeWidth={1.5}
          />
          <span className="text-[10px] font-medium text-muted-foreground/70">
            Aperçu indisponible
          </span>
        </div>
        {/* dated footer — always visible */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--border)] px-2.5 py-1.5">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            Menu.pdf
          </span>
          <span className="text-[9px] text-muted-foreground/60">
            Mis à jour en 2019
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Visual 3: no loyalty to speak of ── */
function LoyaltyVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-5">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Carte de fidélité
        </p>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="h-6 w-6 rounded-full border border-dashed border-[color:var(--border-contrast)] bg-secondary/40"
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TrendingDown
          className="h-4 w-4 text-[color:var(--destructive)]"
          strokeWidth={2}
        />
        <span className="text-xs text-muted-foreground">
          Clients qui reviennent :{" "}
          <span className="font-semibold text-foreground">aucun suivi</span>
        </span>
      </div>
    </div>
  );
}
