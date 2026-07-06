"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Star,
  Tablet,
} from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { useCalendlyModal } from "@/lib/store";
import type { Template, Category } from "@/lib/templates-data";

type View = "desktop" | "tablet" | "mobile";

const viewConfig: Record<View, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablette" },
  mobile: { width: "375px", label: "Mobile" },
};

/** Photo hero de la maquette, selon l'univers du template (préfixe du slug). */
function heroPhotoFor(slug: string): string {
  if (slug.startsWith("fast-food") || slug.startsWith("food-truck")) {
    return "/photos/burger-premium.webp";
  }
  if (slug.startsWith("healthy")) {
    return "/photos/salle-restaurant2.webp";
  }
  return "/photos/plat-gastronomie.webp";
}

/**
 * Aperçu du site RESTAURANT vendu. Chaque template garde SON accent (prop).
 * Scène sombre et premium, photo appétissante en héros, accent du template
 * pour guider l'œil — jamais mint.
 */
function TemplateRenderer({
  template,
  view,
}: {
  template: Template;
  view: View;
}) {
  const [activeMenuCategory, setActiveMenuCategory] = useState(0);
  const isMobileView = view === "mobile";
  const isTabletView = view === "tablet";
  const accent = template.accent;
  const heroPhoto = heroPhotoFor(template.slug);

  return (
    <div className="scrollbar-thin max-h-[700px] overflow-y-auto bg-[#181410] text-white">
      {/* Navbar de la maquette */}
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#181410]/90 backdrop-blur-md">
        <div
          className={`flex items-center justify-between ${
            isMobileView ? "px-4 py-3" : "px-8 py-4"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{
                background: `${accent}22`,
                border: `1px solid ${accent}44`,
                color: accent,
              }}
            >
              {template.name[0]}
            </div>
            {!isMobileView && (
              <span className="text-sm font-semibold">{template.name}</span>
            )}
          </div>
          <div
            className={`flex items-center ${isMobileView ? "gap-3" : "gap-6"}`}
          >
            {!isMobileView && (
              <>
                <span className="cursor-pointer text-xs text-white/60 transition-colors hover:text-white">
                  Menu
                </span>
                <span className="cursor-pointer text-xs text-white/60 transition-colors hover:text-white">
                  Commander
                </span>
                <span className="cursor-pointer text-xs text-white/60 transition-colors hover:text-white">
                  Contact
                </span>
              </>
            )}
            <div
              className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-black transition-transform hover:scale-105"
              style={{ background: accent }}
            >
              {isMobileView ? "Reserver" : "Reserver une table"}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero de la maquette — photo appétissante plein cadre */}
      <section className="relative overflow-hidden">
        <div
          className={`relative w-full ${
            isMobileView ? "h-64" : isTabletView ? "h-72" : "h-80"
          }`}
        >
          <Image
            src={heroPhoto}
            alt={`Ambiance du restaurant ${template.name}`}
            fill
            sizes="(max-width: 768px) 100vw, 900px"
            className="object-cover"
          />
          {/* Scrim pour lisibilité + teinte accent */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181410] via-[#181410]/55 to-[#181410]/25" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 90% 70% at 50% 0%, ${accent}30, transparent 65%)`,
            }}
          />
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-center ${
              isMobileView
                ? "px-4"
                : isTabletView
                  ? "px-8"
                  : "px-12"
            }`}
          >
            <div
              className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium backdrop-blur-sm"
              style={{
                color: accent,
                borderColor: `${accent}55`,
                background: `${accent}22`,
              }}
            >
              <Star className="h-2.5 w-2.5 fill-current" />
              Restaurant {template.name}
            </div>
            <h1
              className={`font-bold leading-tight text-white ${
                isMobileView
                  ? "text-2xl"
                  : isTabletView
                    ? "text-3xl"
                    : "text-4xl"
              }`}
            >
              {template.hero.title}
            </h1>
            <p
              className={`mx-auto mt-3 max-w-lg leading-relaxed text-white/80 ${
                isMobileView ? "text-xs" : "text-sm"
              }`}
            >
              {template.hero.subtitle}
            </p>
            <div
              className={`mt-6 flex items-center justify-center gap-3 ${
                isMobileView ? "flex-col" : "flex-row"
              }`}
            >
              <div
                className="cursor-pointer rounded-full px-5 py-2.5 text-xs font-semibold text-black shadow-lg transition-transform hover:scale-105"
                style={{
                  background: accent,
                  boxShadow: `0 10px 30px -8px ${accent}66`,
                }}
              >
                Commander en ligne
              </div>
              <div className="cursor-pointer rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                Voir la carte
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section menu */}
      <section className={`${isMobileView ? "px-4 py-8" : "px-8 py-12"}`}>
        <div className="mb-6 text-center">
          <h2
            className={`font-semibold text-white ${
              isMobileView ? "text-lg" : "text-xl"
            }`}
          >
            Notre Carte
          </h2>
          <p className="mt-1 text-xs text-white/55">Decouvrez nos specialites</p>
        </div>

        {/* Onglets de menu */}
        <div className="mb-6 flex justify-center gap-2">
          {template.menu.categories.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveMenuCategory(i)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                activeMenuCategory === i
                  ? "text-black"
                  : "border border-white/15 text-white/60 hover:text-white"
              }`}
              style={
                activeMenuCategory === i ? { background: accent } : undefined
              }
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Plats du menu */}
        <div className="mx-auto max-w-md space-y-3">
          {template.menu.categories[activeMenuCategory]?.items.map((item) => (
            <div
              key={item.name}
              className="group flex items-start justify-between gap-4 rounded-xl border border-[rgba(255,247,239,0.1)] bg-[rgba(255,247,239,0.05)] p-3 transition-all hover:border-[rgba(255,247,239,0.2)] hover:bg-[rgba(255,247,239,0.08)]"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-white">
                  {item.name}
                </span>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">
                  {item.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: accent }}
                >
                  {item.price} &euro;
                </span>
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: `${accent}26` }}
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} style={{ color: accent }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer de la maquette */}
      <footer
        className={`border-t border-white/10 ${
          isMobileView ? "px-4 py-6" : "px-8 py-8"
        }`}
      >
        <div
          className={`flex ${
            isMobileView ? "flex-col gap-4" : "items-center justify-between"
          }`}
        >
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold"
                style={{ background: `${accent}22`, color: accent }}
              >
                {template.name[0]}
              </div>
              <span className="text-xs font-medium text-white">
                {template.name}
              </span>
            </div>
            <p className="text-[10px] text-white/40">Powered by Be in Digital</p>
          </div>
          <div className="flex gap-4">
            <span className="cursor-pointer text-[10px] text-white/50 transition-colors hover:text-white">
              Instagram
            </span>
            <span className="cursor-pointer text-[10px] text-white/50 transition-colors hover:text-white">
              TikTok
            </span>
            <span className="cursor-pointer text-[10px] text-white/50 transition-colors hover:text-white">
              Google
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function TemplatePreview({
  template,
  category,
}: {
  template: Template;
  category: Category;
}) {
  const [view, setView] = useState<View>("desktop");
  const { open: openCalendly } = useCalendlyModal();

  const viewIcon: Record<View, typeof Monitor> = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone,
  };

  return (
    <section className="relative py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Retour + info */}
        <FadeIn>
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/templates"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                Templates
              </Link>
              <div className="h-5 w-px bg-[color:var(--border)]" />
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{
                    color: category.color.replace("0.8", "1"),
                    borderColor: category.color.replace("0.8", "0.28"),
                    background: category.color.replace("0.8", "0.1"),
                  }}
                >
                  {category.label}
                </span>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  {template.name}
                </h1>
              </div>
            </div>

            <button
              onClick={openCalendly}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_rgba(197,84,44,0.5)] transition-all duration-200 hover:brightness-105"
            >
              Choisir ce template
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </FadeIn>

        {/* Sélecteur de viewport */}
        <FadeIn delay={0.1}>
          <div className="mb-6 flex items-center justify-center gap-2">
            {(Object.keys(viewConfig) as View[]).map((v) => {
              const Icon = viewIcon[v];
              const isActive = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? "border border-[color:var(--border-accent)] bg-primary/10 text-primary"
                      : "border border-[color:var(--border)] bg-surface-1 text-muted-foreground hover:border-[color:var(--border-contrast)] hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {viewConfig[v].label}
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* Cadre d'aperçu */}
        <FadeIn delay={0.2}>
          <div className="flex justify-center">
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 shadow-[0_30px_70px_-30px_rgba(112,60,34,0.5)]"
              animate={{ width: viewConfig[view].width }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ maxWidth: "100%" }}
            >
              {/* Barre navigateur */}
              <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-surface-4" />
                  <div className="h-3 w-3 rounded-full bg-surface-4" />
                  <div className="h-3 w-3 rounded-full bg-surface-4" />
                </div>
                <div className="mx-4 flex-1">
                  <div className="flex h-6 items-center rounded-full border border-[color:var(--border)] bg-background px-3">
                    <Search
                      className="mr-2 h-2.5 w-2.5 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {template.slug}.beindigital.fr
                    </span>
                  </div>
                </div>
              </div>

              {/* Contenu de la maquette */}
              <TemplateRenderer template={template} view={view} />
            </motion.div>
          </div>
        </FadeIn>

        {/* Fonctionnalités incluses */}
        <FadeIn delay={0.3}>
          <div className="mt-10 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Fonctionnalites incluses
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-secondary px-3 py-1.5 text-xs text-secondary-foreground"
                >
                  <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />
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
