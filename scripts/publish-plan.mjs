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
 * FAILING SAFE IS NOT FAILING SILENTLY, and it used to be. Every non-answer was
 * printed as `registry has nothing` — a claim about the registry, made when the
 * registry had refused to answer. Measured with no `NODE_AUTH_TOKEN`: `npm view`
 * returned `E401` ten times and the table asserted the registry held nothing for
 * nine packages it serves. The rows now say `registry did not answer — npm
 * E401`, and a run where any lookup failed says so once more at the bottom,
 * because in that state every other line of the plan is a guess: `owedBump`
 * reads "this push publishes something" from the same nulls and therefore
 * reports no owed bump, whatever is waiting in `.changeset/`.
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
 * AND WHETHER IT MAY. `RELEASE_HOLD.md` at the repository root holds the
 * release deliberately — see lib/release-hold.mjs. A hold does not change the
 * arithmetic below, only the verdict: the table still says what WOULD publish,
 * `publishing` answers false, and the run stays green.
 *
 * Writes `publishing=true|false`, `held=true|false`, `packages=<names>` and
 * `bump_owed=true|false` to $GITHUB_OUTPUT, the table to stdout, and a summary
 * to $GITHUB_STEP_SUMMARY when there is something to publish, something owed,
 * or a hold in place.
 */

import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CHANGESET_DIR,
  formatOwedBump,
  formatOwedBumpSummary,
  isChangesetFile,
  owedBump,
  parseChangeset,
} from './lib/pending-release.mjs'
import { formatHold, releaseHold } from './lib/release-hold.mjs'
import {
  anyUnreachable,
  publishablePackages,
  REGISTRY,
  UNREACHABLE,
  unpublishedPackages,
} from './lib/registry.mjs'

/**
 * What the registry said about one package, in the words it actually used.
 *
 * `registry has nothing` is a claim about the REGISTRY and it was printed
 * whenever the lookup returned null — including when npm had answered `E401`
 * and said nothing about the package at all. Run without a token, the table
 * asserted "registry has nothing" for nine packages the registry serves. A 401
 * read as a 404, and the one line anybody reads before believing the plan was
 * the line that was wrong.
 */
function describeRegistry(pkg) {
  if (pkg.publishedState === UNREACHABLE) {
    return `registry did not answer${pkg.lookupCode ? ` — npm ${pkg.lookupCode}` : ''}`
  }
  return `registry has ${pkg.published ?? 'nothing'}`
}

/** The plain-text block for a CI log. */
function formatTable(packages, pending) {
  if (packages.length === 0) return 'No publishable packages under `packages/`.'

  const width = Math.max(...packages.map((pkg) => pkg.name.length))
  const byName = new Map(pending.map((pkg) => [pkg.name, pkg]))
  const lines = [`Versions in the workspace against ${REGISTRY}:`, '']

  for (const pkg of packages) {
    const row = byName.get(pkg.name)
    const state = row ? `WILL PUBLISH (${describeRegistry(row)})` : 'already published'
    lines.push(`  ${pkg.name.padEnd(width)}  ${pkg.version.padEnd(8)}  ${state}`)
  }

  return lines.join('\n')
}

/** The same rows as a markdown table, for $GITHUB_STEP_SUMMARY. */
function formatSummary(pending) {
  return [
    '### This push will publish',
    '',
    'The E2E suite gates the publish below — see `release.yml`.',
    '',
    '| Package | Version | Registry said |',
    '| --- | --- | --- |',
    ...pending.map((pkg) => {
      const said =
        pkg.publishedState === UNREACHABLE ? '_did not answer_' : (pkg.published ?? '_nothing_')
      return `| \`${pkg.name}\` | ${pkg.version} | ${said} |`
    }),
  ].join('\n')
}

const packages = publishablePackages()
const pending = unpublishedPackages(packages)

/**
 * A deliberate hold outranks everything below.
 *
 * The arithmetic still runs and the table is still printed, because "what WOULD
 * this publish" is the question somebody lifting the hold wants answered — a
 * held run that printed nothing would make the reviewer delete the file to find
 * out. What the hold changes is the VERDICT: `publishing` goes to false, so the
 * release job stands down and the twelve-minute E2E gate is not billed for a
 * publish that will not happen.
 *
 * It is not a failure. A red `Release` is indistinguishable from a publish that
 * broke, and the mirror's `workflow_run` path fires only on a green one — the
 * same reason `bump_owed` is a warning. See lib/release-hold.mjs.
 */
