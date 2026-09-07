#!/usr/bin/env node
/**
 * Report the engine fixes that are merged here and on no client site yet.
 *
 * Usage:
 *   node scripts/check-pending-release.mjs [--max-age-days N] [--fail]
 *
 *   --max-age-days N   warn about changesets waiting N days or more (default 7)
 *   --fail             make those warnings errors and exit 1
 *
 * WHY IT ONLY WARNS. Batching a few fixes into one release is the intended
 * workflow, not a defect — failing on a changeset that is hours old would
 * punish the normal case. What was missing is the FACT, not a gate: nothing
 * told anyone that `main` held merged fixes clients could not have. So this
 * always prints the list and escalates to a GitHub warning annotation only
 * once something has been waiting long enough to be a surprise.
 *
 * WHY SEVEN DAYS. Measured, not guessed, and deliberately generous. #209
 * records `integrations`, `marketing` and `ui` serving a two-month-old build
 * while the source had moved on — the entire Uber Direct module never reached
 * a client. A week is far tighter than that and still leaves room for a normal
 * release cadence. `--fail` exists so this can become blocking without a
 * rewrite; nothing passes it today.
 *
 * Reads `.changeset/`, dates each file by the commit that added it, and writes
 * the table to stdout, to $GITHUB_STEP_SUMMARY when there is anything to say,
 * and as ::warning:: / ::error:: annotations for whatever is stale.
 */

import { execFileSync } from "node:child_process"
import { appendFileSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  CHANGESET_DIR,
  formatSummary,
  formatTable,
  isChangesetFile,
  parseChangeset,
  REPO_ROOT,
  summarise,
} from "./lib/pending-release.mjs"

/** What the annotations point at — a path a reader can click, not an absolute one. */
const CHANGESET_LABEL = ".changeset"

function parseArgs(argv) {
  let maxAgeDays = 7
  let fail = false

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--fail") {
      fail = true
      continue
    }
    if (argv[i] === "--max-age-days") {
      const value = Number(argv[i + 1])
      if (!Number.isInteger(value) || value < 0) {
        console.error(`::error::--max-age-days needs a whole number, got "${argv[i + 1]}".`)
        process.exit(2)
      }
      maxAgeDays = value
      i += 1
      continue
    }
    console.error(`::error::Unknown argument "${argv[i]}".`)
    process.exit(2)
  }

  return { maxAgeDays, fail }
}

/**
 * When the changeset was committed, or null.
 *
 * Null is the ordinary answer on a shallow clone — `actions/checkout` fetches
 * depth 1, and a file added before the tip has no commit there to read. The
 * caller reports the changeset anyway; only the age claim is dropped.
 */
function addedAt(file) {
  try {
    const stamp = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--format=%cI", "-1", "--", join(CHANGESET_DIR, file)],
      // cwd pinned to the repository: git must run inside it whatever the
      // caller's working directory happens to be.
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim()
    return stamp === "" ? null : new Date(stamp)
  } catch {
    return null
  }
}

function readEntries() {
  let names
  try {
    names = readdirSync(CHANGESET_DIR)
  } catch {
    // No `.changeset/` at all is not this script's problem to raise. The
    // directory is resolved from the script, so this cannot mean "wrong cwd".
    return []
  }

  return names
    .filter(isChangesetFile)
    .sort()
    .map((file) => ({
      file,
      releases: parseChangeset(readFileSync(join(CHANGESET_DIR, file), "utf8")),
      addedAt: addedAt(file),
    }))
}

const { maxAgeDays, fail } = parseArgs(process.argv.slice(2))
const { rows, stale, unparseable, oldestDays } = summarise(readEntries(), {
  now: new Date(),
  maxAgeDays,
})

console.log(formatTable(rows))

if (unparseable.length > 0) {
  console.log("")
  console.log(`Not readable as changesets (\`changeset version\` decides): ${unparseable.join(", ")}`)
}

if (rows.length > 0) {
  console.log("")
  console.log(
    oldestDays === null
      ? `${rows.length} package release(s) waiting. Ages unavailable — shallow clone.`
      : `${rows.length} package release(s) waiting, the oldest for ${oldestDays} day(s).`,
  )

  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (summaryFile) appendFileSync(summaryFile, `${formatSummary(rows)}\n\n`)
}

for (const row of stale) {
  const level = fail ? "error" : "warning"
  console.log(
    `::${level} file=${CHANGESET_LABEL}/${row.file}::${row.name} has a ${row.bump} fix waiting ` +
      `${row.ageDays} days for a release. No client site has it. Cut a release, or say why not.`,
  )
}

process.exit(fail && stale.length > 0 ? 1 : 0)
