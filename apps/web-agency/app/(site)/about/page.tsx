import type { Metadata } from "next";
import Link from "next/link";

import { PortableTextBody } from "@/components/portable-text";
import { DeviceMockup } from "@/components/visuals/device-mockup";
import { sanityFetch } from "@/sanity/lib/fetch";
import { getCoverUrl } from "@/sanity/lib/get-cover-url";
import {
  aboutPageQuery,
  allCaseStudiesQuery,
  caseStudyCoverBySlugQuery,
} from "@/sanity/lib/queries";
import type { AboutPage, CaseStudySummary, SanityImage } from "@/sanity/types";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Be in Digital est un studio digital indépendant qui conçoit et code les produits des startups Series A/B et des scale-ups. Paris.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [page, allStudies] = await Promise.all([
    sanityFetch<AboutPage>({ query: aboutPageQuery }),
    sanityFetch<CaseStudySummary[]>({ query: allCaseStudiesQuery }),
  ]);
  const recentWork = allStudies.slice(0, 4);

  const heroSlug = page.hero.coverCaseStudySlug ?? "be-in-digital-restaurant";
  const heroCover = await sanityFetch<{
    title: string;
    cover: SanityImage;
  } | null>({
    query: caseStudyCoverBySlugQuery,
    params: { slug: heroSlug },
  });
  const heroCoverUrl = heroCover?.cover ? getCoverUrl(heroCover.cover) : null;

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      {/* Hero */}
      <section className="relative px-6 pt-32 pb-20 sm:px-10 sm:pt-40 sm:pb-28">
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="font-mono text-primary mb-6 text-xs tracking-[0.2em] uppercase">
              {page.hero.eyebrow}
            </p>
            <h1 className="font-display text-foreground text-5xl leading-[1.0] font-light tracking-tight sm:text-6xl lg:text-[5.25rem]">
              {page.hero.titleLine1}
              <br />
              <span className="text-muted-foreground italic">
                {page.hero.titleLine2}
              </span>
            </h1>
            <p className="text-muted-foreground mt-10 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {page.hero.intro}
            </p>
          </div>

          {heroCoverUrl ? (
            <div className="lg:col-span-5">
              <DeviceMockup
                variant="laptop-tilt"
                src={heroCoverUrl}
                alt={`Aperçu du site ${heroCover?.title} en production`}
                priority
                className="mx-auto max-w-md lg:max-w-none"
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Manifesto étendu */}
      <section className="relative px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {page.manifesto.eyebrow}
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            {page.manifesto.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {page.manifesto.titleLine2}
            </span>
          </h2>

          <div className="mt-10 text-lg leading-relaxed sm:text-xl">
            <PortableTextBody value={page.manifesto.paragraphs} />
          </div>
        </div>
      </section>

      {/* Recent work — visual proof */}
      <section className="relative px-6 py-24 sm:px-10 sm:py-32">
        <div className="bg-section-radial pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
                {page.recentWork.eyebrow}
              </p>
              <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
                {page.recentWork.titleLine1}
                <br />
                <span className="text-muted-foreground italic">
                  {page.recentWork.titleLine2}
                </span>
              </h2>
            </div>
            <Link
              href={page.recentWork.viewAllHref}
              data-magnetic
              className="text-primary hover:text-foreground inline-flex items-center gap-2 text-sm font-medium tracking-wide transition-colors"
            >
              {page.recentWork.viewAllLabel}
            </Link>
          </div>

          <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:gap-16">
            {recentWork.map((p, i) => (
              <article key={p.slug} className="group relative flex flex-col gap-5">
                {p.cover ? (
                  <DeviceMockup
                    variant={i % 2 === 0 ? "laptop-tilt" : "laptop"}
                    src={getCoverUrl(p.cover)}
                    alt={p.cover?.alt ?? `Aperçu du projet ${p.title}`}
                  />
                ) : null}
                <div className="px-2">
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                    <span className="text-primary">{p.category}</span>
                    <span className="text-muted-foreground">{p.year}</span>
                  </div>
                  <h3 className="font-display text-foreground mt-3 text-2xl leading-tight font-light">
                    {p.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Équipe */}
      <section className="relative px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {page.team.eyebrow}
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            {page.team.titleLine1}
            <br />
            <span className="text-muted-foreground italic">
              {page.team.titleLine2}
            </span>
          </h2>

          <div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {page.team.members.map((m) => (
              <article key={m.role}>
                <p className="font-mono text-muted-foreground text-xs tracking-[0.2em] uppercase">
                  {m.role}
                </p>
                <h3 className="font-display text-foreground mt-3 text-2xl leading-tight font-light sm:text-3xl">
                  {m.title}
                </h3>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                  {m.body}
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
            {page.cta.title}
          </h2>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed sm:text-xl">
            {page.cta.paragraph}
          </p>
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
