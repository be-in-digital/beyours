"use client";

/**
 * The shared half of every `error.tsx` on beyours.fr.
 *
 * There were none at all. App Router's default for an uncaught render error is
 * a blank page with no message and no report; on the app that takes the money
 * that meant a broken checkout looked, to the buyer, like a site that does not
 * work and, to us, like nothing at all.
 *
 * Duplicating the reporting into five boundary files is how one of them
 * quietly stops reporting, so the effect lives here once and the files decide
 * only what a visitor sees and where they can go.
 *
 * ## Why there is no refusal classification here
 *
 * `apps/reference` and `apps/themes` tell a refused query apart from a crash,
 * because the engine throws `ConvexError` with a `data.code` that survives
 * Convex's production redaction. This backend does not: `convex/admin.ts`
 * throws `new Error("Accès non autorisé")`, whose message a production
 * deployment replaces with "Server Error" before the browser sees it. There is
 * nothing left to classify on, so everything that reaches a boundary here is
 * reported. If the admin console ever grows a structured refusal, this is the
 * file that gains the branch — not the five boundaries.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Hand one error to the tracker.
 *
 * A plain function rather than the body of the effect below, and kept exported,
 * for one reason: an effect does not run under `renderToStaticMarkup`, so a
 * test that only rendered a boundary would assert nothing about reporting —
 * which is the half that silently rots. This is the seam the suite calls.
 */
export function reportBoundaryError(error: Error): void {
  Sentry.captureException(error);
}

/**
 * Report the error once, on mount.
 *
 * Separate from the screen below so a boundary that renders its own markup
 * still reports the same way. The effect is deliberately keyed on the error:
 * React re-renders a boundary on every parent update, and reporting on each of
 * them would file one incident as dozens.
 */
export function useErrorReport(error: Error): void {
  useEffect(() => {
    reportBoundaryError(error);
  }, [error]);
}

export function ErrorScreen({
  title,
  description,
  digest,
  actions,
  testId,
}: {
  title: string;
  description: string;
  /**
   * Next's error digest. It is the only handle a visitor can quote to support,
   * and the same value Sentry files the event under.
   */
  digest?: string;
  actions: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
      data-testid={testId}
    >
      <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {digest && (
        <p className="font-mono text-xs text-muted-foreground">Référence : {digest}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{actions}</div>
    </div>
  );
}

/** The primary action. Terracotta, per `DESIGN.md`'s single locked accent. */
export const primaryAction =
  "rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90";

/** The way out, for a visitor who does not want to retry. */
export const secondaryAction =
  "rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2";
