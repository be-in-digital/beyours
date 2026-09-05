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
 * HOW. Two passes over the file, both deliberately dumb:
 *
 *  1. Every `pnpm <script>` in a fenced block is resolved against the root
 *     `package.json`. A `pnpm --filter <pkg> <script>` form is resolved
 *     against that workspace instead, which is how the interactive runners are
 *     documented — a Vitest or Playwright UI is one server per project and
 *     cannot fan out across the monorepo.
 *  2. Every `` `X.md` `` referenced under "Additional Documentation" must be a
 *     file on disk.
 *
 * WHAT IT CANNOT SEE. That a command does the thing the prose says it does,
 * and that a document's contents are true. It checks existence. The rest is
 * still on the author — but existence is what broke, twice.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

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

console.log("CLAUDE.md: every command runs and every referenced document exists.")
