#!/usr/bin/env node
/**
 * Fails when `CLAUDE.md` names a command that does not run or a document that
 * does not exist.
 *
 * WHY THIS EXISTS. `CLAUDE.md` is the first file every contributor and every
 * agent reads, so a false instruction there does not sit still — it propagates
 * into the work that follows it. On 1 Sep 2026 the file pointed at four
 * documents that had never existed in the repository's history
 * (`ARCHITECTURE.md`, `FEATURES.md`, `TESTING.md`, `DEPLOYMENT.md`) and four
 * commands that answered `ERR_PNPM_NO_SCRIPT` (`test:coverage`, `test:ui`,
 * `test:e2e:ui`, `test:e2e:debug`). Nothing noticed, because documentation is
 * the one artefact in this repository that nothing executes.
 *
 * HOW. Three passes over the file, all deliberately dumb:
 *
 *  1. Every `pnpm <script>` in a fenced block is resolved against the root
 *     `package.json`. A `pnpm --filter <pkg> <script>` form is resolved
 *     against that workspace instead, which is how the interactive runners are
 *     documented — a Vitest or Playwright UI is one server per project and
 *     cannot fan out across the monorepo.
 *  2. Every `` `X.md` `` referenced under "Additional Documentation" must be a
 *     file on disk.
 *  3. The "Key Features" figure must name a commit, that commit must be an
 *     ancestor of HEAD, its evidence ledger must exist, and the three places
 *     the figure is written must agree. See below.
 *
 * WHY PASS 3. The section was headed `29 shipping · 23 partial · 41 absent`
 * for six days after thirty-four commits had moved it, under the words "Quote
 * that, or quote nothing" — so the instruction was binding and the number was
 * false, which is worse than no number at all. It could rot silently because it
 * named no commit: there was nothing to check it against, and so nothing
 * checked it.
 *
 * A pin fixes what a pin can fix. An ancestry test proves the commit is real
 * and still in this history — it catches a figure copied from another branch,
 * a pin lost to a rebase, and a fabricated SHA. It CANNOT tell you the count is
 * still true, and no cheap test can: that needs the 93 rows re-walked. The pin
 * makes the claim falsifiable and dates it; the reader does the rest.
 *
 * The three-way agreement check is the cheap half that does bite. The figure is
 * written in the heading, in the prose under it and in the ledger's own
 * headline, and three copies of a number drift — that is the whole subject of
 * the file this script guards.
 *
 * WHAT IT CANNOT SEE. That a command does the thing the prose says it does,
 * and that a document's contents are true. It checks existence, ancestry and
 * agreement. The rest is still on the author — but those are what broke.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CLAUDE_MD = join(REPO, "CLAUDE.md")

const read = (file) => readFileSync(file, "utf8")
const scriptsOf = (pkgJson) => JSON.parse(read(pkgJson)).scripts ?? {}

const rootScripts = scriptsOf(join(REPO, "package.json"))
const source = read(CLAUDE_MD)
const lines = source.split("\n")

/** Map a workspace name (`@beyours/reference`) to its package.json. */
function workspaceManifest(name) {
  for (const dir of ["packages", "apps"]) {
    const base = join(REPO, dir)
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base)) {
      const manifest = join(base, entry, "package.json")
      if (!existsSync(manifest)) continue
      if (JSON.parse(read(manifest)).name === name) return manifest
    }
  }
  return null
}

const failures = []

// ─── 1. Commands ────────────────────────────────────────────────────────────
// Only inside fenced code blocks: prose says things like "run pnpm test before
// committing", and a sentence is not a command line.
let inFence = false
lines.forEach((line, i) => {
  if (line.trimStart().startsWith("```")) {
    inFence = !inFence
    return
  }
  if (!inFence) return

  const where = `CLAUDE.md:${i + 1}`
  // Strip a trailing `# comment` so it is not read as an argument.
  const command = line.split("#")[0].trim()

  const filtered = /^pnpm\s+--filter\s+(\S+)\s+([\w:-]+)/.exec(command)
  if (filtered) {
    const [, workspace, script] = filtered
    const manifest = workspaceManifest(workspace)
    if (!manifest) {
      failures.push(`${where}: no workspace named ${workspace}`)
    } else if (!(script in scriptsOf(manifest))) {
      failures.push(`${where}: ${workspace} defines no "${script}" script`)
    }
    return
  }

  const plain = /^pnpm\s+(?:run\s+)?([\w:-]+)(?:\s|$)/.exec(command)
  if (!plain) return
  const script = plain[1]
  // pnpm's own verbs are not package scripts.
  if (["install", "add", "remove", "exec", "dlx", "why", "list", "update"].includes(script)) return
  if (!(script in rootScripts)) {
    failures.push(`${where}: \`pnpm ${script}\` — no such script in the root package.json`)
  }
})

