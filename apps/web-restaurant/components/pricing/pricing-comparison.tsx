/* ═══════════════════════════════════════════════
   Pricing Comparison — Tableau comparatif par bénéfice
   ═══════════════════════════════════════════════ */

import { comparisonCategories } from "./pricing-data";
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
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_80px_80px] sm:grid-cols-[1fr_120px_120px] items-center px-4 sm:px-6 py-4 border-b border-white/[0.06] bg-white/[0.03]">
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
                      className={`px-4 sm:px-6 py-3 bg-primary/[0.03] ${catIndex > 0 ? "border-t border-white/[0.06]" : ""}`}
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
                            ? "border-t border-white/[0.04]"
                            : ""
                        }`}
                      >
                        <span className="text-sm text-muted-foreground">
                          {feature.label}
                        </span>
                        <div className="flex justify-center">
                          {feature.essentielle ? <Check /> : <Cross />}
                        </div>
                        <div className="flex justify-center">
                          {feature.premium ? <Check /> : <Cross />}
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
