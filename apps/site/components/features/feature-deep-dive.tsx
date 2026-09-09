"use client";

import { Check } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { FeatureVisual } from "./feature-visuals";
import { deepDiveFeatures, pillars } from "./features-data";

/* ═══════════════════════════════════════════════
   Feature Deep-Dive — 7 alternating sections
   ═══════════════════════════════════════════════ */

export function FeatureDeepDives() {
  return (
    <div className="relative">
      {/* Connecting vertical line (desktop) */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 bottom-0 hidden w-px lg:block pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, var(--border) 10%, var(--border) 90%, transparent 100%)",
        }}
      />

      {deepDiveFeatures.map((feature, i) => {
        const reverse = i % 2 !== 0;

        return (
          <section
            key={feature.id}
            id={feature.id}
            className="relative overflow-hidden py-16 scroll-mt-24 sm:py-24"
          >
            {/* Section halo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-section-radial"
            />

            {/* Separator */}
            {i > 0 && (
              <div
                aria-hidden="true"
                className="absolute inset-x-8 top-0 h-px bg-[color:var(--border)]"
              />
            )}

            <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
              {/* Watermark number */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute top-0 select-none font-display text-[120px] font-bold leading-none text-primary-ink/[0.06] sm:text-[180px] lg:text-[220px] ${
                  reverse ? "right-0 sm:right-4" : "left-0 sm:left-4"
                }`}
              >
                {feature.tag}
              </div>

              <div
                className={`relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  reverse ? "lg:[direction:rtl]" : ""
                }`}
              >
                {/* Text side */}
                <div className={reverse ? "lg:[direction:ltr]" : ""}>
                  <FadeIn direction={reverse ? "right" : "left"}>
                    {/* Pillar label */}
                    <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-accent)] bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-ink">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {pillars[feature.pillar].label}
                    </span>

                    {/* A deep dive reads as a tour of what you get. This is the
                        one line that says otherwise, so it sits beside the
                        pillar label rather than below the fold. */}
                    {feature.notYetAvailable && (
                      <span className="mb-4 ml-2 inline-flex items-center rounded-full border border-[color:var(--info-border)] bg-[color:var(--info-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--info)]">
                        {feature.notYetAvailable.label}
                      </span>
                    )}

                    <h3 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-3xl lg:text-4xl">
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-sm font-semibold text-primary-ink">
                      {feature.subtitle}
                    </p>

                    <p className="mt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {feature.longDescription}
                    </p>

                    {/* Benefits */}
                    <ul className="mt-6 space-y-3">
                      {feature.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-ink">
                            <Check className="h-3 w-3" strokeWidth={2.8} />
                          </span>
                          <span className="text-sm text-secondary-foreground">
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