const hold = releaseHold()

console.log(formatTable(packages, pending))
console.log('')
if (hold) {
  console.log(formatHold(hold))
  console.log('')
  console.log(
    pending.length === 0
      ? 'Nothing would publish even without the hold.'
      : `${pending.length} package(s) are ready and WOULD publish once the hold is lifted.`,
  )
} else {
  console.log(
    pending.length === 0
      ? 'Nothing to publish — the E2E gate is skipped.'
      : `${pending.length} package(s) to publish — the E2E suite gates them.`,
  )
}

// A plan built on lookups that failed is a plan about nothing. It still gates
// the E2E suite, which is the safe direction; what it cannot do is be read as
// a statement about what the registry holds — and `owedBump` below is computed
// from the same nulls, so it will report nothing owed however many changesets
// are waiting. Said out loud rather than left for the reader to notice.
const unreachable = pending.filter((pkg) => pkg.publishedState === UNREACHABLE)
if (unreachable.length > 0) {
  console.log('')
  console.log(
    `::warning::${unreachable.length} of ${packages.length} registry lookups did not answer ` +
      `(${[...new Set(unreachable.map((pkg) => pkg.lookupCode ?? 'no code'))].join(', ')}). ` +
      'This plan gates the E2E suite, which is the safe direction, but it says nothing about what ' +
      `${REGISTRY} holds — check NODE_AUTH_TOKEN has \`read:packages\`.`,
  )
}

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
    .map((file) => ({
      file,
      releases: parseChangeset(readFileSync(join(CHANGESET_DIR, file), 'utf8')),
    }))
}

const owed = owedBump({ willPublish: pending.length > 0, changesets: waitingChangesets() })

if (owed) {
  console.log('')
  console.log(formatOwedBump(owed))
  // A warning, not an error, and `lib/pending-release.mjs` says why at length:
  // failing here would take the Release run red, and the mirror's
  // `workflow_run` path fires only on a green one — so the gate would cause
  // the outage it is reporting.
  console.log(
    `::warning::A version bump is owed: ${owed.files} changeset(s) waiting and this push publishes ` +
      'nothing. Run `pnpm version-packages`, commit, and merge — until then no client site gets ' +
      'these fixes and the mirror will not sync.',
  )
}

const output = process.env.GITHUB_OUTPUT
if (output) {
  // `publishing` is the GATE's answer, not the arithmetic's: held means this
  // run publishes nothing, whatever the registry comparison found.
  appendFileSync(output, `publishing=${hold === null && pending.length > 0}\n`)
  appendFileSync(output, `held=${hold !== null}\n`)
  appendFileSync(output, `packages=${pending.map((pkg) => pkg.name).join(',')}\n`)
  // READ, since #427: `release.yml`'s `owed-bump` job opens an issue on it.
  //
  // Still not a gate, and the comment above this function says why — the
  // mirror's `workflow_run` path fires only on a green Release, so failing
  // here would stop the sync it is reporting on. What changed is that the
  // verdict now reaches somebody: the `::warning::` above and the step summary
  // below are visible only to whoever opens the run, and a push to `main` has
  // no pull request to annotate and no author to notify. Six changesets sat on
  // `main` for over an hour with the mirror blocked while this warning printed
  // on four consecutive green runs.
  //
  // Making it blocking is still a workflow change rather than a rewrite here —
  // the same escape hatch `check-pending-release.mjs` keeps in `--fail`.
  appendFileSync(output, `bump_owed=${owed !== null}\n`)
}

const summary = process.env.GITHUB_STEP_SUMMARY
if (summary && hold) {
  appendFileSync(
    summary,
    [
      '### Publication is held',
      '',
      hold.reason,
      '',
      `Delete \`${hold.file}\` and merge to publish. Until then this workflow verifies`,
      'everything and publishes nothing.',
      '',
      '',
    ].join('\n'),
  )
}
if (summary && !hold && pending.length > 0) appendFileSync(summary, `${formatSummary(pending)}\n\n`)
if (summary && owed) appendFileSync(summary, `${formatOwedBumpSummary(owed)}\n\n`)
