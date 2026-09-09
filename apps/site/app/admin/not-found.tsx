/**
 * The internal console's 404.
 *
 * Its own, inside the admin tree, so a stale bookmark leaves the operator in
 * the console with its navigation rather than on an unstyled English page.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction } from "@/lib/error-boundary";

export default function AdminNotFound() {
  return (
    <ErrorScreen
      title="Cette page n'existe pas"
      description="L'adresse demandée n'existe pas, ou l'écran a été déplacé."
      testId="admin-not-found"
      actions={
        <>
          <Link href="/admin" className={primaryAction}>
            Retour au tableau de bord
          </Link>
          <Link href="/" className={secondaryAction}>
            Voir le site
          </Link>
        </>
      }
    />
  );
}
