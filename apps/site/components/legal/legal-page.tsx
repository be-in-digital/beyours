import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Legal document shell — warm food-editorial art direction: paper background,
 * Bricolage headline, narrow reading column. The content comes through as plain
 * semantic HTML (h2 / h3 / p / ul / a), styled once via arbitrary variants so
 * the pages stay readable.
 */
export function LegalPage({ title, subtitle, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/[0.05] to-transparent"
      />

      <article className="relative mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          Retour à l&apos;accueil
        </Link>

        <header className="mt-6 border-b border-border pb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-[2.6rem] sm:leading-[1.05]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
          <p className="mt-5 text-xs uppercase tracking-[0.12em] text-muted-foreground/70">
            Dernière mise à jour : {lastUpdated}
          </p>
        </header>

        <div
          className={[
            "mt-8",
            "[&_h2]:mt-11 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
            "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground",
            "[&_p]:mb-4 [&_p]:text-[15px] [&_p]:leading-[1.75] [&_p]:text-muted-foreground",
            "[&_ul]:mb-4 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
            "[&_ol]:mb-4 [&_ol]:mt-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
            "[&_li]:text-[15px] [&_li]:leading-[1.7] [&_li]:text-muted-foreground",
            "[&_a]:font-medium [&_a]:text-primary-ink [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-2 hover:[&_a]:decoration-primary",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_address]:not-italic",
          ].join(" ")}
        >
          {children}
        </div>
      </article>
    </div>
  );
}

/**
 * Missing-information marker — deliberately rendered visible. No legal value
 * (share capital, director's name, mediator) is ever invented: it is flagged
 * here until the director provides it.
 */
export function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="mx-0.5 rounded bg-amber-100 px-1.5 py-0.5 align-baseline text-[0.92em] font-medium text-amber-900 ring-1 ring-inset ring-amber-300/70">
      [à compléter : {children}]
    </mark>
  );
}
