import { SectionBadge } from "@/components/ui/section-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { NumberTicker } from "@/components/ui/number-ticker";

export function BenefitsSection() {
  return (
    <section id="benefits" className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/[0.03] rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="Résultats" />
          <SectionHeader
            title="Des bénéfices concrets pour votre activité"
            description="Chaque module est conçu pour améliorer votre image, simplifier vos opérations et augmenter la part de vos commandes directes."
          />
        </FadeIn>

        {/* Bento Grid — Row 1 */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4" stagger={0.1}>
          {/* ═══ HERO CARD: more direct orders ═══ */}
          <StaggerItem className="lg:col-span-3 bento-card bento-card--hero group">
            <div className="p-6 lg:p-8 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold uppercase tracking-wider">
                  Sans commission
                </span>
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold mb-2">
                Plus de commandes directes
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Recevez des commandes sans intermédiaire, directement depuis votre site. Votre chiffre d&apos;affaires vous appartient.
              </p>
              {/* Mini sparkline chart */}
              <div className="mt-auto rounded-xl bg-black/20 border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                    Commandes directes
                  </span>
                  <span className="text-xs font-bold text-primary tabular-nums">
                    +<NumberTicker value={47} suffix="%" />
                  </span>
                </div>
                <svg viewBox="0 0 300 60" className="w-full h-12">
                  <defs>
                    <linearGradient id="benefitArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(82,207,175,0.2)" />
                      <stop offset="100%" stopColor="rgba(82,207,175,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 50 C30 48, 50 42, 80 40 C110 38, 130 35, 150 30 C170 26, 190 25, 210 20 C230 16, 250 12, 280 8 L300 4 L300 60 L0 60 Z"
                    fill="url(#benefitArea)"
                  />
                  <path
                    d="M0 50 C30 48, 50 42, 80 40 C110 38, 130 35, 150 30 C170 26, 190 25, 210 20 C230 16, 250 12, 280 8 L300 4"
                    fill="none"
                    stroke="rgba(82,207,175,0.6)"
                    strokeWidth="2"
                  />
                  <circle cx="300" cy="4" r="3" fill="rgba(82,207,175,0.8)" />
                  <circle cx="300" cy="4" r="6" fill="rgba(82,207,175,0.2)" />
                </svg>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    <span className="text-[9px] text-muted-foreground/50">
                      Depuis votre site
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    <span className="text-[9px] text-muted-foreground/40">
                      Via plateformes
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ═══ More control ═══ */}
          <StaggerItem className="lg:col-span-3 bento-card group">
            <div className="p-6 lg:p-8 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                  Propriétaire
                </span>
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold mb-2">
                Plus de contrôle
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Reprenez la main sur votre présence digitale, vos données clients et votre image de marque.
              </p>
              {/* Mini control hub visual */}
              <div className="mt-auto rounded-xl bg-black/20 border border-white/[0.06] p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Menu", status: "Actif" },
                    { label: "Site web", status: "En ligne" },
                    { label: "Commandes", status: "Actif" },
                    { label: "Jeux", status: "Actif" },
                    { label: "Branding", status: "Custom" },
                    { label: "Tableau de bord", status: "Live" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      <div>
                        <div className="text-[9px] text-white/50 font-medium leading-none">
                          {item.label}
                        </div>
                        <div className="text-[8px] text-primary/40 mt-0.5">
                          {item.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ═══ Meilleure image ═══ */}
          <StaggerItem className="lg:col-span-2 bento-card group">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Meilleure image</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Un site premium qui reflète la qualité de votre restaurant.
              </p>
              {/* Mini storefront mockup */}
              <div className="mt-auto rounded-lg bg-black/20 border border-white/[0.06] overflow-hidden">
                <div className="flex gap-1 px-2 py-1.5 border-b border-white/[0.04]">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                </div>
                <div className="p-2.5 space-y-1.5">
                  <div className="h-10 rounded bg-gradient-to-r from-primary/8 to-transparent" />
                  <div className="flex gap-1.5">
                    <div className="h-6 flex-1 rounded bg-white/[0.03]" />
                    <div className="h-6 flex-1 rounded bg-white/[0.03]" />
                  </div>
                  <div className="h-2 w-2/3 rounded bg-white/[0.05]" />
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ═══ Time saved ═══ */}
          <StaggerItem className="lg:col-span-2 bento-card group">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold uppercase tracking-wider">
                  Automatisé
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Gain de temps</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Automatisez les tâches récurrentes et concentrez-vous sur l&apos;essentiel.
              </p>
              {/* Mini automation timeline */}
              <div className="mt-auto space-y-1.5">
                {[
                  { task: "Mise à jour menu", time: "Auto", done: true },
                  { task: "Confirmation commande", time: "Instant", done: true },
                  { task: "Email de relance", time: "Planifié", done: true },
                ].map((t) => (
                  <div
                    key={t.task}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                  >
                    <div className="w-4 h-4 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary/60">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-white/40 flex-1">{t.task}</span>
                    <span className="text-[9px] text-primary/40 font-medium">{t.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>

          {/* ═══ Stronger customer loyalty ═══ */}
          <StaggerItem className="lg:col-span-2 bento-card group">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Fidélisation renforcée</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Un jeu scanné à table qui donne une raison de revenir, et vous laisse leur email.
              </p>
              {/* Mini game card — one scan, one action, one play, one prize.
                  Nothing accumulates, so nothing here counts up. */}
              <div className="mt-auto rounded-lg bg-gradient-to-br from-primary/[0.04] to-transparent border border-primary/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-primary/40 uppercase tracking-wider font-medium">
                    Jeu à table
                  </span>
                  <span className="text-[9px] text-white/20">Taux de gain 30 %</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "Scan", path: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" },
                    { label: "Avis", path: "M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" },
                    { label: "Partie", path: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 4a6 6 0 1 1-6 6 6 6 0 0 1 6-6" },
                    { label: "Lot", path: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7" },
                  ].map((s, i, all) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 rounded-full border bg-primary/15 border-primary/30 flex items-center justify-center">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60">
                            <path d={s.path} />
                          </svg>
                        </div>
                        <span className="text-[8px] text-white/30 leading-none">{s.label}</span>
                      </div>
                      {i < all.length - 1 && (
                        <span className="w-2 h-px bg-primary/20 mb-3" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  <span className="text-[9px] text-primary/40 font-medium">
                    Lot par email en QR code
                  </span>
                  <span className="text-[9px] text-white/15">•</span>
                  <span className="text-[9px] text-white/25">
                    1 partie / 24 h
                  </span>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ═══ HERO CARD 2: one central view ═══ */}
          <StaggerItem className="md:col-span-2 lg:col-span-6 bento-card bento-card--hero group">
            <div className="p-6 lg:p-8">
              <div className="lg:grid lg:grid-cols-2 lg:gap-8 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                      </svg>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold uppercase tracking-wider">
                      1 plateforme
                    </span>
                  </div>
                  <h3 className="text-xl lg:text-2xl font-semibold mb-2">
                    Vision centralisée
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Tous vos outils, données et canaux réunis en un seul endroit pour une gestion simplifiée.
                  </p>
                </div>

                {/* Mini convergence diagram */}
                <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-center justify-center gap-4">
                  {/* Sources */}
                  <div className="flex flex-row sm:flex-col gap-2 shrink-0 flex-wrap justify-center">
                    {[
                      { name: "Site web", color: "bg-primary/30" },
                      { name: "Commandes", color: "bg-blue-400/20" },
                      { name: "Jeux", color: "bg-purple-400/20" },
                      { name: "Analytics", color: "bg-amber-400/20" },
                    ].map((src) => (
                      <div
                        key={src.name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.06]"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${src.color}`} />
                        <span className="text-[9px] text-white/35">{src.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Arrows */}
                  <svg className="hidden sm:block w-12 h-24 shrink-0" viewBox="0 0 48 96">
                    <path d="M0 12 C16 12, 32 48, 48 48" fill="none" stroke="rgba(82,207,175,0.15)" strokeWidth="1" />
                    <path d="M0 36 C16 36, 32 48, 48 48" fill="none" stroke="rgba(82,207,175,0.2)" strokeWidth="1" />
                    <path d="M0 60 C16 60, 32 48, 48 48" fill="none" stroke="rgba(82,207,175,0.15)" strokeWidth="1" />
                    <path d="M0 84 C16 84, 32 48, 48 48" fill="none" stroke="rgba(82,207,175,0.1)" strokeWidth="1" />
                    <circle cx="48" cy="48" r="3" fill="rgba(82,207,175,0.35)" />
                    <circle cx="48" cy="48" r="7" fill="rgba(82,207,175,0.08)" />
                  </svg>
                  {/* Mobile arrow */}
                  <svg className="sm:hidden w-6 h-6 text-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>

                  {/* Hub */}
                  <div className="w-full sm:w-auto rounded-xl bg-primary/[0.06] border border-primary/15 p-3 shrink-0">
                    <div className="text-[8px] text-primary/50 uppercase tracking-wider font-medium mb-1.5">
                      Hub unifié
                    </div>
                    <div className="space-y-1">
                      {["Tableau de bord", "Gestion centralisée", "Données en temps réel"].map((line) => (
                        <div key={line} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.02]">
                          <div className="w-1 h-1 rounded-full bg-primary/40" />
                          <span className="text-[8px] text-white/30">{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </div>
    </section>
  );
}
