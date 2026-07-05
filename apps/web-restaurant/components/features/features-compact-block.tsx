"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { compactFeatures, pillars, type Pillar } from "./features-data";

/* ═══════════════════════════════════════════════
   Compact Block — "Et aussi..." for secondary features
   ═══════════════════════════════════════════════ */

const pillarColors: Record<Pillar, string> = {
  attirer: "text-emerald-400/70 bg-emerald-400/10 border-emerald-400/15",
  vendre: "text-primary/70 bg-primary/10 border-primary/15",
  gerer: "text-sky-400/70 bg-sky-400/10 border-sky-400/15",
  fideliser: "text-amber-400/70 bg-amber-400/10 border-amber-400/15",
};

export function FeaturesCompactBlock() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      {/* Top separator */}
      <div
        className="absolute top-0 left-8 right-8 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(82,207,175,0.1), transparent)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]">
              Et aussi...
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
              Des fonctionnalités essentielles intégrées nativement dans la
              plateforme.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer
          className="grid grid-cols-1 sm:grid-cols-3 gap-5"
          stagger={0.1}
        >
          {compactFeatures.map((feature) => (
            <StaggerItem key={feature.id} className="flex">
              <div
                id={feature.id}
                className="flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-6 scroll-mt-24"
              >
                {/* Pillar badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider mb-4 ${pillarColors[feature.pillar]}`}
                >
                  <span className="w-1 h-1 rounded-full bg-current" />
                  {pillars[feature.pillar].label}
                </span>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/[0.08] border border-primary/15 flex items-center justify-center mb-4">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary/70"
                  >
                    {getCompactIcon(feature.id)}
                  </svg>
                </div>

                <h3 className="text-base font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground/70 leading-relaxed mb-4">
                  {feature.shortDescription}
                </p>

                {/* Benefits as bullets */}
                <ul className="space-y-2">
                  {feature.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary/50 shrink-0 mt-0.5"
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                      <span className="text-xs text-muted-foreground/60">
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

function getCompactIcon(id: string): React.ReactNode {
  switch (id) {
    case "dashboard-administrateur":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </>
      );
    case "gestion-menu":
      return (
        <>
          <path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
          <path d="M10 6h4M10 10h4M10 14h2" />
        </>
      );
    case "formation-google-business":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="10" />;
  }
}
