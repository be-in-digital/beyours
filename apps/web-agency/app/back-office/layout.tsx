import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

import { BackOfficeConvexProvider } from "../../components/back-office-convex-provider";

/**
 * Layout back-office. Enveloppe `/back-office/*` dans Convex Auth (serveur +
 * client). Le site public (`app/(site)`) n'est pas impacté.
 *
 * Pas de redirection ici : elle est gérée par le proxy (UX). Le verrou dur est
 * `authz.requireBackOfficeAccess` dans chaque fonction Convex — un compte sans
 * rôle ne lit/écrit rien même en atteignant cette page.
 */
export default function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <BackOfficeConvexProvider>{children}</BackOfficeConvexProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
