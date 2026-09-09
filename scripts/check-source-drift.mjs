#!/usr/bin/env node
/**
 * Fail when a package's source has moved since its last version bump and no
 * changeset will move it again.
 *
 * Usage:
 *   node scripts/check-source-drift.mjs [--warn-only]
 *
 *   --warn-only   report as ::warning:: and exit 0
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
 * SHALLOW CLONES. `actions/checkout` fetches depth 1, where a bump older than
 * the tip has no commit to find. The check then reports `unknown` rather than
 * guessing in either direction, and says so loudly enough that a job which
 * cannot answer the question does not look like a job that answered it. It runs
 * in ci.yml's `Lint`, which fetches full history for `check:pending-release`
 * already.
 *
 * THE SECOND GATE: A SUBPATH THE PUBLISHED VERSION DOES NOT HAVE.
 *
 * Source drift is a release that is merely late. A package that declares a
 * subpath in its `exports` while its PUBLISHED version does not carry that
 * subpath is a different animal: the mirror refuses to sync at all until a
 * release lands, so every unrelated change queues behind it. That deadlock has
 * now happened five times — most recently `@be-in-digital/ui`'s `./contrast`
 * and `./contrast-scan` — and each time it was found AFTER the merge, by the
 * sync failing, because the only thing checking subpaths was
 * `publish-mirror.mjs` and that runs on `main`.
 *
 * It is the same question asked one step earlier, against the same tarballs, so
 * the answer arrives on the pull request that adds the subpath — where the fix
 * is `pnpm changeset` and it costs one command.
 *
 * `--no-registry` skips it, and so does a lookup that fails: the registry is a
 * network call and this check also runs on a laptop with no `NODE_AUTH_TOKEN`.
 * An unreadable tarball is reported as unknown, never as fine — the same rule
 * the shallow-clone case follows, and for the same reason.
 */

import { execFileSync } from "node:child_process"
import { appendFileSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { EXPORTS_UNKNOWN, exportsResolve, publishedTarball } from "./lib/engine-exports.mjs"
import { CHANGESET_DIR, isChangesetFile, parseChangeset } from "./lib/pending-release.mjs"
import { lookupPublishedVersion, publishablePackages, REPO_ROOT } from "./lib/registry.mjs"
import { describeDrift, formatSummary, formatTable, summariseDrift } from "./lib/source-drift.mjs"

const warnOnly = process.argv.includes("--warn-only")
const skipRegistry = process.argv.includes("--no-registry")

for (const arg of process.argv.slice(2)) {
  if (arg !== "--warn-only" && arg !== "--no-registry") {
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

const { rows, drifted, unknown } = summariseDrift(entries, covered)

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

/* -------------------------------------------------------------------------- */
/* A subpath the published version does not have                              */
/* -------------------------------------------------------------------------- */

/** The subpaths a package's own `package.json` declares, `.` included. */
function declaredSubpaths(dir) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(REPO_ROOT, dir, "package.json"), "utf8"))
  } catch {
    return []
  }
  const map = manifest.exports
  // A string `exports` is the root and nothing else; no map means legacy
  // resolution, where every path already works and there is nothing to check.
  if (typeof map === "string") return ["."]
  if (!map || typeof map !== "object") return []
  return Object.keys(map).filter((key) => key.startsWith("."))
}

/**
 * Subpaths this package declares that a client installing it would not get.
 *
 * Returns `null` when the published version could not be read at all — which
 * is a question with no answer, and is reported as unknown rather than passed.
 */
