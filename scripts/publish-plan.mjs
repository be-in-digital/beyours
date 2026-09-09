#!/usr/bin/env node
/**
 * Will this commit publish anything?
 *
 * Usage:
 *   node scripts/publish-plan.mjs        # print the plan, set the job output
 *
 * WHY IT EXISTS. `release.yml` has to gate `changeset publish` on the E2E
 * suite: `E2E Status` became a required check on 03/09/2026 and the release
 * chain gated on the other four only, so a red or still-running suite could not
 * stop a publish (#308). Measured on `aa026e6`: Release finished 6m45s before
 * the suite reported.
 *
 * The obvious fix — always wait for E2E — bills eight sharded runners, about
 * twelve minutes, on every push to `main`. Measured against the history rather
 * than guessed: of the 293 commits on `main` between 01/07/2026 and 07/09/2026,
 * **12 moved a `packages/*` version**. So 96% of pushes would pay for a gate on
 * a publish that never happens, and `changeset publish` would print
 * "No unpublished projects to publish" at the end of it.
 *
 * So the chain asks first. This is the same comparison `changeset publish`
 * makes — each package's version against the registry — and it costs one
 * `npm view` per package, about five seconds for all ten.
 *
 * FAILING SAFE. A lookup that cannot reach the registry answers null, which is
 * not equal to the workspace version, which reports the package as one that
 * would publish. That is deliberate: an unanswerable question must gate rather
 * than wave through, and it matches what `changeset publish` will then attempt
 * on the same broken token.
 *
 * AND THE QUESTION UNDERNEATH IT. "Nothing to publish" has two causes that
 * `changeset publish` reports identically — ten lines of `already published`,
 * exit 0. Either no fix is waiting, which is the ordinary push, or fixes are
 * waiting and `changeset version` has not been run, which is a stalled
 * distribution chain: nothing published means nothing tagged, and
 * `publish-mirror.yml`'s `workflow_run` path requires a tag at HEAD, so the
 * mirror stops syncing too. Measured on the eight commits after `3a6cb8d`:
 * Release green on seven, publishing on none, the mirror eight commits behind
 * throughout. `owedBump` in `lib/pending-release.mjs` separates the two and
 * says which one this is.
 *
 * Writes `publishing=true|false`, `packages=<names>` and `bump_owed=true|false`
 * to $GITHUB_OUTPUT, the table to stdout, and a summary to
 * $GITHUB_STEP_SUMMARY when there is something to publish or something owed.
 */

import { appendFileSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  CHANGESET_DIR,
  formatOwedBump,
  formatOwedBumpSummary,
  isChangesetFile,
  owedBump,
  parseChangeset,
} from "./lib/pending-release.mjs"
import { publishablePackages, REGISTRY, unpublishedPackages } from "./lib/registry.mjs"

/** The plain-text block for a CI log. */
function formatTable(packages, pending) {
  if (packages.length === 0) return "No publishable packages under `packages/`."

  const width = Math.max(...packages.map((pkg) => pkg.name.length))
  const missing = new Set(pending.map((pkg) => pkg.name))
  const lines = [`Versions in the workspace against ${REGISTRY}:`, ""]

  for (const pkg of packages) {
    const published = pending.find((p) => p.name === pkg.name)?.published
    const state = missing.has(pkg.name)
      ? `WILL PUBLISH (registry has ${published ?? "nothing"})`
      : "already published"
    lines.push(`  ${pkg.name.padEnd(width)}  ${pkg.version.padEnd(8)}  ${state}`)
  }

  return lines.join("\n")
}

/** The same rows as a markdown table, for $GITHUB_STEP_SUMMARY. */
function formatSummary(pending) {
  return [
    "### This push will publish",
    "",
    "The E2E suite gates the publish below — see `release.yml`.",
    "",
    "| Package | Version | Registry has |",
    "| --- | --- | --- |",
    ...pending.map((pkg) => {
      return `| \`${pkg.name}\` | ${pkg.version} | ${pkg.published ?? "_nothing_"} |`
    }),
  ].join("\n")
}

const packages = publishablePackages()
const pending = unpublishedPackages(packages)

console.log(formatTable(packages, pending))
console.log("")
console.log(
  pending.length === 0
    ? "Nothing to publish — the E2E gate is skipped."
    : `${pending.length} package(s) to publish — the E2E suite gates them.`
)

/**
 * Every changeset waiting in `.changeset/`, parsed where possible.
 *
 * No git here, unlike `check-pending-release.mjs`: that check dates each file
 * by the commit that added it, which needs full history and degrades to
 * "unknown" on the depth-1 clone this job uses. The COUNT and the package
 * names are what decide the verdict, and both are readable from the tree.
 */
function waitingChangesets() {
  let names
  try {
    names = readdirSync(CHANGESET_DIR)
  } catch {
    // No `.changeset/` at all is not this script's to raise, and the directory
    // is resolved from the script, so this cannot mean "wrong cwd".
    return []
  }

  return names
    .filter(isChangesetFile)
    .sort()
    .map((file) => ({ file, releases: parseChangeset(readFileSync(join(CHANGESET_DIR, file), "utf8")) }))
}

const owed = owedBump({ willPublish: pending.length > 0, changesets: waitingChangesets() })

if (owed) {
  console.log("")
  console.log(formatOwedBump(owed))
  // A warning, not an error, and `lib/pending-release.mjs` says why at length:
  // failing here would take the Release run red, and the mirror's
  // `workflow_run` path fires only on a green one — so the gate would cause
  // the outage it is reporting.
  console.log(
    `::warning::A version bump is owed: ${owed.files} changeset(s) waiting and this push publishes ` +
      "nothing. Run `pnpm version-packages`, commit, and merge — until then no client site gets " +
      "these fixes and the mirror will not sync.",
  )
}

const output = process.env.GITHUB_OUTPUT
if (output) {
  appendFileSync(output, `publishing=${pending.length > 0}\n`)
  appendFileSync(output, `packages=${pending.map((pkg) => pkg.name).join(",")}\n`)
  // Nothing gates on this yet, deliberately. It exists so that making the
  // owed bump blocking is a workflow change rather than a rewrite of this
  // script — the same escape hatch `check-pending-release.mjs` keeps in
  // `--fail`.
  appendFileSync(output, `bump_owed=${owed !== null}\n`)
}

const summary = process.env.GITHUB_STEP_SUMMARY
if (summary && pending.length > 0) appendFileSync(summary, `${formatSummary(pending)}\n\n`)
if (summary && owed) appendFileSync(summary, `${formatOwedBumpSummary(owed)}\n\n`)
