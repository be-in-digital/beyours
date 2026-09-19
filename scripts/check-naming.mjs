#!/usr/bin/env node
/**
 * Hold README.md § Naming to what it says, on every pull request.
 *
 * Usage:
 *   node scripts/check-naming.mjs          # exit 1 on any violation
 *
 * It reads the tracked tree, so it costs a `git ls-files` and a read per text
 * file, and it runs in the required `Lint` job beside the other check:* guards.
 * The rules, and why each one exists, are in scripts/lib/naming.mjs.
 */

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { checkNaming, FROZEN, NEVER, SCOPES } from "./lib/naming.mjs"

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  cwd: repoRoot,
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean)

const files = []
const manifests = []
for (const rel of tracked) {
  let buf
  try {
    buf = fs.readFileSync(path.join(repoRoot, rel))
  } catch {
    continue // a deleted-but-tracked path, or a directory
  }
  if (buf.includes(0)) continue // binary
  const text = buf.toString("utf8")
  files.push({ rel, text })

  if (path.basename(rel) === "package.json" && !rel.includes("node_modules")) {
    try {
      const name = JSON.parse(text).name
      if (typeof name === "string") manifests.push({ rel, name })
    } catch {
      // a manifest that does not parse is `pnpm install`'s problem, not this guard's
    }
  }
}

const { missing, forbidden, miscoped } = checkNaming(files, manifests)

for (const m of missing) {
  console.error(`frozen identifier has disappeared from the tree: ${m.id}`)
  console.error(`    ${m.why}`)
  console.error("    README.md § Naming lists it under \"Never run a global find-and-replace\".")
  console.error("    If it was removed on purpose, remove it from FROZEN in scripts/lib/naming.mjs too.\n")
}

for (const f of forbidden) {
  console.error(`${f.rel}:${f.line}  ${f.text.slice(0, 110)}`)
  console.error(`    ${f.why}\n`)
}

for (const m of miscoped) {
  console.error(`${m.rel}  is named ${m.name}, expected the ${m.expected}* scope`)
  console.error(`    ${m.why}\n`)
}

const total = missing.length + forbidden.length + miscoped.length
if (total > 0) {
  console.error(`${total} naming violation(s). Nothing was changed — these are decisions, not typos.`)
  process.exit(1)
}

console.log(
  `Naming check passed: ${FROZEN.length} frozen identifiers still present, ` +
    `${NEVER.length} never-correct spelling absent, ` +
    `${manifests.filter((m) => m.name.startsWith("@")).length} scoped manifests on the right side of the ` +
    `${SCOPES.length}-scope split.`,
)
