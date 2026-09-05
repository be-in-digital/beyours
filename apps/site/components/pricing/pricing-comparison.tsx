/* ═══════════════════════════════════════════════
   Pricing Comparison — comparison table, benefit by benefit
   ═══════════════════════════════════════════════ */

import { comparisonCategories, type ComparisonStatus } from "./pricing-data";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

function Check() {
  return (
    <svg
      className="w-5 h-5 text-primary"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M5 10.5L8.5 14L15 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      className="w-4 h-4 text-muted-foreground/30"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M4 12L12 4M4 4l8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Deliveroo has certified the app; Uber is still awaiting validation, with no
   date announced. Free for every client either way. */
function Soon() {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-surface-2 px-2 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground text-center">
      Deliveroo actif · Uber en attente
    </span>
  );
}

/* Sold inside Premium, not built yet. Deliberately worded differently from
   <Soon />: that one waits on a platform, this one waits on us. Premium is not
   orderable while any of its rows reads this (convex/planAvailability.ts). */
function Planned() {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-surface-2 px-2 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground text-center">
      À venir
    </span>
  );
}

function StatusCell({ status }: { status: ComparisonStatus }) {
  if (status === "soon") return <Soon />;
  if (status === "planned") return <Planned />;
  return status ? <Check /> : <Cross />;
}

export function PricingComparison() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-12">
          <SectionBadge text="Comparatif" />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em] mt-4">
            Tout ce qui est inclus
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Comparez les deux offres en détail pour choisir celle qui correspond
            à vos besoins.
          </p>
        </FadeIn>

        {/* Table header — sticky on scroll */}
        <FadeIn>
          <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 overflow-hidden shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_120px_120px] items-center px-4 sm:px-6 py-4 border-b border-[color:var(--border)] bg-secondary">
              <div className="text-sm font-medium text-muted-foreground">
                Fonctionnalité
              </div>
              <div className="text-sm font-medium text-muted-foreground text-center">
                Essentielle
              </div>
              <div className="text-sm font-medium text-primary text-center">
                Premium
              </div>
            </div>

            {/* Categories */}
            <StaggerContainer stagger={0.08}>
              {comparisonCategories.map((category, catIndex) => (
                <StaggerItem key={category.name}>
                  <div>
                    {/* Category header */}
                    <div
                      className={`px-4 sm:px-6 py-3 bg-primary/[0.06] ${catIndex > 0 ? "border-t border-[color:var(--border)]" : ""}`}
                    >
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                        {category.name}
                      </span>
                    </div>

                    {/* Features */}
                    {category.features.map((feature, featureIndex) => (
                      <div
                        key={feature.label}
                        className={`grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_120px_120px] items-center px-4 sm:px-6 py-3 ${
                          featureIndex > 0
                            ? "border-t border-[color:var(--border)]/60"
                            : ""
                        }`}
                      >
                        <span className="text-sm text-muted-foreground">
                          {feature.label}
                        </span>
                        <div className="flex justify-center">
                          <StatusCell status={feature.essentielle} />
                        </div>
                        <div className="flex justify-center">
                          <StatusCell status={feature.premium} />
                        </div>
                      </div>
                    ))}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
