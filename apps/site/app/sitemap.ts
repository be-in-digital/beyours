import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getAllTemplateSlugs } from "@/lib/templates-data";

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

// Hand-maintained routes. Anything generated from data (the template catalogue)
// is derived below instead, so adding a template never means editing this file.
const STATIC_ROUTES: Entry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/fonctionnalites", changeFrequency: "monthly", priority: 0.9 },
  { path: "/tarifs", changeFrequency: "monthly", priority: 0.9 },
  { path: "/decouvrir", changeFrequency: "monthly", priority: 0.8 },
  { path: "/templates", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.6 },
  { path: "/parrainage", changeFrequency: "monthly", priority: 0.6 },
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.5 },
  // Legal pages: low priority, but they are trust signals and were missing.
  { path: "/cgv", changeFrequency: "yearly", priority: 0.3 },
  { path: "/confidentialite", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.3 },
];

// /checkout is disallowed in robots.txt and /demo/[slug] is noindex, so neither
// belongs here. /admin is internal.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const templateRoutes: Entry[] = getAllTemplateSlugs().map((slug) => ({
    path: `/templates/${slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...STATIC_ROUTES, ...templateRoutes].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
