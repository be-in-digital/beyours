/**
 * One-shot: rename all caseStudy._id from "caseStudy.<slug>" to "cs-<slug>".
 *
 * Why: Sanity treats _id with a dot as system/private docs and hides them
 * from unauthenticated reads — which broke /work/[slug] generateStaticParams
 * at build time (no slugs returned).
 *
 * Strategy: fetch the existing doc, create a new one with the same fields
 * but a dot-free _id, then delete the legacy doc. Image asset references
 * are by _ref so they survive.
 */
import { createClient } from "@sanity/client";

import { loadEnv } from "./lib/env";

const env = loadEnv();

const client = createClient({
  projectId: env.projectId,
  dataset: env.dataset,
  apiVersion: "2025-04-27",
  token: env.token,
  useCdn: false,
});

async function main() {
  const docs = await client.fetch(
    `*[_type == "caseStudy" && _id match "caseStudy.*"]`,
  );
  console.log(`Found ${docs.length} legacy docs to migrate.`);

  for (const doc of docs as Array<{ _id: string; slug?: { current?: string } }>) {
    const slug = doc.slug?.current;
    if (!slug) {
      console.warn(`  ⚠ skipping ${doc._id} — no slug`);
      continue;
    }
    const newId = `cs-${slug}`;
    const oldId = doc._id;

    // Strip system fields (_id, _rev, _createdAt, _updatedAt) — let Sanity
    // regenerate them on the new doc. Keep _type and the rest verbatim.
    const {
      _id: _ignoreId,
      _rev: _ignoreRev,
      _createdAt: _ignoreCreated,
      _updatedAt: _ignoreUpdated,
      ...rest
    } = doc as Record<string, unknown>;

    void _ignoreId;
    void _ignoreRev;
    void _ignoreCreated;
    void _ignoreUpdated;

    const newDoc = { _id: newId, ...rest };

    console.log(`→ ${oldId} → ${newId}`);
    await client.createOrReplace(newDoc as Parameters<typeof client.createOrReplace>[0]);
    await client.delete(oldId);
    console.log(`  ✓`);
  }

  console.log(`\nDone — ${docs.length} case studies migrated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
