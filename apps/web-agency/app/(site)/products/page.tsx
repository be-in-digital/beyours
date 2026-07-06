import type { Metadata } from "next";
import Link from "next/link";

import { DeviceMockup } from "@/components/visuals/device-mockup";
import { sanityFetch } from "@/sanity/lib/fetch";
import { getCoverUrl } from "@/sanity/lib/get-cover-url";
import {
  featuredProductQuery,
  productsPageQuery,
  studioVenturesQuery,
} from "@/sanity/lib/queries";
import type {
  CaseStudySummary,
  ProductsPage,
} from "@/sanity/types";

export const metadata: Metadata = {
  title: "Produits",
  description:
    "Be in Digital construit ses propres produits — Be in Digital Restaurant, Jokko, Wedilly Bird. Trois SaaS designés, codés et lancés en interne.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage() {
  const [page, featured, ventures] = await Promise.all([
    sanityFetch<ProductsPage>({ query: productsPageQuery }),
    sanityFetch<CaseStudySummary | null>({ query: featuredProductQuery }),
    sanityFetch<CaseStudySummary[]>({ query: studioVenturesQuery }),
  ]);

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      {/* Hero */}
      <section className="relative px-6 pt-32 pb-12 sm:px-10 sm:pt-40 sm:pb-16">
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {page.hero.eyebrow}
          </p>
          <h1 className="font-display text-foreground text-5xl leading-[1.0] font-light tracking-tight sm:text-6xl lg:text-[5rem]">
            {page.hero.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {page.hero.titleLine2}
            </span>
          </h1>
          <p className="text-muted-foreground mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
            {page.hero.intro}
          </p>
        </div>
      </section>

      {/* Featured */}
      {featured ? (
        <section className="relative px-6 pt-8 pb-16 sm:px-10 sm:pb-20">
          <div className="mx-auto max-w-6xl">
            <article className="bg-surface-1 hover:bg-surface-2 hover:border-primary/30 group relative overflow-hidden rounded-2xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_50px_120px_-25px_rgba(82,207,175,0.45)]">
              <div className="bg-hero-radial relative overflow-hidden px-6 pt-12 pb-6 sm:px-12 sm:pt-16 sm:pb-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_30%,hsl(162_56%_57%/0.35),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                />
                <span className="bg-background/60 text-primary absolute top-6 left-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase backdrop-blur-md sm:top-8 sm:left-8">
                  <span className="bg-primary inline-block size-1.5 rounded-full shadow-[0_0_8px_currentColor]" />
                  Live · {featured.year}
                </span>
                {featured.cover ? (
                  <DeviceMockup
                    variant="laptop-tilt"
                    src={getCoverUrl(featured.cover)}
                    alt={
                      featured.cover.alt ??
                      `Aperçu du site ${featured.title} en production`
                    }
                    className="relative mx-auto max-w-3xl"
                  />
                ) : null}
              </div>
              <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                    <span className="text-primary">{featured.category}</span>
                    <span className="text-muted-foreground">
                      v2.0 · {featured.year}
                    </span>
                  </div>
                  <h2 className="font-display text-foreground mt-4 text-3xl leading-tight font-light sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="text-muted-foreground mt-6 text-base leading-relaxed sm:text-lg">
                    {featured.blurb}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                    {featured.liveUrl ? (
                      <a
                        href={featured.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-magnetic
                        className="text-primary hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        Visiter {featured.liveUrl.replace(/^https?:\/\//, "")} →
                      </a>
                    ) : null}
                    <Link
                      href={`/work/${featured.slug}`}
                      data-magnetic
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      Lire l’étude →
                    </Link>
                  </div>
                </div>
                {featured.services?.length ? (
                  <ul className="text-muted-foreground space-y-3 text-sm leading-relaxed lg:col-span-5">
                    {featured.services.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="bg-primary mt-2 inline-block h-px w-3 flex-shrink-0"
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {/* Studio ventures */}
      <section className="relative px-6 pb-20 sm:px-10 sm:pb-28">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {page.ventures.eyebrow}
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            {page.ventures.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {page.ventures.titleLine2}
            </span>
          </h2>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {ventures.map((p) => (
              <article
                key={p.slug}
                className="bg-surface-1 hover:bg-surface-2 hover:border-primary/30 group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_100px_-25px_rgba(82,207,175,0.35)]"
              >
                <div className="bg-hero-radial relative overflow-hidden px-6 pt-10 pb-6 sm:px-10 sm:pt-12">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_30%,hsl(162_56%_57%/0.32),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                  />
                  {p.studioStatus ? (
                    <span className="bg-background/60 text-primary absolute top-5 left-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase backdrop-blur-md sm:top-6 sm:left-6">
                      <span className="bg-primary inline-block size-1.5 rounded-full shadow-[0_0_8px_currentColor]" />
                      {p.studioStatus}
                    </span>
                  ) : null}
                  {p.cover ? (
                    <DeviceMockup
                      variant="laptop-tilt"
                      src={getCoverUrl(p.cover)}
                      alt={p.cover.alt ?? `Aperçu du site ${p.title}`}
                      className="relative mx-auto max-w-md"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                    <span className="text-primary">{p.category}</span>
                    <span className="text-muted-foreground">{p.year}</span>
                  </div>
                  <h3 className="font-display text-foreground mt-3 text-2xl leading-tight font-light sm:text-3xl">
                    {p.title}
                  </h3>
                  <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                    {p.blurb}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                    {p.liveUrl ? (
                      <a
                        href={p.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-magnetic
                        className="text-primary hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        Visiter →
                      </a>
                    ) : null}
                    <Link
                      href={`/work/${p.slug}`}
                      data-magnetic
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      Lire l’étude →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {page.roadmap.eyebrow}
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            {page.roadmap.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {page.roadmap.titleLine2}
            </span>
          </h2>

          <div className="mt-12 grid gap-7 sm:grid-cols-2">
            {page.roadmap.items.map((p) => (
              <article
                key={p.title}
                className="bg-surface-1 relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/5 p-6 sm:p-8"
              >
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                  <span className="text-primary">{p.category}</span>
                  <span className="text-muted-foreground">{p.eta}</span>
                </div>
                <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                  {p.status}
                </p>
                <h3 className="font-display text-foreground text-xl font-light italic sm:text-2xl">
                  {p.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="relative px-6 py-24 sm:px-10 sm:py-32">
        <div className="bg-cta-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-start">
          <p className="font-mono text-primary mb-6 text-xs tracking-[0.2em] uppercase">
            {page.cta.eyebrow}
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            {page.cta.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {page.cta.titleLine2}
            </span>
          </h2>
          <Link
            href={page.cta.buttonHref}
            data-magnetic
            className="bg-primary text-primary-foreground glow-primary hover:glow-strong mt-10 inline-flex items-center rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-shadow duration-300"
          >
            {page.cta.buttonLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
