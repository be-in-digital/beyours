/**
 * 3 programmatic checks to confirm the caseStudy._id migration:
 *
 *   1. 8 documents with _id like "cs-*" exist (authoritative count).
 *   2. ZERO legacy "caseStudy.*" documents remain.
 *   3. The exact GROQ used by generateStaticParams (`caseStudySlugsQuery`)
 *      returns 8 slugs — without an editor token (anonymous, like the build
 *      runner sees it). This is the bug we were fixing.
 *
 * Run: pnpm tsx scripts/verify-case-study-ids.ts
 */
import { createClient } from "@sanity/client";

import { loadEnv } from "./lib/env";

const env = loadEnv();

const authedClient = createClient({
  projectId: env.projectId,
  dataset: env.dataset,
  apiVersion: "2025-04-27",
  token: env.token,
  useCdn: false,
});

// Anonymous client — exactly the auth context Vercel build hits.
const anonClient = createClient({
  projectId: env.projectId,
  dataset: env.dataset,
  apiVersion: "2025-04-27",
  useCdn: false,
});

const SLUGS_QUERY = `*[_type == "caseStudy" && defined(slug.current)][].slug.current`;

async function main() {
  let pass = 0;
  let fail = 0;

  // Test 1
  const newIds = await authedClient.fetch<string[]>(
    `*[_type == "caseStudy" && _id match "cs-*"]._id`,
  );
  if (newIds.length === 8) {
    console.log(`✓ test 1: 8 docs with cs-* _id (got ${newIds.length})`);
    pass++;
  } else {
    console.log(
      `✗ test 1: expected 8 cs-* docs, got ${newIds.length} — ${newIds.join(", ")}`,
    );
    fail++;
  }

  // Test 2
  const legacy = await authedClient.fetch<string[]>(
    `*[_type == "caseStudy" && _id match "caseStudy.*"]._id`,
  );
  if (legacy.length === 0) {
    console.log(`✓ test 2: 0 legacy caseStudy.* docs left`);
    pass++;
  } else {
    console.log(
      `✗ test 2: ${legacy.length} legacy docs still present — ${legacy.join(", ")}`,
    );
    fail++;
  }

  // Test 3 — the actual build-time query, anonymous.
  const slugs = await anonClient.fetch<string[]>(SLUGS_QUERY);
  if (slugs.length === 8) {
    console.log(
      `✓ test 3: anonymous slugs query returns 8 — ${slugs.sort().join(", ")}`,
    );
    pass++;
  } else {
    console.log(
      `✗ test 3: anonymous slugs query returns ${slugs.length} (expected 8) — ${slugs.join(", ")}`,
    );
    fail++;
  }

  console.log(`\n${pass}/${pass + fail} tests passed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
