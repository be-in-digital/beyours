import type { Metadata } from "next";
import Link from "next/link";

import { RevealItem, RevealStagger } from "@/components/reveal";
import { DeviceMockup } from "@/components/visuals/device-mockup";
import { sanityFetch } from "@/sanity/lib/fetch";
import { getCoverUrl } from "@/sanity/lib/get-cover-url";
import { allCaseStudiesQuery } from "@/sanity/lib/queries";
import type { CaseStudySummary } from "@/sanity/types";

export const metadata: Metadata = {
  title: "Études de cas",
  description:
    "Sélection de projets livrés par Be in Digital — sites premium, applications SaaS, marketplaces, plateformes sur mesure.",
  alternates: { canonical: "/work" },
};

export default async function WorkPage() {
  const studies = await sanityFetch<CaseStudySummary[]>({
    query: allCaseStudiesQuery,
  });

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      <section className="relative px-6 pt-32 pb-12 sm:px-10 sm:pt-40 sm:pb-16">
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            Selected work
          </p>
          <h1 className="font-display text-foreground text-5xl leading-[1.0] font-light tracking-tight sm:text-6xl lg:text-[5rem]">
            Ce qu’on a livré
            <br />
            <span className="text-muted-foreground italic">récemment.</span>
          </h1>
          <p className="text-muted-foreground mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
            Chaque étude détaille le contexte, l’approche et les résultats.
            On publie un nouveau cas par mois — abonnez-vous à la newsletter
            pour les recevoir en avant-première.
          </p>
        </div>
      </section>

      <section className="relative px-6 pt-8 pb-24 sm:px-10 sm:pb-32">
        <div className="mx-auto max-w-6xl">
          {studies.length === 0 ? (
            <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
              Première étude en cours de rédaction.
            </p>
          ) : (
            <RevealStagger
              staggerMs={150}
              className="grid gap-7 sm:grid-cols-2 lg:grid-cols-12"
            >
              {studies.map((s, i) => {
                const isLg = (s.size ?? "lg") === "lg";
                const colSpan = isLg ? "lg:col-span-7" : "lg:col-span-5";
                const offset =
                  i % 2 === 1 && studies.length > 1 ? "lg:col-span-5" : colSpan;
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
                              // Le premier mockup est l'image LCP candidate
                              // sur /work (hero court + grid commence vite).
                              priority={i === 0}
                            />
                          ) : (
                            <div className="relative aspect-[16/10]">
                              <div className="absolute inset-0 rounded-lg border border-white/[0.06] bg-black/30" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                                <p className="font-mono text-primary text-xs tracking-[0.3em] uppercase">
                                  {s.client}
                                </p>
                                <p className="font-display text-foreground/40 text-3xl italic">
                                  {s.title}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-4 p-6 sm:p-8">
                          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                            <span className="text-primary">{s.category}</span>
                            <span className="text-muted-foreground">
                              {s.year}
                            </span>
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
          )}

          <p className="text-muted-foreground mt-16 font-mono text-xs tracking-[0.2em] uppercase">
            D’autres cas en cours de publication — projets sous NDA disponibles
            sur demande.
          </p>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="relative px-6 py-24 sm:px-10 sm:py-32">
        <div className="bg-cta-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-start">
          <p className="font-mono text-primary mb-6 text-xs tracking-[0.2em] uppercase">
            On en parle ?
          </p>
          <h2 className="font-display text-foreground text-4xl leading-tight font-light sm:text-5xl lg:text-6xl">
            Votre projet
            <br />
            <span className="text-muted-foreground italic">
              sera le suivant ?
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
