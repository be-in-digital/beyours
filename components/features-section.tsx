"use client";

import { useEffect, useRef, useState } from "react";
import { SectionBadge } from "@/components/ui/section-badge";
import { SectionHeader } from "@/components/ui/section-header";

const features = [
  {
    tag: "01",
    title: "Site web premium",
    description:
      "Un site élégant et performant à votre image, optimisé pour le mobile et conçu pour convertir les visiteurs en clients.",
    visual: <SiteVisual />,
  },
  {
    tag: "02",
    title: "Commande en ligne & Click and Collect",
    description:
      "Recevez des commandes directement depuis votre site — en livraison ou en retrait sur place — sans commission ni intermédiaire.",
    visual: <OrderVisual />,
  },
  {
    tag: "03",
    title: "Gestion du menu",
    description:
      "Mettez à jour vos plats, prix, photos et disponibilité en temps réel depuis le dashboard. Fini les menus PDF obsolètes.",
    visual: <MenuVisual />,
  },
  {
    tag: "04",
    title: "Dashboard administrateur",
    description:
      "Pilotez l'ensemble de votre activité digitale depuis une interface unique, claire et intuitive.",
    visual: <DashboardVisual />,
  },
  {
    tag: "05",
    title: "Centralisation des commandes",
    description:
      "Réunissez toutes vos commandes — site, plateformes, sur place — dans un seul flux unifié et en temps réel.",
    visual: <CentralVisual />,
  },
  {
    tag: "06",
    title: "Intégration Uber Eats & Deliveroo",
    description:
      "En cours de certification officielle auprès des plateformes. Offerte à tous les clients dès validation, sans surcoût.",
    visual: <IntegrationVisual />,
  },
  {
    tag: "07",
    title: "Fidélisation & Gamification",
    description:
      "Récompensez la fidélité de vos clients avec un programme engageant, gamifié et entièrement personnalisable.",
    visual: <LoyaltyVisual />,
  },
  {
    tag: "08",
    title: "Analytics",
    description:
      "Comprenez vos performances avec des données claires, des tendances visuelles et des insights actionnables.",
    visual: <AnalyticsVisual />,
  },
  {
    tag: "09",
    title: "Expérience mobile",
    description:
      "Une application native iOS & Android à votre image, pensée mobile-first pour vos clients.",
    visual: <MobileVisual />,
  },
  {
    tag: "10",
    title: "Formation Google Business Profile",
    description:
      "Un accompagnement premium pour maîtriser votre fiche Google, gérer vos avis et dominer le référencement local.",
    visual: <FormationVisual />,
  },
];

