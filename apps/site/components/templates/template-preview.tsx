"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Check, MousePointerClick } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { useBookingModal } from "@/lib/store";
import type { Template, Category } from "@/lib/templates-data";

const INCLUS = [
  "Site e-commerce & commande en ligne",
  "Back-office restaurant + KDS",
  "Personnalisable à vos couleurs",
  "Jeu concours à table (roue, carte à gratter)",
];

export function TemplatePreview({
  template,
  category,
}: {
  template: Template;
  category: Category;
}) {
  const { open: openBooking } = useBookingModal();
  const siblings = category.templates
    .filter((t) => t.slug !== template.slug)
    .slice(0, 6);

  return (
    <section className="relative py-16 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Retour */}
        <FadeIn>
          <Link
            href="/templates"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Tous les templates
          </Link>
        </FadeIn>

        {/* Header */}
        <FadeIn delay={0.1}>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-surface-1 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: category.accent }}
                />
                Template {category.label}
              </span>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl">
                {template.name}
              </h1>
              <p className="mt-2 max-w-xl text-lg text-muted-foreground">
                {template.tagline}
              </p>
            </div>
            <button
              onClick={() => openBooking()}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_14px_40px_-16px_rgba(197,84,44,0.5)] transition-all duration-200 hover:brightness-105"
            >
              Réserver une démo
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </FadeIn>

        {/* Screenshot of the delivered site + entry to the full-screen playable demo */}
        <FadeIn delay={0.2}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 shadow-[0_30px_80px_-40px_rgba(112,60,34,0.5)]"
          >
            {/* Barre navigateur */}
            <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] bg-surface-2 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
              <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
              <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
              <span className="ml-3 truncate rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                {template.slug}.beyours.fr
              </span>
            </div>
            {/* Capture */}
            <div className="relative aspect-[840/525]">
              <Image
                src={template.shot}
                alt={`Aperçu complet du template ${template.name}`}
                fill
                sizes="(max-width: 1152px) 100vw, 1152px"
                className="object-cover object-top"
                priority
              />
            </div>
          </motion.div>

          {/* CTA — visit the real demo, full-screen and usable */}
          <div className="mt-7 flex flex-col items-center gap-3 text-center">
            <Link
              href={`/demo/${template.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-[0_16px_44px_-16px_rgba(197,84,44,0.55)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105"
            >
              <MousePointerClick className="h-5 w-5" strokeWidth={2} />
              Visiter la démo interactive
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <p className="max-w-md text-sm text-muted-foreground">
              Parcourez la carte, ajoutez au panier, passez commande — exactement
              comme le feraient vos clients.
            </p>
          </div>
        </FadeIn>

        {/* What is included + accent */}
        <FadeIn delay={0.25}>
          <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <ul className="grid gap-3 sm:grid-cols-2">
              {INCLUS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-sm text-foreground"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-primary-ink">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-surface-1 px-4 py-3">
              <span className="text-xs text-muted-foreground">Accent</span>
              <span
                className="h-7 w-7 rounded-full ring-1 ring-black/5"
                style={{ background: template.accent }}
              />
              <span
                className="h-7 w-7 rounded-full ring-1 ring-black/5"
                style={{ background: template.accentDark }}
              />
            </div>
          </div>
        </FadeIn>

        {/* Other templates in the category */}
        {siblings.length > 0 && (
          <FadeIn delay={0.3}>
            <div className="mt-16">
              <h2 className="mb-6 font-display text-xl font-semibold text-foreground">
                Autres directions {category.label}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {siblings.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/templates/${t.slug}`}
                    className="group block overflow-hidden rounded-xl border border-[color:var(--border)] bg-surface-1 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--border-contrast)] hover:shadow-[0_18px_44px_-24px_rgba(112,60,34,0.4)]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={t.shot}
                        alt={`Template ${t.name}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.05]"
                      />
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="truncate font-display text-sm font-semibold text-foreground">
                        {t.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.tagline}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
