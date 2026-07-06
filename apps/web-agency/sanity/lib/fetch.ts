import { sanityClient } from "../client";

/**
 * Fetch helper — wrap `client.fetch` avec ISR (Next.js cache tags).
 * Toutes les pages utilisent ce helper pour avoir un revalidate cohérent.
 *
 * Une mutation Studio peut être propagée au front via webhook
 * `/api/revalidate` qui appelle `revalidateTag('sanity')`.
 */
export async function sanityFetch<T = unknown>({
  query,
  params = {},
  tags = ["sanity"],
  revalidate = 60,
}: {
  query: string;
  params?: Record<string, unknown>;
  tags?: string[];
  revalidate?: number;
}): Promise<T> {
  return sanityClient.fetch<T>(query, params, {
    next: { tags, revalidate },
  });
}
