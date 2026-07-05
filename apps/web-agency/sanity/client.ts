import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "./env";

/**
 * Client public — lit le dataset live, sans authentification. Utilisé par
 * toutes les pages côté serveur (RSC). `useCdn: true` en production pour
 * lire depuis le CDN Sanity (faster, cached).
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production",
  perspective: "published",
  stega: false,
});
