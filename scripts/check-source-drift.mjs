#!/usr/bin/env node
/**
 * Fail when a package's source has moved since its last version bump and no
 * changeset will move it again.
 *
 * Usage:
 *   node scripts/check-source-drift.mjs [--warn-only]
 *
 *   --warn-only        report drift as ::warning:: and exit 0
 *   --fail-waiting     also fail on a package whose release has not been cut
 *
 * WHY IT GATES, where `check:pending-release` only reports. A changeset that
 * exists and is waiting is the intended workflow — batching a few fixes into
 * one release is normal, and failing on one hours old would punish the normal
 * case. A changeset that does NOT exist is never intended and never resolves
 * itself: `changeset publish` skips a package whose version has not moved, so
 * the source sits in `main` compiling green against `apps/themes`'s
 * `workspace:^` link and reaching no client, indefinitely. #209 records two
 * months of exactly that, with the entire Uber Direct module never shipping.
 *
 * The fix is one command — `pnpm changeset` — and it belongs on the pull
 * request that introduced the change, which is the only moment anyone still
 * knows what the change was.
 *
 * A REFACTOR WITH NOTHING TO ANNOUNCE still needs one. `pnpm changeset --empty`
 * exists for that and is the honest answer: it records that the source moved
 * and that nobody owed a release note, which is a different statement from
 * silence.
 *
 * "COVERED" WAS NOT "RELEASED", and the table said the first while everyone
 * read the second. A package with a waiting changeset was printed as `covered`
 * beside `clean`, closed with "Every package with source changes since its last
 * release carries a changeset.", and exited 0 — while `publish-mirror --check`
 * exited 1 on that same package, because the registry was still serving the
 * build made before those files moved. Both were right about their own
 * question. Only one of them was being read as an answer to the other.
 *
 * So the state is `waiting` now, its row says what the registry is serving, and
 * the run emits a `::notice::` naming the packages. It still does not GATE:
 * batching a few fixes into one release is the intended workflow, and
 * `lib/pending-release.mjs` sets out at length why failing the Release run
 * would stop the mirror this is reporting on. `--fail-waiting` makes it
 * blocking for whoever decides otherwise; nothing passes it today, which is the
 * same escape hatch `check-pending-release.mjs` keeps in `--fail`.
 *
 * SHALLOW CLONES. `actions/checkout` fetches depth 1, where a bump older than
 * the tip has no commit to find. The check then reports `unknown` rather than
 * guessing in either direction, and says so loudly enough that a job which
 * cannot answer the question does not look like a job that answered it. It runs
 * in ci.yml's `Lint`, which fetches full history for `check:pending-release`
 * already.
 */

import { execFileSync } from "node:child_process"
import { appendFileSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { CHANGESET_DIR, isChangesetFile, parseChangeset } from "./lib/pending-release.mjs"
import { publishablePackages, REPO_ROOT } from "./lib/registry.mjs"
import {
  describeDrift,
  describeWaiting,
  formatSummary,
  formatTable,
  formatWaitingSummary,
  summariseDrift,
} from "./lib/source-drift.mjs"

const warnOnly = process.argv.includes("--warn-only")
const failWaiting = process.argv.includes("--fail-waiting")

for (const arg of process.argv.slice(2)) {
  if (arg !== "--warn-only" && arg !== "--fail-waiting") {
    console.error(`::error::Unknown argument "${arg}".`)
    process.exit(2)
  }
}

const git = (args) => {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

/**
 * The commit that last moved this package's `version`, or null.
 *
 * `-G` matches commits whose diff added or removed a line matching the regex,
 * so this is one git call rather than a walk that reads every revision of the
 * manifest. `"version":` occurs once in a package.json — dependency entries are
 * `"react": "…"`, which the pattern does not match — so the first hit is the
 * bump. The commit that ADDED the file matches too, which is the right answer
 * for a package that has never been bumped since it was written.
 */
function lastVersionBump(dir) {
  return git(["log", "--format=%H", "-1", "-G", '"version":', "--", `${dir}/package.json`]) || null
}

/**
 * What has changed under the package since that commit.
 *
 * `git diff A HEAD`, not `git log A..HEAD`: a change made and then reverted
 * nets out, and a package whose source is byte-identical to its released state
 * owes nobody a release.
 */
function changedSince(sha, dir) {
  const out = git(["diff", "--name-only", sha, "HEAD", "--", dir])
  return out === null ? [] : out.split("\n").filter(Boolean)
}

/** Every package named by a changeset waiting in `.changeset/`. */
function coveredPackages() {
  let names
  try {
    names = readdirSync(CHANGESET_DIR)
  } catch {
    return new Set()
  }

  const covered = new Set()
  for (const file of names.filter(isChangesetFile)) {
    const releases = parseChangeset(readFileSync(join(CHANGESET_DIR, file), "utf8"))
    // An unparseable changeset is `check:pending-release`'s to report and
    // `changeset version`'s to refuse. Not knowing what it names is not a
    // reason to claim it names nothing.
    for (const release of releases ?? []) covered.add(release.name)
  }
  return covered
}

const covered = coveredPackages()
const entries = publishablePackages().map((pkg) => {
  const since = lastVersionBump(pkg.dir)
  return { ...pkg, since, changed: since === null ? [] : changedSince(since, pkg.dir) }
})

const { rows, drifted, waiting, unknown } = summariseDrift(entries, covered)

console.log(formatTable(rows))
console.log("")

if (unknown.length > 0) {
  // Not an error and not a pass: the check could not run. Said out loud so a
  // job that answered nothing does not read as a job that answered "fine".
  console.log(
    `::notice::${unknown.length} package(s) could not be checked — no version bump in this clone's ` +
      "history. Fetch full history (actions/checkout with fetch-depth: 0) for this check to mean anything."
  )
}

const summaryFile = process.env.GITHUB_STEP_SUMMARY

if (waiting.length > 0) {
  // Reported at every run, including the green ones — this IS the green one's
  // finding. Exit 0 used to be the whole message, and "has a changeset" was
  // read as "a client has the code".
  console.log(`::${failWaiting ? "error" : "notice"}::${describeWaiting(waiting)}`)
  if (summaryFile) appendFileSync(summaryFile, `${formatWaitingSummary(waiting)}\n\n`)
}

if (drifted.length === 0) {
  console.log(
    waiting.length === 0
      ? "Every package with source changes since its last release carries a changeset, and every " +
          "changeset has been released."
      : `Every package with source changes carries a changeset — but ${waiting.length} of them are ` +
          "still waiting for a release, so no client site has that code yet.",
  )
  process.exit(failWaiting && waiting.length > 0 ? 1 : 0)
}

const level = warnOnly ? "warning" : "error"
for (const row of drifted) {
  console.log(`::${level} file=${row.dir}/package.json::${describeDrift(row)}`)
}

if (summaryFile) appendFileSync(summaryFile, `${formatSummary(drifted)}\n\n`)

console.log("")
console.log(
  `${drifted.length} package(s) would be skipped by \`changeset publish\`. ` +
    "Run `pnpm changeset` (or `pnpm changeset --empty` if nothing is owed a release note)."
)

process.exit(warnOnly && !(failWaiting && waiting.length > 0) ? 0 : 1)
