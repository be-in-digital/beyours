"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/ui/motion";
import { useCalendlyModal } from "@/lib/store";
import type { Template, Category } from "@/lib/templates-data";

type View = "desktop" | "tablet" | "mobile";

const viewConfig: Record<View, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablette" },
  mobile: { width: "375px", label: "Mobile" },
};

function TemplateRenderer({ template, view }: { template: Template; view: View }) {
  const [activeMenuCategory, setActiveMenuCategory] = useState(0);
  const isMobileView = view === "mobile";
  const isTabletView = view === "tablet";

  return (
    <div className="bg-[#0c0c0c] text-white overflow-y-auto max-h-[700px] scrollbar-thin">
      {/* Template Navbar */}
      <nav className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0c0c0c]/90 backdrop-blur-md">
        <div className={`flex items-center justify-between ${isMobileView ? "px-4 py-3" : "px-8 py-4"}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg" style={{ background: `${template.accent}20`, border: `1px solid ${template.accent}40` }}>
              <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: template.accent }}>
                {template.name[0]}
              </div>
            </div>
            {!isMobileView && (
              <span className="text-sm font-semibold">{template.name}</span>
            )}
          </div>
          <div className={`flex items-center ${isMobileView ? "gap-3" : "gap-6"}`}>
            {!isMobileView && (
              <>
                <span className="text-xs text-white/50 hover:text-white/80 cursor-pointer transition-colors">Menu</span>
                <span className="text-xs text-white/50 hover:text-white/80 cursor-pointer transition-colors">Commander</span>
                <span className="text-xs text-white/50 hover:text-white/80 cursor-pointer transition-colors">Contact</span>
              </>
            )}
            <div
              className="text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
              style={{ background: template.accent, color: "#000" }}
            >
              {isMobileView ? "Reserver" : "Reserver une table"}
            </div>
          </div>
        </div>
      </nav>

      {/* Template Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 20%, ${template.accent}15, transparent 70%)`,
          }}
        />
        <div className={`relative ${isMobileView ? "px-4 py-12" : isTabletView ? "px-8 py-16" : "px-12 py-20"} text-center`}>
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium mb-4 border"
            style={{
              color: template.accent,
              borderColor: `${template.accent}30`,
              background: `${template.accent}10`,
            }}
          >
            Restaurant {template.name}
          </div>
          <h1 className={`font-bold leading-tight ${isMobileView ? "text-2xl" : isTabletView ? "text-3xl" : "text-4xl"}`}>
            {template.hero.title}
          </h1>
          <p className={`mt-3 text-white/60 leading-relaxed ${isMobileView ? "text-xs" : "text-sm"} max-w-lg mx-auto`}>
            {template.hero.subtitle}
          </p>
          <div className={`mt-6 flex ${isMobileView ? "flex-col" : "flex-row"} items-center justify-center gap-3`}>
            <div
              className="px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-all hover:brightness-110"
              style={{
                background: template.accent,
                color: "#000",
                boxShadow: `0 0 20px ${template.accent}40`,
              }}
            >
              Commander en ligne
            </div>
            <div className="px-5 py-2.5 rounded-full text-xs font-medium text-white/70 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              Voir la carte
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section className={`${isMobileView ? "px-4 py-8" : "px-8 py-12"}`}>
        <div className="text-center mb-6">
          <h2 className={`font-semibold ${isMobileView ? "text-lg" : "text-xl"}`}>Notre Carte</h2>
          <p className="text-xs text-white/50 mt-1">Decouvrez nos specialites</p>
        </div>

        {/* Menu category tabs */}
        <div className="flex justify-center gap-2 mb-6">
          {template.menu.categories.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveMenuCategory(i)}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeMenuCategory === i
                  ? "text-black"
                  : "text-white/50 border border-white/10 hover:text-white/80"
              }`}
              style={activeMenuCategory === i ? { background: template.accent } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="space-y-3 max-w-md mx-auto">
          {template.menu.categories[activeMenuCategory]?.items.map((item) => (
            <div
              key={item.name}
              className="group flex items-start justify-between gap-4 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold" style={{ color: template.accent }}>{item.price} &euro;</span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `${template.accent}20` }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={template.accent} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={`border-t border-white/[0.06] ${isMobileView ? "px-4 py-6" : "px-8 py-8"}`}>
        <div className={`flex ${isMobileView ? "flex-col gap-4" : "items-center justify-between"}`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded" style={{ background: `${template.accent}20` }}>
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold" style={{ color: template.accent }}>
                  {template.name[0]}
                </div>
              </div>
              <span className="text-xs font-medium">{template.name}</span>
            </div>
            <p className="text-[10px] text-white/30">Powered by Be in Digital</p>
          </div>
          <div className="flex gap-4">
            <span className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer transition-colors">Instagram</span>
            <span className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer transition-colors">TikTok</span>
            <span className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer transition-colors">Google</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function TemplatePreview({ template, category }: { template: Template; category: Category }) {
  const [view, setView] = useState<View>("desktop");
  const { open: openCalendly } = useCalendlyModal();

  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Back + info */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/templates"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Templates
              </Link>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full border"
                  style={{
                    color: category.color.replace("0.8", "1"),
                    borderColor: category.color.replace("0.8", "0.3"),
                    background: category.color.replace("0.8", "0.1"),
                  }}
                >
                  {category.label}
                </span>
                <h1 className="text-xl font-semibold">{template.name}</h1>
              </div>
            </div>

            <button
              onClick={openCalendly}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 shadow-[0_0_20px_rgba(82,207,175,0.2)] cursor-pointer"
            >
              Choisir ce template
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 13L13 1M13 1H3M13 1V11" />
              </svg>
            </button>
          </div>
        </FadeIn>

        {/* Viewport switcher */}
        <FadeIn delay={0.1}>
          <div className="flex items-center justify-center gap-2 mb-6">
            {(Object.keys(viewConfig) as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  view === v
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-white/[0.04] text-muted-foreground border border-white/[0.08] hover:bg-white/[0.07] hover:text-foreground"
                }`}
              >
                {v === "desktop" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                )}
                {v === "tablet" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="16" height="20" x="4" y="2" rx="2" />
                    <path d="M12 18h.01" />
                  </svg>
                )}
                {v === "mobile" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="20" x="5" y="2" rx="2" />
                    <path d="M12 18h.01" />
                  </svg>
                )}
                {viewConfig[v].label}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Preview frame */}
        <FadeIn delay={0.2}>
          <div className="flex justify-center">
            <motion.div
              className="relative rounded-2xl border border-white/[0.1] bg-white/[0.02] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.3)]"
              animate={{ width: viewConfig[view].width }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ maxWidth: "100%" }}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center px-3">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 mr-2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <span className="text-[10px] text-white/30">{template.slug}.beindigital.fr</span>
                  </div>
                </div>
              </div>

              {/* Template content */}
              <TemplateRenderer template={template} view={view} />
            </motion.div>
          </div>
        </FadeIn>

        {/* Features tags */}
        <FadeIn delay={0.3}>
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">Fonctionnalites incluses</p>
            <div className="flex flex-wrap justify-center gap-2">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-muted-foreground"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
