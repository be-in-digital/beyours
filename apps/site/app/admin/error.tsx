"use client";

/**
 * The internal ops console.
 *
 * A different way out from the public one on purpose: an operator who hits a
 * crash on `/admin/flotte` wants the rest of the console, not the marketing
 * home page, and `/contact` is a form for prospects.
 *
 * Everything reaching here is reported, refusals included — see
 * `lib/error-boundary.tsx` for why this backend cannot tell the two apart.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction, useErrorReport } from "@/lib/error-boundary";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useErrorReport(error);

  return (
    <ErrorScreen
      title="Cet écran n'a pas pu s'afficher"
      description="L'incident a été signalé automatiquement. Si vous venez de vous connecter, vérifiez que votre compte est bien autorisé sur la console."
      digest={error.digest}
      testId="admin-error"
      actions={
        <>
          <button type="button" onClick={reset} className={primaryAction}>
            Réessayer
          </button>
          <Link href="/admin" className={secondaryAction}>
            Retour à la console
          </Link>
        </>
      }
    />
  );
}
