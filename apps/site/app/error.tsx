"use client";

/**
 * Root error boundary — the backstop.
 *
 * App Router bubbles a render error to the nearest `error.tsx`, so most crashes
 * are caught by the boundary of the route group they happened in, which keeps
 * that group's chrome on screen. This file catches what is left: anything
 * outside a group, and anything a group boundary itself throws.
 *
 * It renders outside every group layout, so it cannot assume a navbar exists.
 * That is why its way out is a plain link rather than a nav item.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction, useErrorReport } from "@/lib/error-boundary";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useErrorReport(error);

  return (
    <ErrorScreen
      title="Une erreur est survenue"
      description="La page n'a pas pu s'afficher. L'incident a été signalé automatiquement."
      digest={error.digest}
      testId="root-error"
      actions={
        <>
          <button type="button" onClick={reset} className={primaryAction}>
            Réessayer
          </button>
          <Link href="/" className={secondaryAction}>
            Retour à l&apos;accueil
          </Link>
        </>
      }
    />
  );
}
