"use client";

import { useState } from "react";
import { SectionBadge } from "@/components/ui/section-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { FadeIn, ScaleIn } from "@/components/ui/motion";

const products = [
  {
    id: "storefront",
    name: "Storefront",
    description: "Vitrine & commande en ligne",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><ellipse cx="12" cy="12" rx="5" ry="10" />
      </svg>
    ),
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Pilotage centralisé",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    id: "fidelite",
    name: "Fidélité",
    description: "Programme de récompenses",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Données & performance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    id: "menu",
    name: "Menu Digital",
    description: "Gestion en temps réel",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
  {
    id: "branding",
    name: "Branding",
    description: "Identité visuelle digitale",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      </svg>
    ),
  },
];

export function ProductShowcase() {
  const [hovered, setHovered] = useState<string | null>(null);

  const leftProducts = products.slice(0, 3);
  const rightProducts = products.slice(3);

  return (
    <section
      id="ecosystem"
      className="relative py-16 sm:py-24 lg:py-32 overflow-hidden"
    >
      {/* Background glows */}
      <div className="blur-orb w-[600px] h-[600px] bg-primary/[0.04] top-[20%] left-1/2 -translate-x-1/2" />
      <div className="blur-orb w-[300px] h-[300px] bg-primary/[0.06] top-[40%] left-1/2 -translate-x-1/2" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <SectionBadge text="L'écosystème" />
          <SectionHeader
            title="Une plateforme, toutes les briques"
            description="Chaque module s'intègre parfaitement pour offrir une expérience digitale cohérente à vos clients."
          />
        </FadeIn>

        {/* ── Desktop: Hub layout with CSS connectors ── */}
        <ScaleIn delay={0.2} className="hidden lg:grid lg:grid-cols-[1fr_48px_auto_48px_1fr] items-center gap-0">
          {/* Left modules */}
          <div className="flex flex-col gap-4">
            {leftProducts.map((p) => (
              <ModuleCard
                key={p.id}
                product={p}
                isHovered={hovered === p.id}
                onHover={setHovered}
                align="right"
              />
            ))}
          </div>

          {/* Left connectors column */}
          <div className="flex flex-col gap-4 h-full justify-around py-2">
            {leftProducts.map((p) => (
              <Connector
                key={p.id}
                direction="left"
                active={hovered === p.id}
              />
            ))}
          </div>

          {/* Center: Dashboard hub */}
          <CenterHub activeModule={hovered} />

          {/* Right connectors column */}
          <div className="flex flex-col gap-4 h-full justify-around py-2">
            {rightProducts.map((p) => (
              <Connector
                key={p.id}
                direction="right"
                active={hovered === p.id}
              />
            ))}
          </div>

          {/* Right modules */}
          <div className="flex flex-col gap-4">
            {rightProducts.map((p) => (
              <ModuleCard
                key={p.id}
                product={p}
                isHovered={hovered === p.id}
                onHover={setHovered}
                align="left"
              />
            ))}
          </div>
        </ScaleIn>

        {/* ── Mobile: stacked cards ── */}
        <FadeIn delay={0.2} className="lg:hidden space-y-8">
          <div className="mx-auto w-fit">
            <CenterHub activeModule={null} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map((p) => (
              <ModuleCard
                key={p.id}
                product={p}
                isHovered={false}
                onHover={() => {}}
                align="left"
              />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── CSS connector line ── */

function Connector({
  direction,
  active,
}: {
  direction: "left" | "right";
  active: boolean;
}) {
  return (
    <div className="flex items-center h-[60px]">
      <div className="relative w-full h-px">
        {/* Base line */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            direction === "left"
              ? "bg-gradient-to-r from-white/[0.04] to-primary/15"
              : "bg-gradient-to-l from-white/[0.04] to-primary/15"
          }`}
        />
        {/* Active overlay */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            direction === "left"
              ? "bg-gradient-to-r from-primary/10 to-primary/50"
              : "bg-gradient-to-l from-primary/10 to-primary/50"
          } ${active ? "opacity-100 h-[2px] -top-px" : "opacity-0"}`}
        />
        {/* Glow on active */}
        {active && (
          <div
            className={`absolute -top-1 inset-x-0 h-[4px] blur-[3px] ${
              direction === "left"
                ? "bg-gradient-to-r from-transparent to-primary/30"
                : "bg-gradient-to-l from-transparent to-primary/30"
            }`}
          />
        )}
        {/* Dot at dashboard end */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            active
              ? "bg-primary/70 shadow-[0_0_6px_rgba(82,207,175,0.5)]"
              : "bg-white/10"
          } ${direction === "left" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"}`}
        />
        {/* Dot at card end */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            active
              ? "bg-primary/50 shadow-[0_0_6px_rgba(82,207,175,0.3)]"
              : "bg-white/[0.06]"
          } ${direction === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"}`}
        />
      </div>
    </div>
  );
}

/* ── Module card ── */

function ModuleCard({
  product,
  isHovered,
  onHover,
  align,
}: {
  product: (typeof products)[number];
  isHovered: boolean;
  onHover: (id: string | null) => void;
  align: "left" | "right";
}) {
  return (
    <div
      onMouseEnter={() => onHover(product.id)}
      onMouseLeave={() => onHover(null)}
      className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 cursor-default ${
        isHovered
          ? "bg-primary/[0.04] border-primary/20 shadow-[0_0_24px_rgba(82,207,175,0.08)]"
          : "bg-surface-1 border-white/[0.06] hover:border-white/[0.1]"
      } ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300 ${
          isHovered
            ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_12px_rgba(82,207,175,0.15)]"
            : "bg-white/[0.04] text-white/40 border border-white/[0.06]"
        }`}
      >
        {product.icon}
      </div>
      <div>
        <div
          className={`font-semibold text-sm transition-colors duration-300 ${
            isHovered ? "text-foreground" : "text-white/60"
          }`}
        >
          {product.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {product.description}
        </div>
      </div>
    </div>
  );
}

/* ── Center hub — dashboard mockup ── */

function CenterHub({ activeModule }: { activeModule: string | null }) {
  return (
    <div className="relative">
      {/* Glow behind */}
      <div
        className={`absolute -inset-12 rounded-full blur-[80px] transition-all duration-500 pointer-events-none ${
          activeModule ? "bg-primary/[0.08]" : "bg-primary/[0.04]"
        }`}
      />

      <div className="relative w-[280px] sm:w-[300px] rounded-2xl border border-white/[0.08] bg-surface-1 overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-surface-2/50">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 mx-2">
            <div className="h-4 max-w-[140px] mx-auto rounded bg-white/[0.04] flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground/40 font-mono">
                Be in Digital OS
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="p-3 space-y-2.5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Commandes", value: "128", area: "storefront" },
              { label: "Revenus", value: "3.4k€", area: "analytics" },
              { label: "Clients", value: "89", area: "fidelite" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-lg p-2 text-center transition-all duration-300 ${
                  activeModule === stat.area
                    ? "bg-primary/[0.08] border border-primary/20 shadow-[0_0_12px_rgba(82,207,175,0.1)]"
                    : "bg-white/[0.02] border border-white/[0.04]"
                }`}
              >
                <div className="text-[8px] text-muted-foreground/40">
                  {stat.label}
                </div>
                <div
                  className={`text-xs font-bold mt-0.5 transition-colors duration-300 ${
                    activeModule === stat.area
                      ? "text-primary/80"
                      : "text-white/50"
                  }`}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div
            className={`rounded-lg p-2.5 transition-all duration-300 ${
              activeModule === "analytics" || activeModule === "dashboard"
                ? "bg-primary/[0.06] border border-primary/15"
                : "bg-white/[0.02] border border-white/[0.04]"
            }`}
          >
            <div className="flex items-end gap-0.5 h-12">
              {[25, 40, 35, 55, 45, 70, 60, 80, 72, 90].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-colors duration-300 ${
                    activeModule === "analytics" ||
                    activeModule === "dashboard"
                      ? i >= 8
                        ? "bg-primary/40"
                        : "bg-primary/15"
                      : "bg-white/[0.06]"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Menu / content area */}
          <div
            className={`rounded-lg p-2 space-y-1 transition-all duration-300 ${
              activeModule === "menu"
                ? "bg-primary/[0.06] border border-primary/15"
                : "bg-white/[0.02] border border-white/[0.04]"
            }`}
          >
            {["Burger Classic", "Salade César", "Tiramisu"].map((item, i) => (
              <div key={item} className="flex items-center gap-2 px-1.5 py-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    activeModule === "menu" ? "bg-primary/50" : "bg-white/10"
                  }`}
                />
                <span className="text-[8px] text-white/30 flex-1">
                  {item}
                </span>
                <span className="text-[8px] text-white/20">
                  {["12€", "9€", "7€"][i]}
                </span>
              </div>
            ))}
          </div>

          {/* Branding / bottom bar */}
          <div
            className={`rounded-lg p-2 flex items-center gap-2 transition-all duration-300 ${
              activeModule === "branding"
                ? "bg-primary/[0.06] border border-primary/15"
                : "bg-white/[0.02] border border-white/[0.04]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md transition-colors duration-300 ${
                activeModule === "branding"
                  ? "bg-primary/20"
                  : "bg-white/[0.06]"
              }`}
            />
            <div className="flex-1 space-y-1">
              <div className="h-1.5 w-16 rounded bg-white/[0.06]" />
              <div className="h-1 w-10 rounded bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
