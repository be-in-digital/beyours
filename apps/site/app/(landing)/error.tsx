"use client";

/**
 * The public half: marketing pages, the template catalogue, the legal pages and
 * `/checkout`.
 *
 * Its own boundary rather than the root one, because this group's layout is
 * what carries the navbar and the footer — a crash caught here leaves the
 * visitor somewhere to go, and a crash caught at the root does not.
 *
 * `/checkout` is the page that makes this worth having. A buyer who reaches a
 * blank screen mid-purchase does not retry, and until now nobody would have
 * known it happened.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction, useErrorReport } from "@/lib/error-boundary";

export default function LandingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useErrorReport(error);

  return (
    <ErrorScreen
      title="Cette page n'a pas pu s'afficher"
      description="L'incident a été signalé automatiquement. Vous pouvez réessayer, ou nous écrire si cela se reproduit."
      digest={error.digest}
      testId="landing-error"
      actions={
        <>
          <button type="button" onClick={reset} className={primaryAction}>
            Réessayer
          </button>
          <Link href="/contact" className={secondaryAction}>
            Nous contacter
          </Link>
        </>
      }
    />
  );
}
