import { notFound } from "next/navigation";

import { PortableTextBody } from "@/components/portable-text";
import { sanityFetch } from "@/sanity/lib/fetch";
import { legalPageBySlugQuery } from "@/sanity/lib/queries";
import type { LegalPage } from "@/sanity/types";

/**
 * Composant partagé qui rend les 3 pages légales (mentions, confidentialité,
 * cookies) à partir du slug. Le contenu vient de la collection legalPage
 * dans Sanity, géré comme document distinct par slug.
 */
export async function LegalPageView({ slug }: { slug: string }) {
  const page = await sanityFetch<LegalPage | null>({
    query: legalPageBySlugQuery,
    params: { slug },
  });
  if (!page) notFound();

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      <section className="relative px-6 pt-32 pb-12 sm:px-10 sm:pt-40 sm:pb-16">
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
            {page.eyebrow}
          </p>
          <h1 className="font-display text-foreground text-5xl leading-[1.0] font-light tracking-tight sm:text-6xl">
            {page.title}
          </h1>
          {page.intro ? (
            <p className="text-muted-foreground mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {page.intro}
            </p>
          ) : null}
          {page.lastUpdated ? (
            <p className="text-muted-foreground/70 mt-6 font-mono text-xs tracking-[0.2em] uppercase">
              {page.lastUpdated}
            </p>
          ) : null}
        </div>
      </section>

      <section className="relative px-6 pb-24 sm:px-10 sm:pb-32">
        <div className="mx-auto max-w-3xl">
          <PortableTextBody value={page.body} />
        </div>
      </section>
    </main>
  );
}
