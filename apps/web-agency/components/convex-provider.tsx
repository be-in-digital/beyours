"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * ConvexClientProvider — branche React sur le déploiement Convex agence.
 *
 * On crée toujours un ConvexReactClient (même avec une URL placeholder
 * en dernier recours) pour que le ConvexProvider wrappe systématiquement
 * l'arbre. Sinon useMutation/useQuery crashent au prerender / build
 * statique, parce que le wrapper ne retournerait que <>{children}</>.
 */
const url =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud";

const client = new ConvexReactClient(url);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
