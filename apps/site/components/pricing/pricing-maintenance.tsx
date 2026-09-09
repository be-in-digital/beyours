/* ═══════════════════════════════════════════════
   Pricing Maintenance — what is included + what is out of scope
   ═══════════════════════════════════════════════ */

import { maintenanceIncluded, maintenanceExcluded } from "./pricing-data";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

const iconMap: Record<string, React.ReactNode> = {
  server: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
  refresh: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
    </svg>
  ),
  headset: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  ),
  activity: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  database: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

export function PricingMaintenance() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      {/* Subtle background glow */}
      <div aria-hidden="true" className="absolute inset-0 bg-section-radial pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-12">
          <SectionBadge text="Maintenance" />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em] mt-4">
            Ce que la maintenance inclut
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Un accompagnement complet pour que votre solution reste performante,
            sécurisée et à jour.
          </p>
        </FadeIn>

        {/* Inclus — grille 2×3 */}
        <StaggerContainer
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          stagger={0.08}
        >
          {maintenanceIncluded.map((item) => (
            <StaggerItem key={item.title}>
              <div className="rounded-xl border border-[color:var(--border)] bg-surface-1 p-5 h-full shadow-[0_8px_24px_-18px_rgba(112,60,34,0.3)]">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-ink mb-3">
                  {iconMap[item.icon]}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Out of scope */}
        <FadeIn delay={0.3} className="mt-10">
          <div className="rounded-xl border border-[color:var(--border)] bg-secondary/60 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-muted-foreground/50"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 5v4M8 11h.01" strokeLinecap="round" />
              </svg>
              Hors périmètre de la maintenance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {maintenanceExcluded.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 text-sm text-muted-foreground/70"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0 text-muted-foreground/30"
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
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground/50">
              Ces prestations font l&apos;objet d&apos;un devis séparé adapté à
              vos besoins.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
