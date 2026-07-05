import { SectionBadge } from "@/components/ui/section-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";

export function SolutionSection() {
  return (
    <section id="solution" className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Ambient glow */}
      <div className="blur-orb w-[500px] h-[500px] bg-primary/4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="La solution" />
          <SectionHeader
            title="Votre centre de contrôle digital"
            description="Be in Digital réunit tout ce dont votre restaurant a besoin en une seule plateforme premium."
          />
        </FadeIn>

        {/* Bento Grid — 4 cols, asymmetric */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.1}>
          {/* ── Hero: Site web premium (2col x 2row) ── */}
          <StaggerItem className="md:col-span-2 md:row-span-2 bento-card bento-card--hero group flex flex-col p-6 lg:p-8">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            {/* Dot grid texture */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative z-10">
              <BentoLabel text="Vitrine digitale" />
              <h3 className="text-xl lg:text-2xl font-semibold mb-2">
                Site web premium
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                Un site élégant et performant à votre image, optimisé pour le
                mobile et conçu pour convertir les visiteurs en clients.
              </p>
            </div>
            {/* Browser + phone mockup */}
            <div className="relative mt-6 flex-1 min-h-[200px]">
              <div className="absolute inset-x-0 top-0 bottom-8 rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="ml-3 h-4 w-32 rounded bg-white/[0.04] flex items-center px-2">
                    <span className="text-[8px] text-muted-foreground/50 font-mono">
                      mon-restaurant.fr
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="h-20 rounded-lg bg-gradient-to-br from-primary/10 to-primary/[0.02] flex items-center justify-center">
                    <span className="text-[10px] text-primary/30 font-medium tracking-wider uppercase">
                      Hero image
                    </span>
                  </div>
                  <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
                  <div className="inline-flex h-7 w-24 items-center justify-center rounded-md bg-primary/20 border border-primary/30">
                    <span className="text-[9px] text-primary/70 font-medium">
                      Commander
                    </span>
                  </div>
                </div>
              </div>
              {/* Phone overlay */}
              <div className="absolute bottom-0 right-2 w-[72px] h-[130px] rounded-xl border border-white/[0.1] bg-surface-1 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <div className="w-8 h-1 rounded-full bg-white/10 mx-auto mt-1" />
                <div className="p-1.5 space-y-1 mt-1">
                  <div className="h-8 rounded bg-gradient-to-br from-primary/10 to-transparent" />
                  <div className="h-1.5 w-3/4 rounded bg-white/[0.06]" />
                  <div className="h-1.5 w-1/2 rounded bg-white/[0.04]" />
                  <div className="h-4 w-10 rounded bg-primary/20 border border-primary/25 flex items-center justify-center">
                    <span className="text-[6px] text-primary/60">Menu</span>
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ── Commande en ligne (2col wide) ── */}
          <StaggerItem className="md:col-span-2 lg:col-span-2 bento-card group p-6 lg:p-8" direction="up">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <BentoLabel text="Vente directe" />
            <h3 className="text-lg font-semibold mb-1.5">
              Commande en ligne
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Recevez des commandes directement depuis votre site, sans
              commission ni intermédiaire.
            </p>
            {/* Order flow visual */}
            <div className="relative rounded-xl bg-black/30 border border-white/[0.04] p-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(82,207,175,0.03)_0%,transparent_60%)]" />
              <div className="relative flex items-center justify-between gap-2">
                {[
                  { label: "Menu", icon: "M4 4h16v16H4z" },
                  { label: "Panier", icon: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" },
                  { label: "Confirmé", icon: "M20 6 9 17l-5-5" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="text-primary/50"
                        >
                          <path d={step.icon} />
                        </svg>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">
                        {step.label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-primary/5 mx-1" />
                    )}
                  </div>
                ))}
                {/* 0% badge */}
                <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <span className="text-[9px] text-primary font-semibold">
                    0% commission
                  </span>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ── Gestion du menu (1col compact) ── */}
          <StaggerItem className="bento-card group flex flex-col p-5">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <BentoLabel text="Contenu" />
            <h3 className="text-base font-semibold mb-1">Gestion du menu</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Mettez à jour vos plats, prix et options en temps réel.
            </p>
            {/* Mini menu list */}
            <div className="mt-auto rounded-lg bg-black/20 border border-white/[0.04] p-3 space-y-1.5">
              {[
                { name: "Burger Classic", price: "12€", active: false },
                { name: "Salade César", price: "9€", active: true },
                { name: "Tiramisu", price: "7€", active: false },
              ].map((item) => (
                <div
                  key={item.name}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
                    item.active
                      ? "bg-primary/[0.06] border-l-2 border-primary/40"
                      : "bg-white/[0.02]"
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span className="text-white/50 flex-1">{item.name}</span>
                  <span className="text-white/30">{item.price}</span>
                </div>
              ))}
            </div>
          </StaggerItem>

          {/* ── Dashboard admin (1col compact) ── */}
          <StaggerItem className="bento-card group flex flex-col p-5">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <BentoLabel text="Pilotage" />
            <h3 className="text-base font-semibold mb-1">Dashboard admin</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Pilotez votre activité depuis une interface unique et claire.
            </p>
            {/* Mini chart */}
            <div className="mt-auto rounded-lg bg-black/20 border border-white/[0.04] p-3">
              <div className="flex items-end gap-1 h-12">
                {[30, 45, 35, 55, 50, 70, 65, 85].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-colors ${
                      i === 7
                        ? "bg-primary/30"
                        : "bg-white/[0.06]"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary/50"
                >
                  <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
                </svg>
                <span className="text-[9px] text-primary/50 font-medium">
                  +24%
                </span>
              </div>
            </div>
          </StaggerItem>

          {/* ── Centralisation (2col wide) ── */}
          <StaggerItem className="md:col-span-2 lg:col-span-2 bento-card group p-6 lg:p-8">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <BentoLabel text="Opérations" />
            <h3 className="text-lg font-semibold mb-1.5">
              Centralisation des commandes
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Réunissez toutes vos commandes — site, plateformes, sur place —
              dans un seul flux.
            </p>
            {/* Convergence flow */}
            <div className="relative rounded-xl bg-black/30 border border-white/[0.04] p-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(82,207,175,0.03)_0%,transparent_60%)]" />
              <div className="relative flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-0">
                {/* Sources */}
                <div className="flex flex-row sm:flex-col gap-2 flex-wrap justify-center">
                  {[
                    { name: "Site web", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/60"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20" /><path d="M2 12h20" /></svg> },
                    { name: "Uber Eats", icon: <img src="/logos/uber-eats.png" alt="Uber Eats" width={14} height={14} className="w-3.5 h-3.5 rounded-sm object-cover" /> },
                    { name: "Sur place", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/60"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
                  ].map((src) => (
                    <div
                      key={src.name}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]"
                    >
                      {src.icon}
                      <span className="text-[10px] text-white/40">
                        {src.name}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Arrows */}
                <svg className="hidden sm:block w-24 h-16 mx-4 shrink-0" viewBox="0 0 96 64">
                  <path
                    d="M0 8 C30 8, 50 32, 96 32"
                    fill="none"
                    stroke="rgba(82,207,175,0.15)"
                    strokeWidth="1"
                  />
                  <path
                    d="M0 32 C30 32, 50 32, 96 32"
                    fill="none"
                    stroke="rgba(82,207,175,0.25)"
                    strokeWidth="1"
                  />
                  <path
                    d="M0 56 C30 56, 50 32, 96 32"
                    fill="none"
                    stroke="rgba(82,207,175,0.15)"
                    strokeWidth="1"
                  />
                </svg>
                {/* Mobile arrow */}
                <svg className="sm:hidden w-6 h-6 text-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                {/* Unified inbox */}
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/[0.06] border border-primary/20 shadow-[0_0_20px_rgba(82,207,175,0.06)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-primary/60"
                  >
                    <path d="M22 12h-6l-2 3H10l-2-3H2" />
                    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                  </svg>
                  <span className="text-[10px] text-primary/60 font-medium">
                    Flux unifié
                  </span>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ── Fidélisation (2col wide) ── */}
          <StaggerItem className="md:col-span-2 lg:col-span-2 bento-card group p-6 lg:p-8">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <BentoLabel text="Engagement" />
            <h3 className="text-lg font-semibold mb-1.5">
              Fidélisation & gamification
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Récompensez la fidélité de vos clients avec un programme engageant
              et personnalisable.
            </p>
            {/* Loyalty card visual */}
            <div className="relative rounded-xl bg-black/30 border border-white/[0.04] p-4 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(82,207,175,0.03)_0%,transparent_60%)]" />
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                {/* Stamp card */}
                <div className="flex-1 w-full rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2">
                    Carte de fidélité
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {[true, true, true, true, false, false].map(
                      (filled, i) => (
                        <div
                          key={i}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border ${
                            filled
                              ? "bg-primary/20 border-primary/30"
                              : "bg-white/[0.02] border-white/[0.08]"
                          } flex items-center justify-center`}
                        >
                          {filled && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="text-primary/60"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
                {/* Stat */}
                <div className="text-center shrink-0">
                  <div className="text-2xl font-bold text-primary/70">
                    +12%
                  </div>
                  <div className="text-[9px] text-muted-foreground/50">
                    rétention
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

function BentoLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary/60 uppercase tracking-wider mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
      {text}
    </span>
  );
}
