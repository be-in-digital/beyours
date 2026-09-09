/**
 * The public site's 404, inside the group that carries the navbar and footer.
 *
 * Its own rather than the root one for the same reason this group has its own
 * error boundary: a visitor who mistyped an address, or followed a link to a
 * template or an article that has moved, keeps the navigation and is one click
 * from somewhere useful.
 */

import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction } from "@/lib/error-boundary";

export default function LandingNotFound() {
  return (
    <ErrorScreen
      title="Cette page n'existe pas"
      description="Elle a peut-être été déplacée, ou l'adresse a changé. Le reste du site est toujours là."
      testId="landing-not-found"
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
