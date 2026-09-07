/**
 * What sits in `.changeset/` on `main` and has therefore reached no client.
 *
 * WHY THIS EXISTS. Merging a fix to `packages/*` feels like shipping it. It is
 * not. `apps/themes` links the engine with `workspace:^` and compiles against
 * the current source, so this repository goes green the moment a fix lands;
 * a client installs the published tarball and gets nothing until a release is
 * cut. Between those two moments the fix exists everywhere except where it
 * was needed, and nothing said so.
 *
 * On 07/09/2026 that cost a diagnostic cycle. #387 fixed a product-form defect
 * and merged with its changeset; the mirror's CI then failed on that exact
 * test and read as the fix failing. It was not — `^9.0.0` still resolved to
 * 9.0.0, because no release had consumed the changeset. #390 made the resolved
 * versions visible in the mirror's log, which answers the question once you
 * are already staring at a red run. This answers it before anyone has to.
 *
 * #209 records the far worse version of the same shape: `integrations`,
 * `marketing` and `ui` served a July build for two months while the source had
 * moved on, and the entire Uber Direct module (~950 lines) never reached a
 * single client site.
 *
 * These functions are pure so the arithmetic can be tested without a git
 * repository or a CI runner; `scripts/check-pending-release.mjs` supplies the
 * filesystem and git.
 */

import { fileURLToPath } from "node:url"

/**
 * The repository's `.changeset/`, resolved from this file rather than from the
 * working directory.
 *
 * A relative `.changeset` would make the check silently answer "nothing
 * pending" when run from a subdirectory — a false negative in exactly the
 * check whose whole purpose is to stop a false negative. It is cheap to make
 * that impossible.
 */
export const CHANGESET_DIR = fileURLToPath(new URL("../../.changeset", import.meta.url))
export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url))

/** `.changeset/` files that are configuration or prose, never a release. */
const NOT_A_CHANGESET = new Set(["README.md", "config.json"])

export function isChangesetFile(name) {
  return name.endsWith(".md") && !NOT_A_CHANGESET.has(name)
}

/**
 * The packages and bump types a changeset declares.
 *
 * A changeset is YAML frontmatter between `---` fences followed by prose:
 *
 *     ---
 *     "@be-in-digital/admin": patch
 *     ---
 *
 *     Fix the product form's "Ajouter un choix" button doing nothing.
 *
 * Returns `null` for anything that does not have that shape, rather than
 * throwing: an unparseable file is worth reporting, not worth taking a CI job
 * down over — `changeset version` is the tool that gets to refuse it.
 */
export function parseChangeset(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.trimStart())
  if (!match) return null

  const releases = []
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === "") continue

    const entry = /^["']?(@?[^"':]+)["']?\s*:\s*["']?(major|minor|patch)["']?$/.exec(trimmed)
    if (!entry) return null

    releases.push({ name: entry[1].trim(), bump: entry[2] })
  }

  return releases.length > 0 ? releases : null
}

/** Whole days between two instants, floored. A null `addedAt` gives null. */
export function ageInDays(addedAt, now) {
  if (addedAt === null || addedAt === undefined) return null
  return Math.floor((now.getTime() - addedAt.getTime()) / 86_400_000)
}

/**
 * One row per package, oldest first, plus the verdict.
 *
 * `entries` are `{ file, releases, addedAt }` — `addedAt` null when git cannot
 * date the file. That is not hypothetical: `actions/checkout` clones at depth
 * 1 by default, and a file added before the tip has no commit in that clone.
 * An undated changeset is still reported, it just cannot be called stale — the
 * COUNT is the fact that was missing, the age only decides how loudly to say
 * it.
 */
export function summarise(entries, { now, maxAgeDays }) {
  const rows = []
  const unparseable = []

  for (const entry of entries) {
    if (entry.releases === null) {
      unparseable.push(entry.file)
      continue
    }
    for (const release of entry.releases) {
      rows.push({
        name: release.name,
        bump: release.bump,
        file: entry.file,
        addedAt: entry.addedAt ?? null,
        ageDays: ageInDays(entry.addedAt, now),
      })
    }
  }

  // Oldest first, undated last, then by name so the order is stable.
  rows.sort((a, b) => {
    if (a.ageDays === b.ageDays) return a.name.localeCompare(b.name)
    if (a.ageDays === null) return 1
    if (b.ageDays === null) return -1
    return b.ageDays - a.ageDays
  })

  const stale = rows.filter((row) => row.ageDays !== null && row.ageDays >= maxAgeDays)
  const oldest = rows.find((row) => row.ageDays !== null)?.ageDays ?? null

  return { rows, stale, unparseable, oldestDays: oldest }
}

/** The plain-text block for a CI log. */
export function formatTable(rows) {
  if (rows.length === 0) return "No unreleased engine fixes: `.changeset/` is empty."

  const width = Math.max(...rows.map((row) => row.name.length))
  const lines = ["Unreleased engine fixes — merged here, not yet on any client site:", ""]

  for (const row of rows) {
    const age = row.ageDays === null ? "age unknown" : `${row.ageDays}d`
    lines.push(`  ${row.name.padEnd(width)}  ${row.bump.padEnd(5)}  ${age.padStart(11)}  ${row.file}`)
  }

  return lines.join("\n")
}

/** The same rows as a markdown table, for $GITHUB_STEP_SUMMARY. */
export function formatSummary(rows) {
  return [
    "### Unreleased engine fixes",
    "",
    "Merged into `main`, not yet published — no client site has these.",
    "",
    "| Package | Bump | Waiting | Changeset |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => {
      const age = row.ageDays === null ? "unknown" : `${row.ageDays} day(s)`
      return `| \`${row.name}\` | ${row.bump} | ${age} | \`${row.file}\` |`
    }),
  ].join("\n")
}
