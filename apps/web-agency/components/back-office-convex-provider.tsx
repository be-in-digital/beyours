"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

/**
 * Provider client du back-office : branche Convex + Convex Auth sur le
 * déploiement agence. Isolé du site public (qui n'a pas d'auth) — monté
 * uniquement sous `app/back-office/`.
 *
 * On lit `NEXT_PUBLIC_CONVEX_URL` (même var que le provider public), avec un
 * placeholder de secours pour ne pas crasher au build si l'URL manque.
 */
const url =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud";

const client = new ConvexReactClient(url);

export function BackOfficeConvexProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={client}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
