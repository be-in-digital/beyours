import Link from "next/link";

import { AnimatedStat } from "@/components/animated-stat";
import { AnimatedTitle } from "@/components/hero/animated-title";
import { LampEffect } from "@/components/hero/lamp-effect";
import { PortableTextBody } from "@/components/portable-text";
import { RevealItem, RevealSection, RevealStagger } from "@/components/reveal";
import { TextReveal } from "@/components/text-reveal";
import { DeviceMockup } from "@/components/visuals/device-mockup";
import { sanityFetch } from "@/sanity/lib/fetch";
import { getCoverUrl } from "@/sanity/lib/get-cover-url";
import {
  allCaseStudiesQuery,
  featuredProductQuery,
  homePageQuery,
  studioVenturesQuery,
} from "@/sanity/lib/queries";
import type { CaseStudySummary, HomePage } from "@/sanity/types";

export const metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [home, allStudies, featured, ventures] = await Promise.all([
    sanityFetch<HomePage>({ query: homePageQuery }),
    sanityFetch<CaseStudySummary[]>({ query: allCaseStudiesQuery }),
    sanityFetch<CaseStudySummary | null>({ query: featuredProductQuery }),
    sanityFetch<CaseStudySummary[]>({ query: studioVenturesQuery }),
  ]);
  const selectedWork = allStudies.slice(0, 4);

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      {/* ════════════════════════════════════════════════════════════
            HERO
         ════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-svh items-center justify-center">
        <LampEffect />
        <div className="noise-overlay" />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center sm:px-10">
          <p className="font-mono text-muted-foreground mb-8 text-xs tracking-[0.2em] uppercase">
            {home.hero.eyebrow}
          </p>

          <AnimatedTitle
            prefix={home.hero.titlePrefix}
            gradient={home.hero.titleGradient}
          />

          <div className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed sm:text-xl">
            <PortableTextBody value={home.hero.description} />
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={home.hero.ctaPrimaryHref}
              data-magnetic
              className="bg-primary text-primary-foreground glow-primary hover:glow-strong inline-flex items-center rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-shadow duration-300"
            >
              {home.hero.ctaPrimaryLabel}
            </Link>
            <Link
              href={home.hero.ctaSecondaryHref}
              data-magnetic
              className="text-muted-foreground hover:text-foreground border-border hover:border-primary/40 inline-flex items-center rounded-full border px-7 py-3.5 text-sm tracking-wide transition-colors duration-300"
            >
              {home.hero.ctaSecondaryLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
            MANIFESTO
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="manifesto"
        aria-labelledby="manifesto-heading"
        className="relative overflow-hidden px-6 py-28 sm:px-10 sm:py-44"
      >
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-12 text-xs tracking-[0.2em] uppercase">
            {home.manifesto.eyebrow}
          </p>

          <h2
            id="manifesto-heading"
            className="font-display text-foreground space-y-2 text-5xl leading-[1.05] font-light tracking-tight sm:space-y-4 sm:text-7xl lg:text-[6.5rem]"
          >
            <TextReveal className="block">
              {home.manifesto.line1}{" "}
              <span className="text-primary italic">
                {home.manifesto.line1Accent}
              </span>
              .
            </TextReveal>
            <TextReveal className="block" startDelayMs={120}>
              {home.manifesto.line2}{" "}
              <span className="text-primary italic">
                {home.manifesto.line2Accent}
              </span>
              .
            </TextReveal>
            <TextReveal className="block" startDelayMs={240}>
              {home.manifesto.line3}{" "}
              <span className="text-primary italic">
                {home.manifesto.line3Accent}
              </span>
              .
            </TextReveal>
          </h2>

          <p className="text-muted-foreground mt-12 max-w-2xl text-lg leading-relaxed sm:text-xl">
            {home.manifesto.paragraph}
          </p>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════
            APPROACH
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="approach"
        aria-labelledby="approach-heading"
        className="relative px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {home.approach.eyebrow}
          </p>

          <h2
            id="approach-heading"
            className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl"
          >
            {home.approach.title}{" "}
            <span className="text-muted-foreground italic">
              {home.approach.titleAccent}
            </span>
          </h2>

          <div className="mt-8 text-lg leading-relaxed sm:text-xl">
            <PortableTextBody value={home.approach.paragraphs} />
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════
            PROCESS
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="process"
        aria-labelledby="process-heading"
        className="relative px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {home.process.eyebrow}
          </p>

          <h2
            id="process-heading"
            className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl"
          >
            {home.process.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {home.process.titleLine2}
            </span>
          </h2>

          <RevealStagger
            staggerMs={140}
            className="mt-12 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-4"
          >
            {home.process.steps.map((step) => (
              <RevealItem key={step.num} className="group relative">
                <div className="bg-primary/0 group-hover:bg-primary/40 absolute -left-4 top-0 h-12 w-px transition-colors duration-500" />
                <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
                  {step.num} · {step.tag}
                </p>
                <h3 className="font-display text-foreground mt-3 text-2xl font-light leading-tight sm:text-3xl">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                  {step.body}
                </p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════
            SELECTED WORK
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="work"
        aria-labelledby="work-heading"
        className="relative px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-baseline justify-between gap-6 sm:flex-row">
            <div>
              <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
                {home.selectedWork.eyebrow}
              </p>
              <h2
                id="work-heading"
                className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl"
              >
                {home.selectedWork.titleLine1}
                <br />
                <span className="text-muted-foreground italic">
                  {home.selectedWork.titleLine2}
                </span>
              </h2>
            </div>
            <Link
              href={home.selectedWork.viewAllHref}
              data-magnetic
              className="text-primary hover:text-foreground inline-flex items-center gap-2 text-sm font-medium tracking-wide transition-colors"
            >
              {home.selectedWork.viewAllLabel}
            </Link>
          </div>

          <RevealStagger
            staggerMs={150}
            className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-12"
          >
            {selectedWork.map((s, i) => {
              const isLg = (s.size ?? "lg") === "lg";
              const colSpan = isLg ? "lg:col-span-7" : "lg:col-span-5";
              const offset =
                i % 2 === 1 && selectedWork.length > 1 ? "lg:col-span-5" : colSpan;
              const coverUrl = s.cover ? getCoverUrl(s.cover) : null;

              return (
                <RevealItem key={s.slug} className={offset}>
                  <Link href={`/work/${s.slug}`} className="block h-full">
                    <article className="bg-surface-1 hover:bg-surface-2 hover:border-primary/30 group relative h-full overflow-hidden rounded-2xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_50px_120px_-25px_rgba(82,207,175,0.4)]">
                      <div className="bg-hero-radial relative overflow-hidden px-6 pt-10 pb-4 sm:px-10 sm:pt-12">
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_30%,hsl(162_56%_57%/0.32),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                        />
                        {coverUrl ? (
                          <DeviceMockup
                            variant={i % 2 === 0 ? "laptop-tilt" : "laptop"}
                            src={coverUrl}
                            alt={s.cover?.alt ?? `Aperçu du projet ${s.title}`}
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-4 p-6 sm:p-8">
                        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                          <span className="text-primary">{s.category}</span>
                          <span className="text-muted-foreground">{s.year}</span>
                        </div>
                        <h3 className="font-display text-foreground text-2xl font-light sm:text-3xl">
                          {s.title}
                        </h3>
                        <p className="text-muted-foreground text-base leading-relaxed">
                          {s.blurb}
                        </p>
                        <span className="text-primary group-hover:text-foreground mt-2 inline-flex items-center gap-2 text-sm font-medium transition-colors">
                          Lire l’étude →
                        </span>
                      </div>
                    </article>
                  </Link>
                </RevealItem>
              );
            })}
          </RevealStagger>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════
            NUMBERS
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="numbers"
        aria-labelledby="numbers-heading"
        className="relative px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {home.numbers.eyebrow}
          </p>
          <h2
            id="numbers-heading"
            className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl"
          >
            {home.numbers.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {home.numbers.titleLine2}
            </span>
          </h2>

          <RevealStagger
            staggerMs={120}
            className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-4"
          >
            {home.numbers.stats.map((stat) => (
              <RevealItem key={stat.label}>
                <AnimatedStat
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  label={stat.label}
                  caption={stat.caption}
                />
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════
            PRODUCTS
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="products"
        aria-labelledby="products-heading"
        className="relative px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-baseline justify-between gap-6 sm:flex-row">
            <div>
              <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
                {home.products.eyebrow}
              </p>
              <h2
                id="products-heading"
                className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl"
              >
                {home.products.titleLine1}
                <br />
                <span className="text-muted-foreground italic">
                  {home.products.titleLine2}
                </span>
              </h2>
            </div>
            <p className="text-muted-foreground max-w-md text-base leading-relaxed sm:text-right">
              {home.products.intro}
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-12">
            {/* Featured — Be in Digital Restaurant */}
            {featured ? (
              <article className="bg-surface-1 hover:bg-surface-2 hover:border-primary/30 group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_50px_120px_-25px_rgba(82,207,175,0.45)] lg:col-span-7">
                <div className="bg-hero-radial relative overflow-hidden px-6 pt-12 pb-6 sm:px-10 sm:pt-14">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_30%,hsl(162_56%_57%/0.35),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                  />
                  <span className="bg-background/60 text-primary absolute top-5 left-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase backdrop-blur-md sm:top-6 sm:left-6">
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
                      // Featured product = 2e image LCP-éligible (hors fold
                      // sur mobile mais visible vite après scroll). Pas de
                      // priority pour ne pas voler la bande passante au H1
                      // qui reste le LCP du hero.
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 90vw, 580px"
                      className="relative mx-auto max-w-xl"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-5 p-8">
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                    <span className="text-primary">{featured.category}</span>
                    <span className="text-muted-foreground">
                      v2.0 · {featured.year}
                    </span>
                  </div>
                  <h3 className="font-display text-foreground text-3xl leading-tight font-light sm:text-4xl">
                    {featured.title}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed sm:text-lg">
                    {featured.blurb}
                  </p>
                  {featured.liveUrl ? (
                    <a
                      href={featured.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
                      data-magnetic
                    >
                      Visiter {featured.liveUrl.replace(/^https?:\/\//, "")} →
                    </a>
                  ) : null}
                </div>
              </article>
            ) : null}

            {/* Studio ventures */}
            <div className="grid gap-6 lg:col-span-5">
              {ventures.map((p) => (
                <Link
                  key={p.slug}
                  href={`/work/${p.slug}`}
                  className="block"
                >
                  <article className="bg-surface-1 hover:bg-surface-2 hover:border-primary/30 group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_-20px_rgba(82,207,175,0.3)]">
                    <div className="bg-hero-radial relative overflow-hidden px-5 pt-8 pb-3 sm:px-7 sm:pt-9">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_30%,hsl(162_56%_57%/0.32),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                      />
                      {p.studioStatus ? (
                        <span className="bg-background/60 text-primary absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] tracking-[0.25em] uppercase backdrop-blur-md">
                          <span className="bg-primary inline-block size-1 rounded-full shadow-[0_0_6px_currentColor]" />
                          {p.studioStatus}
                        </span>
                      ) : null}
                      {p.cover ? (
                        <DeviceMockup
                          variant="laptop"
                          src={getCoverUrl(p.cover)}
                          alt={p.cover.alt ?? `Aperçu du site ${p.title}`}
                          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 280px"
                          className="relative mx-auto max-w-[280px]"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
                      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                        <span className="text-primary">{p.category}</span>
                        <span className="text-muted-foreground">{p.year}</span>
                      </div>
                      <h3 className="font-display text-foreground text-xl leading-tight font-light sm:text-2xl">
                        {p.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {p.blurb}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ════════════════════════════════════════════════════════════
            CTA FINAL
         ════════════════════════════════════════════════════════════ */}
      <RevealSection
        id="contact"
        aria-labelledby="contact-heading"
        className="relative flex min-h-[60vh] items-center px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="bg-cta-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-start">
          <p className="font-mono text-primary mb-6 text-xs tracking-[0.2em] uppercase">
            {home.cta.eyebrow}
          </p>
          <h2
            id="contact-heading"
            className="font-display text-foreground text-4xl leading-tight font-light sm:text-6xl lg:text-7xl"
          >
            {home.cta.titleLine1}
            <br />
            <span className="text-primary italic">{home.cta.titleLine2}</span>
          </h2>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed sm:text-xl">
            {home.cta.paragraph}
          </p>
          <Link
            href={home.cta.buttonHref}
            data-magnetic
            className="bg-primary text-primary-foreground glow-primary hover:glow-strong mt-12 inline-flex items-center rounded-full px-8 py-4 text-base font-medium tracking-wide transition-shadow duration-300"
          >
            {home.cta.buttonLabel}
          </Link>
          <p className="text-muted-foreground mt-6 font-mono text-xs tracking-widest uppercase">
            {home.cta.fallbackLine}
          </p>
        </div>
      </RevealSection>
    </main>
  );
}
