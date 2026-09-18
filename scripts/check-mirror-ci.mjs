#!/usr/bin/env node
/**
 * Does `be-yours/beyours-boilerplate` pass its own CI?
 *
 * Usage:
 *   node scripts/check-mirror-ci.mjs            (also: pnpm check:mirror-ci)
 *
 * Environment:
 *   MIRROR_READ_TOKEN   a fine-grained PAT with `actions: read` — and, for the
 *                       sibling staleness job, `contents: read` — on the mirror
 *   MIRROR_REPO         override the repository, for pointing this at a branch
 *                       whose last run is known red while testing it
 *
 * WHY IT IS NOT ANOTHER `mirror-health` QUESTION. That workflow asks whether
 * the last sync FINISHED and whether the mirror is CURRENT. Measured on
 * 15 September 2026: the boilerplate's CI had failed four runs in a row while
 * `Publish mirror` succeeded here. The observer job fires only on a non-success
 * conclusion of our run, so it was skipped; the staleness job found the mirror
 * current, because it was — current and red. The one combination neither job
 * can see is the one every client repository is cloned from.
 *
 * EXIT CODES. 0 when the mirror's latest run on its default branch succeeded,
 * or when we could not tell; 1 when it did not. "Could not tell" exits 0 and
 * says so loudly on stdout — the caller turns that into a stated skip rather
 * than a daily issue no re-run can clear. The three-way decision itself lives
 * in `lib/mirror-ci.mjs` and is tested without a token.
 */

import { classifyMirrorCi, failedJobNames } from "./lib/mirror-ci.mjs"

const REPO = process.env.MIRROR_REPO ?? "be-yours/beyours-boilerplate"
const TOKEN = process.env.MIRROR_READ_TOKEN ?? ""

for (const arg of process.argv.slice(2)) {
  console.error(`::error::Unknown argument "${arg}".`)
  process.exit(2)
}

/** `null` on any failure to ask, which `classifyMirrorCi` reads as unknown. */
async function api(path) {
  if (TOKEN === "") return null
  try {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    })
    if (!response.ok) {
      console.log(`GitHub answered ${response.status} for ${path}`)
      return null
    }
    return await response.json()
  } catch (error) {
    console.log(`the call to ${path} failed: ${String(error)}`)
    return null
  }
}

const repo = await api(`/repos/${REPO}`)
// The mirror's default branch is read rather than assumed: a template
// repository that renames its trunk would otherwise be reported as having no
// runs, which reads as "we could not tell" for ever.
const branch = repo?.default_branch ?? "main"

const verdict = classifyMirrorCi(
  await api(`/repos/${REPO}/actions/runs?branch=${branch}&per_page=1`)
)

if (verdict.state === "green") {
  console.log(`${REPO}@${branch}: its latest run succeeded.`)
  process.exit(0)
}

if (verdict.state === "unknown") {
  // Deliberately exit 0. This is the branch that fires when the token is unset,
  // when it lacks `actions: read`, or when a sync is mid-flight — none of which
  // is news about the template, and all of which a daily issue would bury.
  console.log(`UNKNOWN: ${verdict.reason}`)
  console.log(
    TOKEN === ""
      ? "MIRROR_READ_TOKEN is unset, so the mirror's runs cannot be read."
      : "The token may lack `actions: read` on the mirror."
  )
  process.exit(0)
}

const run = verdict.run ?? {}
const failed = failedJobNames(
  await api(`/repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`)
)

console.log(`RED: ${REPO}@${branch} last ran "${run.name}" and it did not pass.`)
console.log(`conclusion: ${run.conclusion}`)
console.log(`commit: ${String(run.head_sha ?? "").slice(0, 8)}`)
console.log(`run: ${run.html_url}`)
if (failed.length > 0) console.log(`failed jobs: ${failed.join(", ")}`)
process.exit(1)
