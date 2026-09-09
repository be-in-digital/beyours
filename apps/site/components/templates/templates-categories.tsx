"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, X, ChevronLeft, ChevronRight, Eye, MousePointerClick } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";
import { useBookingModal } from "@/lib/store";
import { categories, totalTemplates } from "@/lib/templates-data";

type Shot = {
  slug: string;
  name: string;
  tagline: string;
  accent: string;
  shot: string;
  categoryId: string;
  categoryLabel: string;
};

const ALL: Shot[] = categories.flatMap((c) =>
  c.templates.map((t) => ({
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    accent: t.accent,
    shot: t.shot,
    categoryId: c.id,
    categoryLabel: c.label,
  })),
);

const TABS = [
  { id: "all", label: "Tous", count: totalTemplates, accent: "var(--primary)" },
  ...categories.map((c) => ({
    id: c.id,
    label: c.label,
    count: c.templates.length,
    accent: c.accent,
  })),
];

export function TemplatesCategories() {
  const { open: openBooking } = useBookingModal();
  const [active, setActive] = useState("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const filtered = useMemo(
    () => (active === "all" ? ALL : ALL.filter((t) => t.categoryId === active)),
    [active],
  );

  const close = useCallback(() => setLightbox(null), []);
  const next = useCallback(
    () => setLightbox((i) => (i === null ? i : (i + 1) % filtered.length)),
    [filtered.length],
  );
  const prev = useCallback(
    () =>
      setLightbox((i) =>
        i === null ? i : (i - 1 + filtered.length) % filtered.length,
      ),
    [filtered.length],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, close, next, prev]);

  const current = lightbox !== null ? filtered[lightbox] : null;

  return (
    <section className="relative py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <FadeIn>
          <div className="mb-14 text-center">
            <SectionBadge text={`${totalTemplates} templates`} />
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              50 directions artistiques
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Dix identités complètes par univers — couleurs, typographies,
              mises en page. De vraies captures des sites livrés, entièrement
              personnalisables à vos couleurs.
            </p>
          </div>
        </FadeIn>

        {/* Category filters */}
        <FadeIn delay={0.1}>
          <div className="mb-12 flex flex-wrap justify-center gap-2.5">
            {TABS.map((tab) => {
              const isActive = tab.id === active;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActive(tab.id);
                    setLightbox(null);
                  }}
                  className={`group inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "border border-[color:var(--border-accent)] bg-primary/10 text-primary-ink shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]"
                      : "border border-[color:var(--border)] bg-surface-1 text-muted-foreground hover:border-[color:var(--border-contrast)] hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5"
                    style={{ background: tab.accent }}
                  />
                  {tab.label}
                  <span
                    className={`text-xs tabular-nums ${
                      isActive ? "text-primary-ink/70" : "text-muted-foreground/60"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* Screenshot gallery */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((t, i) => (
              <div
                key={t.slug}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 text-left shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--border-contrast)] hover:shadow-[0_22px_50px_-24px_rgba(112,60,34,0.45)]"
              >
                {/* Capture — opens the lightbox, unchanged behaviour */}
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  aria-label={`Agrandir l'aperçu du template ${t.name}`}
                  className="relative block w-full cursor-pointer aspect-[16/10] overflow-hidden border-b border-[color:var(--border)]"
                >
                  <Image
                    src={t.shot}
                    alt={`Aperçu du template ${t.name} — ${t.categoryLabel}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  {/* Veil + category label */}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur-sm">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: t.accent }}
                    />
                    {t.categoryLabel}
                  </span>
                  {/* Overlay survol */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--olive)]/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_rgba(197,84,44,0.6)]">
                      <Eye className="h-4 w-4" strokeWidth={2} />
                      Agrandir
                    </span>
                  </div>
                </button>

                {/* Card footer — a real link to the template page. Without it the
                    50 /templates/[slug] pages have no crawlable path in and stay
                    undiscoverable, whatever the sitemap says. */}
                <Link
                  href={`/templates/${t.slug}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold text-foreground">
                      {t.name}
                    </h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.tagline}
                    </p>
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary-ink"
                    strokeWidth={2}
                  />
                </Link>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <FadeIn delay={0.2}>
          <div className="mt-16 text-center">
            <p className="mb-6 text-muted-foreground">
              Un univers vous parle ? On l’adapte à votre enseigne.
            </p>
            <button
              onClick={() => openBooking()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_rgba(197,84,44,0.5)] transition-all duration-200 hover:brightness-105"
            >
              Réserver une démo
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </FadeIn>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {current && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col bg-[color:var(--olive)]/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          >
            {/* Barre haute */}
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
              <div className="min-w-0 text-[color:var(--primary-foreground)]">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[color:var(--primary-foreground)]/60">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: current.accent }}
                  />
                  {current.categoryLabel}
                </p>
                <p className="truncate font-display text-lg font-semibold">
                  {current.name}
                  <span className="ml-2 text-sm font-normal text-[color:var(--primary-foreground)]/60">
                    {current.tagline}
                  </span>
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Fermer"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image + navigation */}
            <div
              className="relative flex flex-1 items-center justify-center px-4 pb-6 sm:px-16"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={prev}
                aria-label="Précédent"
                className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 sm:grid"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={current.slug}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 shadow-2xl"
                  style={{ aspectRatio: "840 / 525" }}
                >
                  <Image
                    src={current.shot}
                    alt={`Template ${current.name}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    className="object-cover"
                    priority
                  />
                </motion.div>
              </AnimatePresence>

              <button
                onClick={next}
                aria-label="Suivant"
                className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 place-items-center rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 sm:grid"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            {/* Barre basse */}
            <div
              className="flex items-center justify-center gap-3 px-4 pb-6"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-sm text-[color:var(--primary-foreground)]/50 tabular-nums">
                {(lightbox ?? 0) + 1} / {filtered.length}
              </span>
              <Link
                href={`/demo/${current.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                <MousePointerClick className="h-4 w-4" strokeWidth={2} />
                Visiter la démo
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
