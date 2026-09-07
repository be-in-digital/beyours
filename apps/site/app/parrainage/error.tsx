"use client";

/**
 * The affiliate portal.
 *
 * Its own boundary because an *apporteur d'affaires* who crashes mid-signature
 * or mid-payout needs their own dashboard back, not the marketing site — and
 * because the contract and invoice screens here are the ones where a silent
 * failure costs someone money.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction, useErrorReport } from "@/lib/error-boundary";

export default function ParrainageError({
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
      description="L'incident a été signalé automatiquement. Aucune de vos données n'a été perdue."
      digest={error.digest}
      testId="parrainage-error"
      actions={
        <>
          <button type="button" onClick={reset} className={primaryAction}>
            Réessayer
          </button>
          <Link href="/parrainage/dashboard" className={secondaryAction}>
            Retour au tableau de bord
          </Link>
        </>
      }
    />
  );
}
