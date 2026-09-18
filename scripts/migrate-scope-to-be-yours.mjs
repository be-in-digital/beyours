#!/usr/bin/env node
/**
 * Rename the engine's npm scope and GitHub owner from `be-in-digital` to
 * `be-yours`, across every tracked text file.
 *
 * Two spellings of the OLD name live in this repository and only ONE moves:
 *
 *   `be-in-digital`  — hyphenated. The GitHub organisation slug and the npm
 *                      registry scope. This is what moves.
 *   `beindigital`    — glued. Identifiers registered with systems outside this
 *                      repository (AWS SES, Uber Eats, Unsplash, the app
 *                      stores) and persistence keys living in diners' browsers
 *                      and in deployed sites. These NEVER move from here;
 *                      renaming one breaks a live system or erases customer
 *                      data. See README.md § Naming.
 *
 * The separation is exact — every protected identifier uses the glued form —
 * so this script matches the hyphenated spelling only and the glued ones are
 * safe by construction rather than by a denylist.
 *
 * THE NEW NAME HAS THE SAME TRAP, and it cost this migration a full redo.
 * The organisation is `be-yours`, hyphenated. Unhyphenated `beyours` is a
 * different thing everywhere it appears and none of it is the owner: the two
 * repository names (`beyours`, `beyours-boilerplate`), the domain
 * `beyours.fr`, the `beyours` CLI, the Vercel projects, the
 * `beyours-admin-store` key, the `beyours-${SITE_SLUG}` bucket, and a Sentry
 * fixture that predates all of this. Writing `@beyours/*` produces a scope no
 * account owns, which GitHub Packages refuses to publish — and it type-checks
 * and tests green all the way there, because nothing in a workspace resolves
 * through the registry.
 *
 * Three hyphenated occurrences are still held back, because they name an
 * account somewhere else rather than this repository:
 *
 *   - `TURBO_TEAM: be-in-digital`  the Turborepo remote-cache team
 *   - `team be-in-digital`         the Vercel team
 *   - `be-in-digital.fr`           a domain, not an owner
 *
 * Renaming those in code without renaming the account they point at turns a
 * working cache or deployment into a silent miss, so they are listed in the
 * report instead and moved by hand once the accounts follow.
 *
 * CHANGELOG files are left alone: they record which version was published
 * under which scope, and that history stayed true through the previous scope
 * rename (`@beindigital-engine` -> `@be-in-digital`, changeset `1a5ca27`).
 *
 * Usage:
 *   node scripts/migrate-scope-to-be-yours.mjs [--check] [--quiet]
 *
 *   --check  report what would change and exit 1 if anything would; write
 *            nothing. This is the mode CI runs to prove the rename is complete.
 *   --quiet  print the summary only.
 */

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const FROM = "be-in-digital"
const TO = "be-yours"

/** Lines whose `be-in-digital` names an account outside this repository. */
const HELD_BACK = [
  { id: "turbo-team", test: (line) => line.includes("TURBO_TEAM") },
  { id: "vercel-team", test: (line) => /team\s+[`"']?be-in-digital/.test(line) },
]

/** `be-in-digital.fr` is a domain; the owner rename does not reach it. */
const DOMAIN_SUFFIX = /^\.fr/

const SKIP_BASENAMES = new Set(["CHANGELOG.md"])

/**
 * Files that name the old spelling on purpose, because they document the move.
 *
 * This is a narrow list rather than a pattern, and it is the one place where
 * `--check` can be told to look away — so keep it short. A file here is no
 * longer guarded: an accidental `@be-in-digital/` import inside it would pass.
 * That is acceptable for prose and for this script; it would not be for source.
 */
const DOCUMENTS_THE_RENAME = new Set([
  "CLAUDE.md",
  "README.md",
  "scripts/migrate-scope-to-be-yours.mjs",
  "tasks/beyours-org-migration.md",
  ".changeset/scope-moves-to-be-yours.md",
])

const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has("--check")
const QUIET = args.has("--quiet")

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim()

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  cwd: repoRoot,
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean)

/**
 * Rewrite one line, leaving held-back occurrences in place.
 *
 * @returns {{ line: string, changed: number, held: string[] }}
 */
function rewriteLine(line) {
  const heldHere = HELD_BACK.filter((rule) => rule.test(line)).map((r) => r.id)
  if (heldHere.length > 0) return { line, changed: 0, held: heldHere }

  let changed = 0
  const held = []
  let out = ""
  let cursor = 0

  for (;;) {
    const at = line.indexOf(FROM, cursor)
    if (at === -1) break
    const after = line.slice(at + FROM.length)
    out += line.slice(cursor, at)
    if (DOMAIN_SUFFIX.test(after)) {
      out += FROM
      held.push("domain")
    } else {
      out += TO
      changed += 1
    }
    cursor = at + FROM.length
  }

  out += line.slice(cursor)
  return { line: out, changed, held }
}

const report = { files: 0, replacements: 0, held: new Map(), skipped: [], documented: [] }

function noteHeld(id, file) {
  if (!report.held.has(id)) report.held.set(id, new Set())
  report.held.get(id).add(file)
}

for (const rel of tracked) {
  const abs = path.join(repoRoot, rel)
  let stat
  try {
    stat = fs.statSync(abs)
  } catch {
    continue // a deleted-but-tracked path
  }
  if (!stat.isFile()) continue

  const buf = fs.readFileSync(abs)
  if (buf.includes(0)) continue // binary
  const text = buf.toString("utf8")
  if (!text.includes(FROM)) continue

  if (SKIP_BASENAMES.has(path.basename(rel))) {
    report.skipped.push(rel)
    continue
  }

  if (DOCUMENTS_THE_RENAME.has(rel)) {
    report.documented.push(rel)
    continue
  }

  const lines = text.split("\n")
  let fileChanged = 0
  for (let i = 0; i < lines.length; i += 1) {
    const { line, changed, held } = rewriteLine(lines[i])
    lines[i] = line
    fileChanged += changed
    for (const id of held) noteHeld(id, rel)
  }

  if (fileChanged === 0) continue

  report.files += 1
  report.replacements += fileChanged
  if (!CHECK_ONLY) fs.writeFileSync(abs, lines.join("\n"))
  if (!QUIET) console.log(`${CHECK_ONLY ? "would rewrite" : "rewrote"} ${rel} (${fileChanged})`)
}

const verb = CHECK_ONLY ? "would change" : "changed"
console.log(
  `\n${FROM} -> ${TO}: ${verb} ${report.replacements} occurrence(s) in ${report.files} file(s).`,
)

if (report.skipped.length > 0) {
  console.log(
    `\nleft as published history (${report.skipped.length} changelog${report.skipped.length > 1 ? "s" : ""}):`,
  )
  for (const rel of report.skipped) console.log(`  ${rel}`)
}

if (report.documented.length > 0) {
  console.log("\nleft as prose that documents the move:")
  for (const rel of report.documented) console.log(`  ${rel}`)
}

if (report.held.size > 0) {
  console.log("\nheld back — rename the account first, then these by hand:")
  for (const [id, files] of report.held) {
    console.log(`  ${id}: ${[...files].join(", ")}`)
  }
}

if (CHECK_ONLY && report.replacements > 0) process.exit(1)
