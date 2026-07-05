/* ═══════════════════════════════════════════════
   Pricing Process — Timeline "Comment ça marche"
   ═══════════════════════════════════════════════ */

import { processSteps } from "./pricing-data";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

export function PricingProcess() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-14">
          <SectionBadge text="Process" />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em] mt-4">
            Comment ça marche
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            De l&apos;idée au lancement, un process clair en 4 étapes.
          </p>
        </FadeIn>

        {/* Desktop: horizontal timeline */}
        <StaggerContainer
          className="hidden md:grid grid-cols-4 relative"
          stagger={0.12}
        >
          {processSteps.map((step, i) => (
            <StaggerItem key={step.number} className="relative text-center px-4">
              {/* Connector line to next step */}
              {i < processSteps.length - 1 && (
                <div
                  className="absolute top-6 h-px pointer-events-none"
                  style={{
                    left: "calc(50% + 24px)",
                    right: "calc(-50% + 24px)",
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40" />
                </div>
              )}

              {/* Number circle */}
              <div className="relative mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(82,207,175,0.15)] z-10">
                <span className="text-sm font-bold text-primary">
                  {step.number}
                </span>
                {i === 0 && (
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
                )}
              </div>

              <h3 className="text-base font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Mobile: vertical timeline */}
        <StaggerContainer
          className="md:hidden relative"
          stagger={0.1}
        >
          {processSteps.map((step, i) => (
            <StaggerItem
              key={step.number}
              className="relative flex gap-5 pb-10 last:pb-0"
            >
              {/* Vertical connector to next step */}
              {i < processSteps.length - 1 && (
                <div
                  className="absolute left-[23px] w-px"
                  style={{
                    top: "48px",
                    bottom: "-0px",
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-b from-primary/30 to-primary/10" />
                </div>
              )}

              {/* Number dot */}
              <div className="relative z-10 shrink-0 w-12 h-12 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_16px_rgba(82,207,175,0.12)]">
                <span className="text-sm font-bold text-primary">
                  {step.number}
                </span>
              </div>

              <div className="pt-2">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
