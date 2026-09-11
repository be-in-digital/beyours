#!/usr/bin/env node
/**
 * Assistant attribution in a pull request's own title and body.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT `check-commit-attribution.mjs` (#434).
 *
 * That check reads COMMITS, and its docblock explains at length why it does not
 * read the pull request: *"They carry the footer today and do not become the
 * commit message — while the repository squashes from commit messages."*
 *
 * The second half of that sentence is measurably wrong for this repository, and
 * the consequence is on protected history. `main` squashes with GitHub's
 * "default to pull request title, commit details" setting, so the squash
 * commit is assembled from BOTH:
 *
 *     $ git log -1 --format='%s' f0b3d9b3
 *     Give a Resend deployment a feedback path (#463)      <- the PR TITLE
 *     $ git log -1 --format='%b' f0b3d9b3
 *     * fix(email): give a Resend deployment a feedback path   <- the commits
 *
 * So the pull request **title** lands on `main` verbatim and nothing has ever
 * read it. A title is where a tool's name goes most naturally — it is the field
 * an author writes last and edits in a web form, away from the hook that cleans
 * a commit message — and `.githooks/commit-msg` cannot reach it.
 *
 * The BODY is a different case and is checked for a different reason. It does
 * not reach the commit here (the body comes from the commits), so this is not
 * about Git history: `CLAUDE.md`'s rule covers "pull request titles,
 * descriptions" as things written in this repository, and #434 measured 22 of
 * the last 25 bodies violating it — including the pull request that made the
 * rule executable. A rule nothing checks is a rule nothing follows.
 *
 * THE MATCHERS ARE THE SAME ONES, imported rather than re-stated. A second copy
 * would drift, and the half that drifts is whichever nobody exercises — which
 * is exactly how the title came to be unread. `ATTRIBUTION_RULES` already
 * carries the collisions that make it usable here: this product HAS an
 * AI-generated blog, and Claude is an ordinary French given name.
 *
 * Usage:  node scripts/check-pr-attribution.mjs            (reads the event)
 *         node scripts/check-pr-attribution.mjs --title "…" --body "…"
 *         (also: pnpm check:pr-attribution)
 *
 * Off a pull_request event with no explicit text it exits 0 and says so: there
 * is nothing to read, and a check that invented a failure there would be a
 * check nobody could run locally.
 */
import { readFileSync } from "node:fs"

import { findAttribution, runSelfTest } from "./lib/commit-attribution.mjs"

/* ── The guard guards itself first ───────────────────────────────────────── */

// Same opening as its sibling, and the same reason: a matcher that has stopped
// matching is a green check over an unexamined field, which is worse than no
// check at all because it is believed.
const broken = runSelfTest()
if (broken.length > 0) {
  console.error(`::error::The attribution guard itself is broken — ${broken.length} self-test failure(s).`)
  for (const failure of broken) console.error(`    ${failure}`)
  process.exit(1)
}

/* ── What to read ────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.indexOf("=")
    const name = eq === -1 ? arg : arg.slice(0, eq)
    if (name !== "--title" && name !== "--body") {
      console.error(`::error::Unknown argument "${arg}". Expected --title or --body.`)
      process.exit(2)
    }
    out[name.slice(2)] = eq === -1 ? (argv[++i] ?? "") : arg.slice(eq + 1)
  }
  return out
}

/** The Actions event payload, or null off a runner. */
function readEventPayload() {
  const file = process.env.GITHUB_EVENT_PATH
  if (!file) return null
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

const argv = parseArgs(process.argv.slice(2))
const payload = readEventPayload()
const pr = payload?.pull_request ?? null

const title = argv.title ?? pr?.title ?? null
const body = argv.body ?? pr?.body ?? null

if (title === null && body === null) {
  console.log(
    "Pull-request attribution check: nothing to read — no --title/--body and no " +
      "pull_request in the event payload. Nothing was examined."
  )
  process.exit(0)
}

/* ── The verdict ─────────────────────────────────────────────────────────── */

/**
 * The two fields are reported separately because they land differently.
 *
 * A title is on `main` for ever once the squash happens; a body is a document
 * in this repository that a person reads. Telling an author only that "the pull
 * request" carries attribution leaves them hunting for which field, and the two
 * are edited in different boxes.
 */
const FIELDS = [
  {
    name: "title",
    text: title,
    lands:
      "The title becomes the SUBJECT of the squash commit on `main`, where it " +
      "cannot be rewritten.",
  },
  {
    name: "body",
    text: body,
    lands:
      "The body does not reach the commit here, but CLAUDE.md's rule covers " +
      "pull request descriptions as prose written in this repository.",
  },
]

let failed = false

for (const field of FIELDS) {
  if (typeof field.text !== "string" || field.text.length === 0) continue
  const found = findAttribution(field.text)
  if (found.length === 0) continue

  failed = true
  console.error(
    `::error::The pull request ${field.name} carries ${found.length} attribution line(s). ` +
      field.lands
  )
  console.error(`\n✗ Pull request ${field.name} — ${found.length} attribution line(s):\n`)
  for (const hit of found) {
    console.error(`    line ${hit.line}: ${hit.why}`)
    console.error(`      ${hit.text}`)
  }
  console.error("")
}

if (failed) {
  console.error("  CLAUDE.md rule 10: nothing that reaches Git or GitHub carries an")
  console.error("  assistant attribution. Edit the pull request and re-run this check.\n")
  process.exit(1)
}

const examined = FIELDS.filter((field) => typeof field.text === "string" && field.text.length > 0)
console.log(
  `Pull-request attribution check passed: ${examined.map((f) => f.name).join(" and ")} ` +
    `carry none.`
)
