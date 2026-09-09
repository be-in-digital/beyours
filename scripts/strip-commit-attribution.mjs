#!/usr/bin/env node
/**
 * The working half of `.githooks/commit-msg`: removes AI attribution from a
 * commit message before git records it.
 *
 * It strips rather than refuses, deliberately. The lines this removes are not
 * typed by a person who could be asked to stop — they are appended by an agent
 * harness that was told to append them, so refusing the commit only produces a
 * second attempt with the same trailer. Removing them ends the loop, and the
 * removal is announced on stderr so nobody discovers it later from a diff.
 *
 * It refuses in two cases, both of which are somebody's prose rather than a
 * harness's footer: a message that is nothing but attribution, and attribution
 * sitting inside a sentence — a session link cited mid-body, where deleting the
 * line would take the sentence with it. Editing a paragraph to enforce a
 * formatting rule is worse than the rule; the author is told which line and
 * decides what it should say.
 *
 * `scripts/check-commit-attribution.mjs` is the layer that refuses everything.
 * This one is the convenience; that one is the guarantee.
 *
 * Usage: node scripts/strip-commit-attribution.mjs <path-to-message-file>
 *        (git passes that path to the commit-msg hook as $1)
 */

import fs from "node:fs"

import {
  runSelfTest,
  splitAtScissors,
  splitLines,
  stripAttribution,
} from "./lib/commit-attribution.mjs"

/**
 * The exit code `.githooks/commit-msg` maps to a blocked commit. It is not 1,
 * because 1 is also what node exits with when this file throws — and a broken
 * stripper must not block every commit in the repository, including the one
 * that repairs it. Any other non-zero status makes the hook fail open and warn.
 */
const REFUSE = 9

const file = process.argv[2]
if (!file) {
  console.error("commit-msg: no message file given; nothing to check.")
  process.exit(0)
}

let original
try {
  original = fs.readFileSync(file, "utf8")
} catch (error) {
  console.error(`commit-msg: cannot read ${file} (${error.message}); leaving the message alone.`)
  process.exit(0)
}

// A broken detector must not block every commit in the repository — the person
// hitting it may be the one repairing it. It is reported here and REFUSED in
// CI, where `scripts/check-commit-attribution.mjs` exits 1 on the same failure.
const broken = runSelfTest()
if (broken.length) {
  console.error(`commit-msg: the attribution detector is failing ${broken.length} of its own cases:`)
  for (const failure of broken) console.error(`  ${failure}`)
  console.error("commit-msg: continuing anyway — the Lint job will refuse this.")
}

const { message, removed, blocked } = stripAttribution(original)

// Reported before anything is written, so a message that needs a human decision
// comes back exactly as it was left.
if (blocked.length) {
  console.error(`\ncommit-msg: ${blocked.length} line(s) name an AI assistant inside a sentence:\n`)
  for (const hit of blocked) console.error(`  line ${hit.line}: ${hit.text}`)
  console.error(`\n  Removing the line would take the sentence with it, so this is yours to`)
  console.error(`  reword — CLAUDE.md rule 10 allows no reference to the assistant in`)
  console.error(`  anything that reaches Git.\n`)
  process.exit(REFUSE)
}

if (removed.length === 0) process.exit(0)

/** Whether anything git would keep survived the strip. */
const hasContent = (text) =>
  splitLines(splitAtScissors(text).head).some(
    (line) => line.trim().length > 0 && !line.trimStart().startsWith("#")
  )

if (!hasContent(message)) {
  console.error(`\ncommit-msg: this message is nothing but AI attribution, which is not allowed`)
  console.error(`  in anything that reaches Git (CLAUDE.md rule 10). Write a subject line`)
  console.error(`  describing the change and commit again.\n`)
  process.exit(REFUSE)
}

try {
  fs.writeFileSync(file, message)
} catch (error) {
  console.error(`commit-msg: cannot rewrite ${file} (${error.message}); the message is unchanged.`)
  console.error(`  The Lint job will refuse this commit — see CLAUDE.md rule 10.`)
  process.exit(REFUSE)
}

console.error(`commit-msg: removed ${removed.length} attribution line(s) — CLAUDE.md rule 10.`)
for (const line of removed) console.error(`  ${line.text}`)
