/* ═══════════════════════════════════════════════
   Feature Visuals — 3 mockup patterns with variants
   ═══════════════════════════════════════════════ */

import type { Feature } from "./features-data";

/** Route to the right mockup based on feature.mockupPattern */
export function FeatureVisual({ feature }: { feature: Feature }) {
  switch (feature.mockupPattern) {
    case "dashboard":
      return <DashboardMockup feature={feature} />;
    case "mobile":
      return <MobileMockup feature={feature} />;
    case "integration":
      return <IntegrationMockup feature={feature} />;
  }
}

/* ── Pattern 1: Dashboard Mockup ── */

function DashboardMockup({ feature }: { feature: Feature }) {
  const stats = dashboardVariants[feature.id] ?? dashboardVariants.default;

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl border border-white/[0.06] bg-[#0c0c10] overflow-hidden shadow-[0_0_60px_rgba(82,207,175,0.04)]">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
        <div className="flex-1 mx-8">
          <div className="h-5 w-48 max-w-full rounded-md bg-white/[0.04] mx-auto" />
        </div>
      </div>

      <div className="flex h-[calc(100%-44px)]">
        {/* Sidebar */}
        <div className="hidden sm:flex w-[72px] flex-col gap-3 items-center py-4 border-r border-white/[0.06] bg-white/[0.01]">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-lg ${i === 0 ? "bg-primary/15 border border-primary/20" : "bg-white/[0.04]"}`}
            />
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 p-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="text-[10px] text-muted-foreground/60 mb-1">
                  {stat.label}
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {stat.value}
                </div>
                <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/40"
                    style={{ width: `${stat.bar}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Table rows */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
              >
                <div className="w-6 h-6 rounded-md bg-primary/10" />
                <div className="flex-1 h-3 rounded bg-white/[0.06]" style={{ width: `${60 + i * 8}%` }} />
                <div className="h-3 w-12 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.06] rounded-full blur-[60px] pointer-events-none" />
    </div>
  );
}

const dashboardVariants: Record<string, { label: string; value: string; bar: number }[]> = {
  "site-web-premium": [
    { label: "Visiteurs", value: "2 847", bar: 78 },
    { label: "Taux conversion", value: "4.2%", bar: 65 },
    { label: "Pages vues", value: "12.4k", bar: 88 },
  ],
  "centralisation-commandes": [
    { label: "Commandes", value: "156", bar: 82 },
    { label: "En cours", value: "12", bar: 45 },
    { label: "CA du jour", value: "3 240 \u20ac", bar: 72 },
  ],
  analytics: [
    { label: "CA mensuel", value: "48.2k \u20ac", bar: 85 },
    { label: "Panier moyen", value: "32.50 \u20ac", bar: 68 },
    { label: "Taux retour", value: "34%", bar: 55 },
  ],
  default: [
    { label: "Total", value: "1 234", bar: 70 },
    { label: "Actifs", value: "567", bar: 55 },
    { label: "Croissance", value: "+12%", bar: 62 },
  ],
};

/* ── Pattern 2: Mobile Mockup ── */

