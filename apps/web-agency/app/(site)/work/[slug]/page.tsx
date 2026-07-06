import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortableTextBody } from "@/components/portable-text";
import { DeviceMockup } from "@/components/visuals/device-mockup";
import { sanityFetch } from "@/sanity/lib/fetch";
import { getCoverUrl } from "@/sanity/lib/get-cover-url";
import {
  caseStudyBySlugQuery,
  caseStudySlugsQuery,
} from "@/sanity/lib/queries";
import type { CaseStudyDetail } from "@/sanity/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await sanityFetch<string[]>({ query: caseStudySlugsQuery });
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = await sanityFetch<CaseStudyDetail | null>({
    query: caseStudyBySlugQuery,
    params: { slug },
  });
  if (!study) return {};

  return {
    title: `${study.title} — Étude de cas`,
    description: study.blurb,
    alternates: { canonical: `/work/${slug}` },
    openGraph: {
      title: study.title,
      description: study.blurb,
      type: "article",
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps) {
  const { slug } = await params;
  const study = await sanityFetch<CaseStudyDetail | null>({
    query: caseStudyBySlugQuery,
    params: { slug },
  });
  if (!study) notFound();

  const coverUrl = study.cover ? getCoverUrl(study.cover) : null;

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      {/* ───── Hero ───── */}
      <section className="relative px-6 pt-32 pb-12 sm:px-10 sm:pt-40 sm:pb-16">
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl">
          <Link
            href="/work"
            data-magnetic
            className="text-muted-foreground hover:text-foreground inline-flex items-center font-mono text-xs tracking-[0.2em] uppercase transition-colors"
          >
            ← Retour aux études
          </Link>
          <p className="font-mono text-primary mt-8 mb-3 text-xs tracking-[0.2em] uppercase">
            {study.category} · {study.year}
          </p>
          <h1 className="font-display text-foreground text-4xl leading-[1.05] font-light tracking-tight sm:text-5xl lg:text-6xl">
            {study.title}
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
            {study.blurb}
          </p>
          {study.liveUrl ? (
            <a
              href={study.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-magnetic
              className="text-primary hover:text-foreground mt-8 inline-flex items-center gap-2 text-sm font-medium transition-colors"
            >
              Voir le projet en ligne →
            </a>
          ) : null}
        </div>
      </section>

      {/* ───── Cover ───── */}
      <section className="relative px-6 sm:px-10">
        <div className="mx-auto max-w-5xl">
          {coverUrl ? (
            <div className="bg-hero-radial relative overflow-hidden rounded-2xl border border-white/5 px-6 pt-12 pb-8 sm:px-12 sm:pt-16 sm:pb-12">
              <DeviceMockup
                variant="laptop-tilt"
                src={coverUrl}
                alt={study.cover?.alt ?? `Aperçu du projet ${study.title}`}
                priority
                className="mx-auto max-w-4xl"
              />
            </div>
          ) : (
            <div className="bg-hero-radial relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/5">
              <div className="absolute inset-6 rounded-lg border border-white/[0.06] bg-black/40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="font-mono text-primary text-xs tracking-[0.3em] uppercase">
                  {study.client}
                </p>
                <p className="font-display text-foreground/85 text-3xl leading-tight font-light italic sm:text-5xl">
                  {study.title}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ───── Body : sidebar meta + article ───── */}
      <section className="relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-12">
          <aside aria-label="Informations du projet" className="lg:col-span-4">
            <div className="space-y-8 lg:sticky lg:top-28">
              <div>
                <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
                  Client
                </p>
                <p className="text-foreground mt-2 text-sm">{study.client}</p>
              </div>
              <div>
                <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
                  Année
                </p>
                <p className="text-foreground mt-2 text-sm">{study.year}</p>
              </div>
              <div>
                <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
                  Catégorie
                </p>
                <p className="text-foreground mt-2 text-sm">{study.category}</p>
              </div>
              {study.services?.length ? (
                <div>
                  <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
                    Services
                  </p>
                  <ul className="text-foreground mt-2 space-y-1.5 text-sm">
                    {study.services.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {study.liveUrl ? (
                <div>
                  <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
                    Live
                  </p>
                  <a
                    href={study.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-magnetic
                    className="text-foreground hover:text-primary mt-2 inline-flex break-all text-sm transition-colors"
                  >
                    {study.liveUrl.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              ) : null}
            </div>
          </aside>

          <article className="lg:col-span-8">
            <PortableTextBody value={study.body} />
          </article>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="relative px-6 py-24 sm:px-10 sm:py-32">
        <div className="bg-cta-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-start">
          <p className="font-mono text-primary mb-6 text-xs tracking-[0.2em] uppercase">
            On en parle ?
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            Un projet qui mérite
            <br />
            <span className="text-muted-foreground italic">
              la même rigueur ?
            </span>
          </h2>
          <Link
            href="/contact"
            data-magnetic
            className="bg-primary text-primary-foreground glow-primary hover:glow-strong mt-10 inline-flex items-center rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-shadow duration-300"
          >
            Démarrer un projet
          </Link>
        </div>
      </section>
    </main>
  );
}