export function FeaturesSection() {
  const [active, setActive] = useState(0);
  const sentinelsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sentinelsRef.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActive(i);
        },
        { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section id="features" className="relative overflow-x-clip">
      {/* Header — not sticky */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 lg:pt-32 pb-12">
        <SectionBadge text="Fonctionnalités" />
        <SectionHeader
          title="Tout ce dont votre restaurant a besoin"
          description="Une suite complète d'outils conçus spécifiquement pour la restauration."
        />
      </div>

      {/* Scroll-driven area */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16">
          {/* ── Left: sticky feature nav ── */}
          <div className="hidden lg:block relative">
            <div className="sticky top-[20vh]">
              {/* Progress line */}
              <div className="absolute left-0 top-0 bottom-0 w-px bg-border">
                <div
                  className="w-px bg-primary transition-all duration-500 ease-out"
                  style={{
                    height: `${((active + 1) / features.length) * 100}%`,
                  }}
                />
              </div>

              <div className="pl-8 space-y-2">
                {features.map((f, i) => (
                  <button
                    key={f.tag}
                    type="button"
                    onClick={() => {
                      const el = sentinelsRef.current[i];
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`group w-full text-left rounded-xl px-5 py-4 transition-all duration-300 ${
                      active === i
                        ? "bg-white/[0.04] border border-primary/15"
                        : "border border-transparent hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`text-xs font-mono transition-colors duration-300 ${
                          active === i
                            ? "text-primary"
                            : "text-muted-foreground/40"
                        }`}
                      >
                        {f.tag}
                      </span>
                      <span
                        className={`text-sm font-semibold transition-colors duration-300 ${
                          active === i
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {f.title}
                      </span>
                    </div>
                    <p
                      className={`text-sm leading-relaxed transition-all duration-300 overflow-hidden ${
                        active === i
                          ? "text-muted-foreground max-h-24 opacity-100 mt-1"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      {f.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: scroll sentinels + visuals ── */}
          <div className="relative">
            {features.map((f, i) => (
              <div
                key={f.tag}
                ref={(el) => {
                  sentinelsRef.current[i] = el;
                }}
                className="min-h-[40vh] lg:min-h-[60vh] flex flex-col justify-center py-8"
              >
                {/* Mobile: show text inline */}
                <div className="lg:hidden mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-primary">
                      {f.tag}
                    </span>
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>

                {/* Visual */}
                <div className="sticky top-[25vh] lg:relative lg:top-0">
                  <div className="relative rounded-2xl border border-white/[0.06] bg-surface-1 overflow-hidden p-4 sm:p-6 min-h-[240px] sm:min-h-[320px] flex items-center justify-center">
                    {/* Ambient glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(82,207,175,0.04)_0%,transparent_70%)] pointer-events-none" />
                    {f.visual}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-16" />
    </section>
  );
}

/* ════════════════════════════════════════════════
   Feature Visuals — unique mockup per feature
   ════════════════════════════════════════════════ */

function SiteVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="ml-3 h-5 flex-1 max-w-[180px] rounded bg-white/[0.04] flex items-center px-2">
            <span className="text-[9px] text-muted-foreground/50 font-mono">
              mon-restaurant.fr
            </span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-24 rounded-lg bg-gradient-to-br from-primary/8 to-transparent flex items-end p-3">
            <div className="space-y-1">
              <div className="h-3 w-28 rounded bg-white/[0.1]" />
              <div className="h-2 w-20 rounded bg-white/[0.06]" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
              <span className="text-[9px] text-primary/70 font-medium">Commander</span>
            </div>
            <div className="h-8 flex-1 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <span className="text-[9px] text-white/30">Réserver</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                <div className="h-10 rounded bg-white/[0.03] mb-1.5" />
                <div className="h-1.5 w-3/4 rounded bg-white/[0.06]" />
                <div className="h-1.5 w-1/2 rounded bg-white/[0.04] mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto space-y-3">
      {/* Order flow steps */}
      {[
        { step: "1", label: "Choix du plat", detail: "Burger Classic × 2", price: "24€" },
        { step: "2", label: "Panier validé", detail: "Livraison — 30 min", price: "27€" },
        { step: "3", label: "Paiement confirmé", detail: "CB •••• 4242", price: null },
      ].map((item, i) => (
        <div
          key={item.step}
          className={`flex items-start gap-4 rounded-xl p-4 transition-all ${
            i === 2
              ? "bg-primary/[0.06] border border-primary/15"
              : "bg-white/[0.02] border border-white/[0.06]"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
              i === 2
                ? "bg-primary/20 text-primary"
                : "bg-white/[0.04] text-white/30"
            }`}
          >
            {i === 2 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              item.step
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white/70">{item.label}</div>
            <div className="text-xs text-muted-foreground/50 mt-0.5">{item.detail}</div>
          </div>
          {item.price && (
            <span className="text-sm font-semibold text-white/50">{item.price}</span>
          )}
        </div>
      ))}
      {/* Badge */}
      <div className="flex justify-center">
        <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold">
          0% de commission
        </span>
      </div>
    </div>
  );
}

function MenuVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-[10px] text-white/40 font-medium">Menu principal</span>
          <div className="flex gap-1.5">
            <div className="px-2 py-0.5 rounded bg-primary/10 text-[8px] text-primary/60">+ Ajouter</div>
            <div className="px-2 py-0.5 rounded bg-white/[0.04] text-[8px] text-white/30">Filtrer</div>
          </div>
        </div>
        {/* Menu items */}
        <div className="p-3 space-y-1.5">
          {[
            { name: "Burger Classic", price: "12.90€", cat: "Burgers", editing: false },
            { name: "Salade César", price: "9.50€", cat: "Entrées", editing: true },
            { name: "Tiramisu Maison", price: "7.00€", cat: "Desserts", editing: false },
            { name: "Coca-Cola", price: "3.50€", cat: "Boissons", editing: false },
            { name: "Pizza Margherita", price: "11.00€", cat: "Pizzas", editing: false },
          ].map((item) => (
            <div
              key={item.name}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                item.editing
                  ? "bg-primary/[0.06] border border-primary/20 ring-1 ring-primary/10"
                  : "bg-white/[0.02] border border-transparent"
              }`}
            >
              <div className="w-8 h-8 rounded-md bg-white/[0.04] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white/60">{item.name}</div>
                <div className="text-[10px] text-muted-foreground/40">{item.cat}</div>
              </div>
              <span className={`text-xs font-medium ${item.editing ? "text-primary/60" : "text-white/30"}`}>
                {item.price}
              </span>
              {item.editing && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-[10px] text-white/40 font-medium">Dashboard</span>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/[0.06]" />
          </div>
        </div>
        {/* Stats row */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {[
            { label: "Commandes", value: "128", change: "+12%" },
            { label: "Revenus", value: "3.4k€", change: "+24%" },
            { label: "Clients", value: "89", change: "+8%" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5">
              <div className="text-[9px] text-muted-foreground/40">{s.label}</div>
              <div className="text-sm font-bold text-white/70 mt-0.5">{s.value}</div>
              <span className="text-[9px] text-primary/50 font-medium">{s.change}</span>
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="px-3 pb-3">
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
            <div className="flex items-end gap-1 h-20">
              {[25, 40, 35, 55, 45, 70, 60, 80, 72, 90, 68, 85].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${
                    i >= 10 ? "bg-primary/25" : "bg-white/[0.06]"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/50">
                <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
              </svg>
              <span className="text-[9px] text-primary/50 font-medium">Tendance haussière</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CentralVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto flex flex-col sm:flex-row items-center gap-4">
      {/* Sources */}
      <div className="flex flex-row sm:flex-col gap-2 shrink-0 flex-wrap justify-center">
        {[
          { name: "Site web", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/70"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20" /><path d="M2 12h20" /></svg> },
          { name: "Uber Eats", icon: <img src="/logos/uber-eats.png" alt="Uber Eats" width={16} height={16} className="w-4 h-4 rounded object-cover" /> },
          { name: "Sur place", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/70"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
          { name: "Deliveroo", icon: <img src="/logos/deliveroo.png" alt="Deliveroo" width={16} height={16} className="w-4 h-4 rounded object-cover" /> },
        ].map((src) => (
          <div
            key={src.name}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
          >
            {src.icon}
            <span className="text-[10px] text-white/40">{src.name}</span>
          </div>
        ))}
      </div>

      {/* Convergence arrows */}
      <svg className="hidden sm:block w-16 h-32 shrink-0" viewBox="0 0 64 128">
        <path d="M0 16 C20 16, 40 64, 64 64" fill="none" stroke="rgba(82,207,175,0.12)" strokeWidth="1" />
        <path d="M0 48 C20 48, 40 64, 64 64" fill="none" stroke="rgba(82,207,175,0.18)" strokeWidth="1" />
        <path d="M0 80 C20 80, 40 64, 64 64" fill="none" stroke="rgba(82,207,175,0.12)" strokeWidth="1" />
        <path d="M0 112 C20 112, 40 64, 64 64" fill="none" stroke="rgba(82,207,175,0.08)" strokeWidth="1" />
        <circle cx="64" cy="64" r="3" fill="rgba(82,207,175,0.3)" />
        <circle cx="64" cy="64" r="6" fill="rgba(82,207,175,0.08)" />
      </svg>
      {/* Mobile arrow */}
      <svg className="sm:hidden w-8 h-8 text-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>

      {/* Unified inbox */}
      <div className="w-full sm:flex-1 rounded-xl bg-primary/[0.04] border border-primary/15 p-3 space-y-1.5">
        <div className="text-[9px] text-primary/50 uppercase tracking-wider font-medium mb-2">
          Flux unifié
        </div>
        {["#1042 — Burger ×2", "#1043 — Pizza ×1", "#1044 — Salade ×3"].map((order) => (
          <div key={order} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02]">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
            <span className="text-[9px] text-white/40">{order}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoyaltyVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto space-y-4">
      {/* Loyalty card */}
      <div className="rounded-xl bg-gradient-to-br from-primary/[0.06] to-transparent border border-primary/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-primary/50 uppercase tracking-wider font-medium">
            Carte fidélité
          </span>
          <span className="text-[10px] text-white/30">4/6 tampons</span>
        </div>
        <div className="flex items-center gap-3">
          {[true, true, true, true, false, false].map((filled, i) => (
            <div
              key={i}
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                filled
                  ? "bg-primary/15 border-primary/30"
                  : "bg-white/[0.02] border-white/[0.08] border-dashed"
              }`}
            >
              {filled && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-primary/50">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Reward stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Rétention", value: "+12%" },
          { label: "Panier moyen", value: "+8€" },
          { label: "Visites/mois", value: "3.2×" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5 text-center">
            <div className="text-sm font-bold text-primary/60">{stat.value}</div>
            <div className="text-[8px] text-muted-foreground/40 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 space-y-4">
        {/* Line chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/40 font-medium">Revenus mensuels</span>
            <span className="text-[10px] text-primary/50 font-medium">+32%</span>
          </div>
          <svg viewBox="0 0 300 80" className="w-full h-16">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(82,207,175,0.15)" />
                <stop offset="100%" stopColor="rgba(82,207,175,0)" />
              </linearGradient>
            </defs>
            <path
              d="M0 60 C20 55, 40 50, 60 45 C80 40, 100 42, 120 38 C140 34, 160 30, 180 25 C200 20, 220 22, 240 15 C260 10, 280 8, 300 5 L300 80 L0 80 Z"
              fill="url(#areaGrad)"
            />
            <path
              d="M0 60 C20 55, 40 50, 60 45 C80 40, 100 42, 120 38 C140 34, 160 30, 180 25 C200 20, 220 22, 240 15 C260 10, 280 8, 300 5"
              fill="none"
              stroke="rgba(82,207,175,0.5)"
              strokeWidth="2"
            />
            {/* Dot at end */}
            <circle cx="300" cy="5" r="3" fill="rgba(82,207,175,0.6)" />
            <circle cx="300" cy="5" r="6" fill="rgba(82,207,175,0.15)" />
          </svg>
        </div>
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Taux de conversion", value: "4.8%" },
            { label: "Temps moyen", value: "2m 12s" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5">
              <div className="text-[9px] text-muted-foreground/40">{m.label}</div>
              <div className="text-sm font-bold text-white/60 mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileVisual() {
  return (
    <div className="relative flex items-center justify-center gap-4">
      {/* Phone frame */}
      <div className="w-[140px] rounded-2xl border-2 border-white/[0.08] bg-black/40 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)]">
        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[7px] text-white/20">9:41</span>
          <div className="flex gap-1">
            <div className="w-2.5 h-1.5 rounded-sm bg-white/15" />
            <div className="w-2.5 h-1.5 rounded-sm bg-white/15" />
          </div>
        </div>
        {/* App content */}
        <div className="p-2.5 space-y-2">
          <div className="h-14 rounded-lg bg-gradient-to-br from-primary/10 to-transparent flex items-end p-2">
            <div className="space-y-0.5">
              <div className="h-1.5 w-14 rounded bg-white/[0.1]" />
              <div className="h-1 w-10 rounded bg-white/[0.06]" />
            </div>
          </div>
          <div className="flex gap-1.5">
            {["Plats", "Boissons", "Desserts"].map((cat) => (
              <div
                key={cat}
                className={`px-1.5 py-0.5 rounded text-[6px] ${
                  cat === "Plats"
                    ? "bg-primary/15 text-primary/60"
                    : "bg-white/[0.03] text-white/20"
                }`}
              >
                {cat}
              </div>
            ))}
          </div>
          {[1, 2].map((n) => (
            <div key={n} className="flex gap-1.5 p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-md bg-white/[0.04] shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-3/4 rounded bg-white/[0.06]" />
                <div className="h-1 w-1/2 rounded bg-white/[0.04]" />
                <div className="h-1 w-6 rounded bg-primary/20" />
              </div>
            </div>
          ))}
          <div className="h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
            <span className="text-[7px] text-primary/60 font-medium">Voir le panier</span>
          </div>
        </div>
        {/* Home indicator */}
        <div className="flex justify-center py-1.5">
          <div className="w-8 h-1 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Floating badges */}
      <div className="flex flex-col gap-3">
        {[
          { icon: "⚡", text: "Chargement < 1s" },
          { icon: "📱", text: "App native" },
          { icon: "🔔", text: "Push notifications" },
        ].map((badge) => (
          <div
            key={badge.text}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
          >
            <span className="text-xs">{badge.icon}</span>
            <span className="text-[10px] text-white/40">{badge.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="flex flex-col items-center gap-4">
        {/* Platform sources */}
        <div className="flex gap-3">
          {[
            {
              name: "Uber Eats",
              bg: "bg-[#06C167]/15",
              border: "border-[#06C167]/20",
              icon: <img src="/logos/uber-eats.png" alt="Uber Eats" width={20} height={20} className="w-5 h-5 rounded object-cover" />,
            },
            {
              name: "Deliveroo",
              bg: "bg-[#00CCBC]/15",
              border: "border-[#00CCBC]/20",
              icon: <img src="/logos/deliveroo.png" alt="Deliveroo" width={20} height={20} className="w-5 h-5 rounded object-cover" />,
            },
            {
              name: "Uber Direct",
              bg: "bg-[#276EF1]/15",
              border: "border-[#276EF1]/20",
              icon: <img src="/logos/uber-direct.png" alt="Uber Direct" width={20} height={20} className="w-5 h-5 rounded object-cover" />,
            },
          ].map((platform) => (
            <div
              key={platform.name}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl ${platform.bg} border ${platform.border}`}
            >
              {platform.icon}
              <span className="text-[10px] text-white/50 font-medium">{platform.name}</span>
            </div>
          ))}
        </div>

        {/* Connection arrows */}
        <svg className="w-full h-10" viewBox="0 0 300 40">
          <path d="M60 0 C60 20, 150 20, 150 40" fill="none" stroke="rgba(82,207,175,0.12)" strokeWidth="1" />
          <path d="M150 0 C150 10, 150 30, 150 40" fill="none" stroke="rgba(82,207,175,0.18)" strokeWidth="1" />
          <path d="M240 0 C240 20, 150 20, 150 40" fill="none" stroke="rgba(82,207,175,0.12)" strokeWidth="1" />
          <circle cx="150" cy="40" r="3" fill="rgba(82,207,175,0.3)" />
        </svg>

        {/* Central hub */}
        <div className="w-full rounded-xl bg-primary/[0.04] border border-primary/15 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/60">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] text-primary/50 uppercase tracking-wider font-medium">Dashboard unifié</div>
              <div className="text-[9px] text-muted-foreground/40">Toutes les plateformes en un clic</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { src: "Uber Eats", order: "#UE-4821", status: "En préparation" },
              { src: "Deliveroo", order: "#DL-1203", status: "Prête" },
              { src: "Uber Direct", order: "#UD-0087", status: "En livraison" },
            ].map((item) => (
              <div key={item.order} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                <span className="text-[9px] text-white/40 flex-1">{item.src} — {item.order}</span>
                <span className="text-[8px] text-primary/40">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormationVisual() {
  return (
    <div className="relative w-full max-w-sm mx-auto space-y-3">
      {/* Google Business Profile card */}
      <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-400/60">G</span>
          </div>
          <div>
            <div className="text-[10px] text-white/50 font-medium">Google Business Profile</div>
            <div className="text-[8px] text-muted-foreground/40">Votre fiche optimisée</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg key={star} width="10" height="10" viewBox="0 0 24 24" fill={star <= 4 ? "rgba(250,204,21,0.5)" : "none"} stroke="rgba(250,204,21,0.3)" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
            <span className="text-[9px] text-yellow-400/40 ml-1">4.7</span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          {[
            { label: "Visibilité locale", value: "+180%", icon: "📍" },
            { label: "Avis répondus", value: "98%", icon: "💬" },
            { label: "Posts publiés", value: "12/mois", icon: "📝" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]">
              <span className="text-xs">{stat.icon}</span>
              <span className="text-[10px] text-white/40 flex-1">{stat.label}</span>
              <span className="text-[10px] text-primary/50 font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formation badge */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/[0.04] border border-primary/15">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/60">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="text-[10px] text-primary/60 font-medium">Formation incluse</div>
          <div className="text-[8px] text-muted-foreground/40">Accompagnement personnalisé à la gestion de votre fiche</div>
        </div>
      </div>
    </div>
  );
}