function MobileMockup({ feature }: { feature: Feature }) {
  const content = mobileVariants[feature.id] ?? mobileVariants.default;

  return (
    <div className="relative flex items-center justify-center w-full aspect-[4/3]">
      {/* Phone frame */}
      <div className="relative w-[200px] sm:w-[220px] h-[400px] sm:h-[440px] rounded-[2rem] border-2 border-white/[0.08] bg-[#0c0c10] shadow-[0_0_60px_rgba(82,207,175,0.06)] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#0c0c10] rounded-b-2xl z-10" />

        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-8 pb-2">
          <div className="text-[9px] text-white/40 font-medium">9:41</div>
          <div className="flex gap-1">
            <div className="w-3 h-2 rounded-sm bg-white/20" />
            <div className="w-3 h-2 rounded-sm bg-white/20" />
          </div>
        </div>

        {/* App header */}
        <div className="px-4 py-3">
          <div className="text-[11px] font-semibold text-foreground">
            {content.header}
          </div>
          <div className="text-[9px] text-muted-foreground/60 mt-0.5">
            {content.subheader}
          </div>
        </div>

        {/* Cards */}
        <div className="px-3 space-y-2">
          {content.cards.map((card, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 ${
                i === 0
                  ? "border-primary/20 bg-primary/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${i === 0 ? "bg-primary/15" : "bg-white/[0.06]"} flex items-center justify-center`}>
                  <div className={`w-3 h-3 rounded ${i === 0 ? "bg-primary/40" : "bg-white/10"}`} />
                </div>
                <div>
                  <div className="text-[9px] font-medium text-foreground">{card.title}</div>
                  <div className="text-[8px] text-muted-foreground/50">{card.subtitle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="absolute bottom-6 left-3 right-3">
          <div className="h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <div className="text-[9px] font-medium text-primary/80">
              {content.cta}
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/20" />
      </div>

      {/* Ambient glow behind phone */}
      <div className="absolute w-48 h-48 bg-primary/[0.08] rounded-full blur-[80px] pointer-events-none" />
    </div>
  );
}

const mobileVariants: Record<string, { header: string; subheader: string; cards: { title: string; subtitle: string }[]; cta: string }> = {
  "commande-en-ligne": {
    header: "Votre commande",
    subheader: "Livraison ou click & collect",
    cards: [
      { title: "Burger Signature", subtitle: "14.90 \u20ac \u00b7 Populaire" },
      { title: "Salade Caesar", subtitle: "11.50 \u20ac" },
      { title: "Tiramisu Maison", subtitle: "7.90 \u20ac" },
      { title: "Click & Collect", subtitle: "Retrait dans 20 min" },
    ],
    cta: "Commander \u00b7 34.30 \u20ac",
  },
  "experience-mobile": {
    header: "Le Petit Bistrot",
    subheader: "Bienvenue, Jean",
    cards: [
      { title: "Commander", subtitle: "Livraison ou sur place" },
      { title: "Mon programme", subtitle: "320 pts \u00b7 Niveau Gold" },
      { title: "Mes commandes", subtitle: "3 commandes ce mois" },
      { title: "Notifications", subtitle: "2 nouvelles offres" },
    ],
    cta: "Commander maintenant",
  },
  "fidelisation-gamification": {
    header: "Votre fid\u00e9lit\u00e9",
    subheader: "Niveau Gold \u00b7 320 points",
    cards: [
      { title: "D\u00e9fi du jour", subtitle: "Commandez un dessert \u00b7 +50 pts" },
      { title: "Prochain palier", subtitle: "80 pts pour Platinum" },
      { title: "R\u00e9compense", subtitle: "Dessert offert \u00e0 500 pts" },
      { title: "Classement", subtitle: "#12 ce mois-ci" },
    ],
    cta: "Voir mes r\u00e9compenses",
  },
  default: {
    header: "Be in Digital",
    subheader: "Votre restaurant connect\u00e9",
    cards: [
      { title: "Fonctionnalit\u00e9 1", subtitle: "Description" },
      { title: "Fonctionnalit\u00e9 2", subtitle: "Description" },
      { title: "Fonctionnalit\u00e9 3", subtitle: "Description" },
    ],
    cta: "D\u00e9couvrir",
  },
};

/* ── Pattern 3: Integration Mockup ── */

function IntegrationMockup({ feature }: { feature: Feature }) {
  void feature;

  return (
    <div className="relative w-full aspect-[4/3] flex items-center justify-center">
      {/* Central hub */}
      <div className="relative z-10 w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(82,207,175,0.1)]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Platform nodes */}
      {integrationNodes.map((node, i) => {
        const angle = (i / integrationNodes.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 120;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <div
            key={node.name}
            className="absolute z-10"
            style={{
              left: `calc(50% + ${x}px - 28px)`,
              top: `calc(50% + ${y}px - 28px)`,
            }}
          >
            {/* Connection line */}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: "28px",
                top: "28px",
                width: "1px",
                height: "1px",
                overflow: "visible",
              }}
            >
              <line
                x1="0"
                y1="0"
                x2={-x}
                y2={-y}
                stroke="rgba(82,207,175,0.15)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </svg>

            {/* Node */}
            <div className="w-14 h-14 rounded-xl border border-white/[0.08] bg-[#0c0c10] flex flex-col items-center justify-center gap-1.5 shadow-lg">
              {node.icon}
              <span className="text-[7px] text-muted-foreground/60 font-medium">
                {node.name}
              </span>
            </div>
          </div>
        );
      })}

      {/* Ambient glows */}
      <div className="absolute w-64 h-64 bg-primary/[0.04] rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-24 h-24 bg-primary/[0.06] rounded-full blur-[40px] pointer-events-none" />
    </div>
  );
}

/* ── Platform logos & icons ── */

function PlatformLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={28}
      height={28}
      className="w-7 h-7 rounded-lg object-cover"
    />
  );
}

function SiteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/70">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function SurPlaceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/70">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

const integrationNodes: { name: string; icon: React.ReactNode }[] = [
  { name: "Uber Eats", icon: <PlatformLogo src="/logos/uber-eats.png" alt="Uber Eats" /> },
  { name: "Deliveroo", icon: <PlatformLogo src="/logos/deliveroo.png" alt="Deliveroo" /> },
  { name: "Uber Direct", icon: <PlatformLogo src="/logos/uber-direct.png" alt="Uber Direct" /> },
  { name: "Votre site", icon: <SiteIcon /> },
  { name: "Sur place", icon: <SurPlaceIcon /> },
];
