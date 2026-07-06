import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/fonctionnalites", changeFrequency: "monthly", priority: 0.9 },
    { path: "/templates", changeFrequency: "monthly", priority: 0.8 },
    { path: "/tarifs", changeFrequency: "monthly", priority: 0.9 },
    { path: "/a-propos", changeFrequency: "yearly", priority: 0.5 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.6 },
    { path: "/parrainage", changeFrequency: "monthly", priority: 0.6 },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