// ─── 2. Referenced documents ────────────────────────────────────────────────
const docsSection = source.split("## 📚 Additional Documentation")[1]
if (docsSection === undefined) {
  failures.push("CLAUDE.md: the 'Additional Documentation' section is gone")
} else {
  const offset = source.split("## 📚 Additional Documentation")[0].split("\n").length
  for (const [j, line] of docsSection.split("\n").entries()) {
    for (const m of line.matchAll(/`([\w./-]+\.md)`/g)) {
      const doc = m[1]
      if (!existsSync(join(REPO, doc))) {
        failures.push(`CLAUDE.md:${offset + j}: \`${doc}\` is referenced but does not exist`)
      }
    }
  }
}

// ─── 3. The Key Features figure, and the commit it was measured at ──────────
//
// Three things have to line up, and each catches a different way the figure has
// already gone wrong here:
//
//   the pin      — a commit, still an ancestor of HEAD
//   the ledger   — the per-row evidence the count is derived from, on disk
//   the numbers  — the same three, in the heading, the prose and the ledger

/** `## 🎯 Key Features — 70 shipping · 6 partial · 17 absent, at `cdc6c81`` */
const HEADING =
  /^##\s.*?Key Features\s+—\s+(\d+)\s+shipping\s+·\s+(\d+)\s+partial\s+·\s+(\d+)\s+absent,\s+at\s+`([0-9a-f]{7,40})`\s*$/m
/** "against the tree at `cdc6c81`" — the prose must name the same commit. */
const PROSE_PIN = /against the tree at `([0-9a-f]{7,40})`/
/** "**70 ship, 6 are partial, and 17 are absent**" */
const PROSE_FIGURE = /\*\*(\d+)\s+ship,\s+(\d+)\s+are\s+partial,\s+and\s+(\d+)\s+are\s+absent\*\*/
/** The ledger this section cites as its evidence. */
const LEDGER_REF = /`(tasks\/[\w.-]+\.md)`/
/** "**70 ship · 6 partial · 17 absent**", the ledger's own headline. */
const LEDGER_FIGURE = /\*\*(\d+)\s+ship\s+·\s+(\d+)\s+partial\s+·\s+(\d+)\s+absent\*\*/