function unpublishedSubpaths(pkg) {
  const declared = declaredSubpaths(pkg.dir)
  if (declared.length === 0) return []

  const lookup = lookupPublishedVersion(pkg.name)
  // The registry declining to answer is not the registry saying "fine".
  // `publishedVersion` collapses both into null, which is why this uses the
  // wider call — a check that silently does nothing is the thing being fixed.
  if (!lookup.known) return null
  // Never published at all: the mirror's own gate reports that, and it is not
  // this check's business — a first release is not a deadlock.
  if (!lookup.version) return []
  const version = lookup.version

  const { exports: published } = publishedTarball(pkg.name, version)
  if (published === EXPORTS_UNKNOWN) return null
  // The published manifest declares no map: Node resolves it legacily and
  // every subpath already works.
  if (published === undefined) return []

  return {
    version,
    missing: declared.filter((subpath) => !exportsResolve(published, subpath)),
  }
}

const subpathProblems = []
const subpathUnknown = []
let subpathChecked = 0

if (!skipRegistry) {
  for (const pkg of entries) {
    const result = unpublishedSubpaths(pkg)
    if (result === null) {
      subpathUnknown.push(pkg.name)
      continue
    }
    // An array is "nothing to compare" — no `exports` map on either side, or a
    // package that has never been published. Not a check that passed.
    if (Array.isArray(result)) continue
    subpathChecked += 1
    if (result.missing.length > 0) subpathProblems.push({ ...pkg, ...result })
  }
}

if (subpathUnknown.length > 0) {
  console.log(
    `::notice::${subpathUnknown.length} package(s) could not be checked for subpaths — the ` +
      "published tarball could not be read. Set NODE_AUTH_TOKEN (a read:packages PAT), or pass " +
      "--no-registry to skip this half deliberately."
  )
}

// Reported even when a changeset covers the package, unlike source drift.
// A waiting changeset is the normal case for drift and an emergency for this:
// until `changeset version` runs and the release publishes, the mirror refuses
// EVERY sync, so an unrelated storefront fix is queued behind it too. The
// message says which half is missing.
if (subpathProblems.length > 0) {
  const level = warnOnly ? "warning" : "error"
  console.log("")
  for (const row of subpathProblems) {
    const paths = row.missing.map((p) => `\`${p}\``).join(", ")
    const half = covered.has(row.name)
      ? "A changeset is waiting; the version bump is what is missing — cut the release."
      : "Run `pnpm changeset` on this pull request."
    console.log(
      `::${level} file=${row.dir}/package.json::${row.name} declares ${paths}, which ` +
        `${row.version} (the version a client installs) does not have. The mirror will refuse ` +
        `to sync anything until a release carries it. ${half}`
    )
  }

  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (summaryFile) {
    const lines = subpathProblems.map(
      (row) => `- \`${row.name}\` declares ${row.missing.join(", ")}, absent from ${row.version}`
    )
    appendFileSync(
      summaryFile,
      `### Subpaths not in the published version\n\n${lines.join("\n")}\n\n`
    )
  }
}

if (drifted.length === 0 && subpathProblems.length === 0) {
  console.log("Every package with source changes since its last release carries a changeset.")
  // Only claimed for the packages actually compared. Saying "every declared
  // subpath exists" after reading nine tarballs of ten and failing on all nine
  // is the same lie this check was extended to stop telling.
  if (skipRegistry) {
    console.log("Subpaths not checked (--no-registry).")
  } else if (subpathChecked === 0) {
    console.log("No package's subpaths could be compared against a published version.")
  } else {
    console.log(
      `Every declared subpath exists in the version a client installs ` +
        `(${subpathChecked} package(s) compared).`
    )
  }
  process.exit(0)
}

if (drifted.length === 0) process.exit(warnOnly ? 0 : 1)

const level = warnOnly ? "warning" : "error"
for (const row of drifted) {
  console.log(`::${level} file=${row.dir}/package.json::${describeDrift(row)}`)
}

const summaryFile = process.env.GITHUB_STEP_SUMMARY
if (summaryFile) appendFileSync(summaryFile, `${formatSummary(drifted)}\n\n`)

console.log("")
console.log(
  `${drifted.length} package(s) would be skipped by \`changeset publish\`. ` +
    "Run `pnpm changeset` (or `pnpm changeset --empty` if nothing is owed a release note)."
)

process.exit(warnOnly ? 0 : 1)
