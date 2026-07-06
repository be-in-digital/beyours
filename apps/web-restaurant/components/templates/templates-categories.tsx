"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";
import { useCalendlyModal } from "@/lib/store";
import {
  categories,
  categoryCircles,
  type Template,
} from "@/lib/templates-data";

/** Photo d'ambiance par catégorie — l'aperçu doit être appétissant, pas gris. */
const categoryPhoto: Record<string, string> = {
  pizzeria: "/photos/plat-gastronomie.webp",
  "fast-food": "/photos/burger-premium.webp",
  asiatique: "/photos/plat-gastronomie.webp",
  healthy: "/photos/salle-restaurant2.webp",
  "food-truck": "/photos/burger-premium.webp",
};

function CategoryIcon({
  iconPath,
  categoryId,
  size = 28,
}: {
  iconPath: string;
  categoryId: string;
  size?: number;
}) {
  const paths = iconPath.split(" M").map((p, i) => (i === 0 ? p : `M${p}`));
  const circles = categoryCircles[categoryId] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}

/** Mini-aperçu appétissant d'un site restaurant : photo hero + 2 plats du menu. */
function TemplateCardPreview({
  template,
  photo,
}: {
  template: Template;
  photo: string;
}) {
  const firstItems =
    template.menu.categories[0]?.items.slice(0, 2) ?? [];

  return (
    <div className="absolute inset-0 flex flex-col bg-surface-1">
      {/* Barre navigateur */}
      <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] bg-surface-2 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-surface-4" />
        <span className="h-2 w-2 rounded-full bg-surface-4" />
        <span className="h-2 w-2 rounded-full bg-surface-4" />
        <span className="ml-3 truncate rounded-full bg-background px-2.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          {template.slug}.beindigital.fr
        </span>
      </div>

      {/* Hero photo du restaurant */}
      <div className="relative flex-1 overflow-hidden">
        <Image
          src={photo}
          alt={`Aperçu du template ${template.name}`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm"
          style={{ background: template.accent }}
        >
          Restaurant {template.name}
        </span>
        <div className="absolute inset-x-3 bottom-3">
          <p className="font-display text-sm font-semibold leading-tight text-white">
            {template.hero.title}
          </p>
        </div>
      </div>

      {/* Extrait de menu (verbatim) */}
      <div className="space-y-1.5 border-t border-[color:var(--border)] bg-surface-1 px-3 py-2.5">
        {firstItems.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate text-[11px] font-medium text-foreground">
              {item.name}
            </span>
            <span
              className="shrink-0 text-[11px] font-semibold tabular-nums"
              style={{ color: template.accent }}
            >
              {item.price} €
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplatesCategories() {
  const [activeCategory, setActiveCategory] = useState(categories[0].id);
  const { open: openCalendly } = useCalendlyModal();
  const active = categories.find((c) => c.id === activeCategory)!;
  const photo = categoryPhoto[active.id] ?? "/photos/plat-gastronomie.webp";

  return (
    <section className="relative py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* En-tête de section */}
        <FadeIn>
          <div className="mb-16 text-center">
            <SectionBadge text="Catégories" />
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              Trouvez le template idéal
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Chaque catégorie propose des designs pensés spécifiquement pour
              votre type de cuisine et votre clientèle.
            </p>
          </div>
        </FadeIn>

        {/* Onglets catégories */}
        <FadeIn delay={0.15}>
          <div className="mb-16 flex flex-wrap justify-center gap-3">
            {categories.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`group relative inline-flex cursor-pointer items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "border border-[color:var(--border-accent)] bg-primary/10 text-primary shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]"
                      : "border border-[color:var(--border)] bg-surface-1 text-muted-foreground hover:border-[color:var(--border-contrast)] hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`transition-colors duration-300 ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <CategoryIcon iconPath={cat.iconPath} categoryId={cat.id} />
                  </span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* Contenu de la catégorie active */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Bandeau catégorie */}
            <div className="relative mb-10 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 p-6 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] sm:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 h-[200px] w-[300px] rounded-full opacity-25 blur-[100px]"
                style={{ background: active.color }}
              />
              <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl border"
                  style={{
                    backgroundColor: active.color.replace("0.8", "0.12"),
                    borderColor: active.color.replace("0.8", "0.28"),
                    color: active.color.replace("0.8", "1"),
                  }}
                >
                  <CategoryIcon iconPath={active.iconPath} categoryId={active.id} />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {active.label}
                  </h3>
                  <p className="mt-1 text-muted-foreground">
                    {active.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Grille de templates */}
            <StaggerContainer
              stagger={0.08}
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
            >
              {active.templates.map((template) => (
                <StaggerItem key={template.name}>
                  <Link
                    href={`/templates/${template.slug}`}
                    className="block h-full"
                  >
                    <div className="group relative h-full overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--border-contrast)] hover:shadow-[0_22px_50px_-24px_rgba(112,60,34,0.45)]">
                      {/* Aperçu de la maquette */}
                      <div className="relative aspect-[16/12] overflow-hidden border-b border-[color:var(--border)]">
                        <TemplateCardPreview
                          template={template}
                          photo={photo}
                        />
                        {/* Overlay au survol */}
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--olive)]/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_rgba(197,84,44,0.6)]">
                            Voir le template
                            <ArrowUpRight
                              className="h-3.5 w-3.5"
                              strokeWidth={2}
                            />
                          </span>
                        </div>
                      </div>

                      {/* Contenu de la carte */}
                      <div className="p-5 sm:p-6">
                        <h4 className="mb-2 font-display text-lg font-semibold text-foreground">
                          {template.name}
                        </h4>
                        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded-full border border-[color:var(--border)] bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <FadeIn delay={0.3}>
          <div className="mt-16 text-center">
            <p className="mb-6 text-muted-foreground">
              Envie de voir un template en action ?
            </p>
            <button
              onClick={openCalendly}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_rgba(197,84,44,0.5)] transition-all duration-200 hover:brightness-105"
            >
              Réserver une démo
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
