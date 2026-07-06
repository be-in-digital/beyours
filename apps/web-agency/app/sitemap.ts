import type { MetadataRoute } from "next";

import { sanityFetch } from "@/sanity/lib/fetch";
import { caseStudySlugsQuery } from "@/sanity/lib/queries";

const BASE_URL = "https://beindigital.fr";

/**
 * Sitemap dynamique — combine les routes statiques et les slugs des
 * case studies fetchées depuis Sanity.
 *
 * Régénéré au build et via revalidate (60s pour les case studies).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/work`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/products`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.7 },
    { url: `${BASE_URL}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const caseStudySlugs = await sanityFetch<string[]>({
    query: caseStudySlugsQuery,
  });
  const caseStudyRoutes: MetadataRoute.Sitemap = caseStudySlugs.map((slug) => ({
    url: `${BASE_URL}/work/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...caseStudyRoutes];
}
