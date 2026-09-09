/**
 * The 404 page, at the root — the one Next.js reaches for an address that
 * matches no route.
 *
 * WITHOUT THIS FILE, and there was none in any of the three applications,
 * every 404 on beyours.fr rendered Next's built-in default: a black page
 * reading "404 — This page could not be found." in English, with no navbar and
 * no way back. On a commercial site that is a visitor lost at the first stale
 * link.
 *
 * A server component with no client state, so it renders whatever else is
 * wrong. `(landing)/not-found.tsx` is the one that keeps the navbar; this is
 * the backstop outside every group.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction } from "@/lib/error-boundary";

export default function RootNotFound() {
  return (
    <ErrorScreen
      title="Cette page n'existe pas"
      description="L'adresse demandée n'existe pas ou n'existe plus. Le lien a peut-être changé."
      testId="root-not-found"
      actions={
        <>
          <Link href="/" className={primaryAction}>
            Retour à l&apos;accueil
          </Link>
          <Link href="/templates" className={secondaryAction}>
            Voir les templates
          </Link>
        </>
      }
    />
  );
}
