/**
 * Migration des 8 MDX → documents `caseStudy` Sanity.
 *
 * Pour chaque MDX :
 *   1. parse frontmatter + body via gray-matter
 *   2. upload le cover image vers le CDN Sanity (apps/agency/public/work/<file>)
 *   3. convertit le body markdown en Portable Text
 *   4. crée ou remplace le document Sanity (déterministe via _id = slug)
 *
 * Run : pnpm tsx scripts/migrate-case-studies.ts (depuis apps/agency)
 *
 * Pré-requis env : SANITY_API_TOKEN (Editor), NEXT_PUBLIC_SANITY_PROJECT_ID,
 * NEXT_PUBLIC_SANITY_DATASET. Lus via dotenv depuis .env.local.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@sanity/client";
import matter from "gray-matter";

import { markdownToPortableText } from "./lib/markdown-to-pt";
import { loadEnv } from "./lib/env";

const env = loadEnv();

const client = createClient({
  projectId: env.projectId,
  dataset: env.dataset,
  apiVersion: "2025-04-27",
  token: env.token,
  useCdn: false,
});

type Frontmatter = {
  slug: string;
  client: string;
  category: string;
  year: string;
  title: string;
  blurb: string;
  cover?: string;
  liveUrl?: string;
  services?: string[];
  size?: "sm" | "md" | "lg";
  order?: number;
};

const STUDIO_VENTURE_SLUGS = new Set(["jokko", "wedilly-bird"]);
const CONTENT_DIR = path.resolve(__dirname, "../content/case-studies");
const PUBLIC_DIR = path.resolve(__dirname, "../public");

async function uploadCover(
  coverPath: string,
  alt: string,
): Promise<{ _type: "image"; asset: { _type: "reference"; _ref: string }; alt: string }> {
  // coverPath est typiquement "/work/bid-restaurant.png"
  const filePath = path.join(PUBLIC_DIR, coverPath.replace(/^\//, ""));
  const buffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  console.log(`  ↑ uploading ${filename}…`);
  const asset = await client.assets.upload("image", buffer, { filename });
  return {
    _type: "image",
    asset: { _type: "reference", _ref: asset._id },
    alt,
  };
}

async function migrateStudy(file: string) {
  const filePath = path.join(CONTENT_DIR, file);
  const raw = await fs.readFile(filePath, "utf8");
  const { data, content } = matter(raw);
  const fm = { ...(data as Frontmatter), slug: data.slug ?? file.replace(/\.mdx$/, "") };

  console.log(`\n→ ${fm.slug}`);

  const cover = fm.cover
    ? await uploadCover(fm.cover, `Aperçu du projet ${fm.title}`)
    : undefined;

  const body = markdownToPortableText(content);

  const isStudioVenture = STUDIO_VENTURE_SLUGS.has(fm.slug);
  const studioStatus = isStudioVenture
    ? fm.slug === "jokko"
      ? "Live · 2025"
      : "Beta · 2025"
    : undefined;

  const doc = {
    _id: `cs-${fm.slug}`,
    _type: "caseStudy",
    title: fm.title,
    slug: { _type: "slug" as const, current: fm.slug },
    client: fm.client,
    category: fm.category,
    year: fm.year,
    blurb: fm.blurb,
    cover,
    liveUrl: fm.liveUrl ?? undefined,
    services: fm.services ?? [],
    size: fm.size ?? "md",
    order: fm.order ?? 99,
    isStudioVenture,
    ...(studioStatus ? { studioStatus } : {}),
    body,
  };

  const res = await client.createOrReplace(doc);
  console.log(`  ✓ ${res._id}`);

  // Cleanup : supprimer l'ancien _id avec un point (invisible aux
  // lectures publiques dans Sanity car traité comme system doc).
  try {
    await client.delete(`caseStudy.${fm.slug}`);
    console.log(`  ✗ deleted legacy caseStudy.${fm.slug}`);
  } catch {
    // OK si déjà absent
  }
}

async function main() {
  const files = (await fs.readdir(CONTENT_DIR)).filter((f) => f.endsWith(".mdx"));
  console.log(`Found ${files.length} MDX files in ${CONTENT_DIR}`);
  for (const file of files) {
    await migrateStudy(file);
  }
  console.log(`\nDone — ${files.length} case studies migrated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
