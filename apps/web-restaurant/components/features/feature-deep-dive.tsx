"use client";

import { FadeIn } from "@/components/ui/motion";
import { FeatureVisual } from "./feature-visuals";
import { deepDiveFeatures, pillars, type Pillar } from "./features-data";

/* ═══════════════════════════════════════════════
   Feature Deep-Dive — 7 alternating sections
   ═══════════════════════════════════════════════ */

const pillarColors: Record<Pillar, string> = {
  attirer: "text-emerald-400/70 bg-emerald-400/10 border-emerald-400/15",
  vendre: "text-primary/70 bg-primary/10 border-primary/15",
  gerer: "text-sky-400/70 bg-sky-400/10 border-sky-400/15",
  fideliser: "text-amber-400/70 bg-amber-400/10 border-amber-400/15",
};

export function FeatureDeepDives() {
  return (
    <div className="relative">
      {/* Connecting vertical line (desktop) */}
      <div
        className="absolute left-1/2 top-0 bottom-0 w-px hidden lg:block pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(82,207,175,0.1) 10%, rgba(82,207,175,0.06) 90%, transparent 100%)",
        }}
      />

      {deepDiveFeatures.map((feature, i) => {
        const reverse = i % 2 !== 0;

        return (
          <section
            key={feature.id}
            id={feature.id}
            className="relative py-16 sm:py-24 overflow-hidden scroll-mt-24"
          >
            {/* Separator */}
            {i > 0 && (
              <div
                className="absolute top-0 left-8 right-8 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(82,207,175,0.1), transparent)",
                }}
              />
            )}

            {/* Ambient glow */}
            <div
              className={`absolute top-1/2 ${reverse ? "left-1/4" : "right-1/4"} -translate-y-1/2 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[80px] pointer-events-none`}
            />

            <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
              {/* Watermark number */}
              <div
                className={`absolute top-0 ${reverse ? "right-0 sm:right-4" : "left-0 sm:left-4"} text-[120px] sm:text-[180px] lg:text-[220px] font-bold text-white/[0.02] leading-none select-none pointer-events-none`}
              >
                {feature.tag}
              </div>

              <div
                className={`relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
                  reverse ? "lg:[direction:rtl]" : ""
                }`}
              >
                {/* Text side */}
                <div className={reverse ? "lg:[direction:ltr]" : ""}>
                  <FadeIn direction={reverse ? "right" : "left"}>
                    {/* Pillar badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider mb-4 ${pillarColors[feature.pillar]}`}
                    >
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {pillars[feature.pillar].label}
                    </span>

                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em] leading-tight">
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-sm text-primary/60 font-medium">
                      {feature.subtitle}
                    </p>

                    <p className="mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {feature.longDescription}
                    </p>

                    {/* Benefits */}
                    <ul className="mt-6 space-y-3">
                      {feature.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-start gap-3"
                        >
                          <div className="mt-1 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-primary/70"
                            >
                              <path d="M5 12l5 5L20 7" />
                            </svg>
                          </div>
                          <span className="text-sm text-muted-foreground/80">
                            {benefit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </FadeIn>
                </div>

                {/* Visual side */}
                <FadeIn
                  direction={reverse ? "left" : "right"}
                  delay={0.15}
                  className={reverse ? "lg:[direction:ltr]" : ""}
                >
                  <FeatureVisual feature={feature} />
                </FadeIn>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