const heading = HEADING.exec(source)
if (!heading) {
  failures.push(
    "CLAUDE.md: the Key Features heading no longer carries a measured figure and " +
      "the commit it was measured at.\n" +
      "      Expected: ## 🎯 Key Features — N shipping · N partial · N absent, at `<sha>`\n" +
      "      A figure with no commit attached is not a measurement — that is how the " +
      "last one rotted for six days."
  )
} else {
  const [, headShips, headPartial, headAbsent, pin] = heading
  const figure = (s, p, a) => `${s} shipping · ${p} partial · ${a} absent`

  // The section body: from the heading to the next `## `. Matched with its
  // newlines flattened, because markdown wraps prose and a pin can land on the
  // line after the words introducing it.
  const from = source.indexOf(heading[0])
  const next = source.indexOf("\n## ", from + heading[0].length)
  const section = source.slice(from, next === -1 ? source.length : next).replace(/\s+/g, " ")

  // ── the pin ───────────────────────────────────────────────────────────────
  const prosePin = PROSE_PIN.exec(section)
  if (!prosePin) {
    failures.push(
      "CLAUDE.md: the Key Features prose does not say which tree the figure was " +
        'measured against (expected "against the tree at `<sha>`").'
    )
  } else if (!pin.startsWith(prosePin[1]) && !prosePin[1].startsWith(pin)) {
    failures.push(
      `CLAUDE.md: the heading is pinned to \`${pin}\` and the prose to ` +
        `\`${prosePin[1]}\`. One measurement, one commit.`
    )
  }

  const git = (...args) =>
    execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

  let inRepo = true
  try {
    git("rev-parse", "--git-dir")
  } catch {
    inRepo = false
  }

  if (!inRepo) {
    // A published tarball is not a clone. Say so and move on rather than
    // failing a check the tree cannot answer.
    console.warn(
      `CLAUDE.md: not a git repository, so the \`${pin}\` pin was not verified.`
    )
  } else {
    let known = true
    try {
      git("rev-parse", "--verify", "--quiet", `${pin}^{commit}`)
    } catch {
      known = false
    }

    if (!known) {
      const shallow = (() => {
        try {
          return git("rev-parse", "--is-shallow-repository").trim() === "true"
        } catch {
          return false
        }
      })()
      failures.push(
        shallow
          ? `CLAUDE.md: \`${pin}\` is not in this clone, which is shallow — CI checks ` +
              "out with fetch-depth: 0 for exactly this. Deepen the clone before trusting " +
              "this result."
          : `CLAUDE.md: \`${pin}\` is not a commit in this repository. The Key Features ` +
              "figure names a tree that does not exist here — it was copied from somewhere " +
              "else, or invented."
      )
    } else {
      let ancestor = true
      try {
        git("merge-base", "--is-ancestor", pin, "HEAD")
      } catch {
        ancestor = false
      }
      if (!ancestor) {
        failures.push(
          `CLAUDE.md: \`${pin}\` is a real commit but is NOT an ancestor of HEAD, so ` +
            "the Key Features figure was measured against a tree this branch never had.\n" +
            "      Re-measure against HEAD, redo the ledger, and move the pin. Do not " +
            "move the pin on its own — that only relabels a stale count."
        )
      }
    }
  }

  // ── the ledger ────────────────────────────────────────────────────────────
  const ledgerRef = LEDGER_REF.exec(section)
  if (!ledgerRef) {
    failures.push(
      "CLAUDE.md: the Key Features section cites no `tasks/*.md` ledger. The figure " +
        "has to be checkable row by row, or it is back to being believed."
    )
  } else if (!existsSync(join(REPO, ledgerRef[1]))) {
    failures.push(
      `CLAUDE.md: the Key Features figure cites \`${ledgerRef[1]}\` as its evidence ` +
        "and that file does not exist."
    )
  } else {
    // ── the numbers ─────────────────────────────────────────────────────────
    const ledgerFigure = LEDGER_FIGURE.exec(
      read(join(REPO, ledgerRef[1])).replace(/\s+/g, " ")
    )
    if (!ledgerFigure) {
      failures.push(
        `${ledgerRef[1]}: no headline figure found (expected ` +
          "**N ship · N partial · N absent**), so it cannot be checked against CLAUDE.md."
      )
    } else if (
      ledgerFigure[1] !== headShips ||
      ledgerFigure[2] !== headPartial ||
      ledgerFigure[3] !== headAbsent
    ) {
      failures.push(
        `CLAUDE.md heading says ${figure(headShips, headPartial, headAbsent)}; ` +
          `${ledgerRef[1]} says ` +
          `${figure(ledgerFigure[1], ledgerFigure[2], ledgerFigure[3])}. ` +
          "The ledger is the measurement — fix whichever is wrong, not just the copy " +
          "you happen to be reading."
      )
    }
  }

  const proseFigure = PROSE_FIGURE.exec(section)
  if (!proseFigure) {
    failures.push(
      "CLAUDE.md: the Key Features prose no longer restates the figure (expected " +
        "**N ship, N are partial, and N are absent**)."
    )
  } else if (
    proseFigure[1] !== headShips ||
    proseFigure[2] !== headPartial ||
    proseFigure[3] !== headAbsent
  ) {
    failures.push(
      `CLAUDE.md: the heading says ${figure(headShips, headPartial, headAbsent)} and ` +
        `the prose under it says ` +
        `${figure(proseFigure[1], proseFigure[2], proseFigure[3])}.`
    )
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error("CLAUDE.md promises things this repository does not have:\n")
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error(
    "\nEither make the command or the document exist, or stop naming it.\n" +
      "CLAUDE.md is read first; a false line there propagates into the work.\n"
  )
  process.exit(1)
}

console.log(
  "CLAUDE.md: every command runs, every referenced document exists, and the " +
    "Key Features figure is pinned to a commit still in this history."
)
