#!/usr/bin/env node
/**
 * Refuses a commit range that carries AI attribution.
 *
 * The second of two layers, and the one that cannot be bypassed. The first is
 * `.githooks/commit-msg`, which strips the trailers as they are written — but a
 * hook is a local convenience: `--no-verify` skips it, a fresh clone that has
 * never run `pnpm install` has no `core.hooksPath` at all, and #409 records the
 * sharper failure, where the hook path was configured and pointed at
 * `.husky/_`, a directory husky itself gitignores. Measured on this repository
 * on 09/09/2026: `core.hooksPath = .husky/_`, and
 * `git check-ignore .husky/_/pre-commit` answers `.husky/_/.gitignore:1:*`. A
 * hooks path that resolves to nothing does not warn — every commit simply
 * succeeds, which is how 17 of 24 commits reached protected history.
 *
 * So this runs in `Lint`, which branch protection already requires by name, and
 * which is the only job in `ci.yml` with `fetch-depth: 0` — the same trick
 * `check:accents` and `check:divergence` use to become blocking without anyone
 * touching repository settings.
 *
 * What it reads, and what it deliberately does not, both measured on 09/09/2026:
 *
 *   - The MESSAGE of every commit the branch adds. That is the path the 17
 *     commits took: this repository squash-merges (all 24 subjects end in
 *     `(#NNN)`), and GitHub composed each squash message from the branch
 *     COMMIT message, not from the pull request body — `038eb9db` opens with
 *     the commit's first paragraph while #418's description opens with
 *     "Closes #412". So a branch commit checked here is the thing that lands.
 *   - Not the author or committer identity. `e0621c3c` on #418's branch is
 *     authored by `Claude <noreply@anthropic.com>`, and every one of the 24
 *     commits on `main` is authored by a person and committed by
 *     `GitHub <noreply@github.com>`: squash-merge drops branch authorship, so
 *     refusing it would fail pull requests over commits that never land.
 *   - Not the pull request title or body. They carry the footer today and do
 *     not become the commit message — while the repository squashes from
 *     commit messages. If that setting is ever changed to "pull request title
 *     and description", this check goes blind at pull-request time and the
 *     `push` run on `main` becomes the one that catches it, after the fact.
 *
 * Usage:  node scripts/check-commit-attribution.mjs [--range <A>..<B>]
 *         (also: pnpm check:attribution)
 *
 * With no `--range` it reads the GitHub Actions event payload for what to
 * subtract — the commits this branch ADDS, not everything since some base — and
 * falls back to `origin/main` for a local run.
 */

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  exclusionsFromEvent,
  findAttribution,
  rangeMustHaveCommits,
  runSelfTest,
} from "./lib/commit-attribution.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const inActions = Boolean(process.env.GITHUB_ACTIONS)

/** Same shape as `check-source-drift.mjs`: null on failure, never a throw. */
const git = (args) => {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

const annotate = (message) => {
  if (inActions) console.error(`::error::${message}`)
}

/* ── Check 0: the guard has to still work ───────────────────────────────── */

/**
 * This is the only thing standing between an attributed commit and protected
 * history, and the rules it applies are four regular expressions that a careless
 * edit can turn into a match-nothing. So it proves them on every run, in the job
 * that is about to trust it — including the two cases that must stay legal, a
 * commit naming `CLAUDE.md` and a human co-author. A guard with false positives
 * is deleted, not fixed.
 */
const broken = runSelfTest()
if (broken.length) {
  annotate(`The attribution guard itself is broken — ${broken.length} self-test failure(s).`)
  console.error(`\n✗ The attribution guard itself is broken — ${broken.length} self-test failure(s).\n`)
  for (const failure of broken) console.error(`    ${failure}`)
  console.error(`\n  ATTRIBUTION_RULES in scripts/lib/commit-attribution.mjs no longer detects`)
  console.error(`  what it was written for.\n`)
  process.exit(1)
}

/* ── Which commits ──────────────────────────────────────────────────────── */

function parseArgs(argv) {
  let range
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.indexOf("=")
    const name = eq === -1 ? arg : arg.slice(0, eq)
    if (name !== "--range") {
      console.error(`::error::Unknown argument "${arg}".`)
      process.exit(2)
    }
    const value = eq === -1 ? argv[++i] : arg.slice(eq + 1)
    if (!value || value.startsWith("--")) {
      console.error(`::error::--range needs a value, like --range main..HEAD.`)
      process.exit(2)
    }
    range = value
  }
  return { range }
}

/** The Actions event payload, or null off a runner. */
function readEventPayload() {
  const file = process.env.GITHUB_EVENT_PATH
  if (!file || !fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

const exists = (rev) => git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]) !== null

/** Refs stay readable, 40-character shas do not. */
const short = (rev) => (/^[0-9a-f]{40}$/i.test(rev) ? rev.slice(0, 8) : rev)

/** What to hand `git rebase -i`: the first thing the scope excluded. */
const rebaseOnto = () => {
  const not = args.indexOf("--not")
  return not === -1 ? short(args[0].split("..")[0] ?? "main") : short(args[not + 1])
}

/**
 * What to examine, and where that came from — printed either way, because a
 * range check that does not say what it examined cannot be audited.
 *
 * The shape is `HEAD ^exclusion ^exclusion`: the commits this branch ADDS. See
 * `exclusionsFromEvent` for why it is not a two-dot range — `main` carries
 * attributed commits that #409 rules out of rewriting, and merging `main` into
 * a branch must not make them this pull request's problem.
 */
function resolveScope(argvRange) {
  const eventName = process.env.GITHUB_EVENT_NAME ?? ""
  const mustHaveCommits = rangeMustHaveCommits(eventName)

  if (argvRange) {
    return { args: [argvRange], label: argvRange, source: "--range", mustHaveCommits }
  }

  const fromEvent = exclusionsFromEvent(eventName, readEventPayload())
  if (fromEvent) {
    const usable = fromEvent.refs.filter(exists)
    if (usable.length) {
      return {
        args: ["HEAD", "--not", ...usable],
        label: `HEAD ${usable.map((ref) => `^${short(ref)}`).join(" ")}`,
        source: fromEvent.source,
        mustHaveCommits,
      }
    }
    // Reachable when the checkout is shallower than the base, which is a
    // misconfiguration rather than a clean result: say so, then fall through to
    // something we can actually see.
    console.error(
      `  Note: ${fromEvent.source} named ${fromEvent.refs.map(short).join(", ")}, which this checkout does not contain.`
    )
  }

  // A push carries its own new commits, so subtracting the branch it was pushed
  // to would subtract the push. Everything else is measured against the base
  // branch as it stands.
  const fallbacks = eventName === "push" ? ["HEAD~1"] : ["origin/main", "main"]
  for (const ref of fallbacks) {
    if (!exists(ref)) continue
    return {
      args: ["HEAD", "--not", ref],
      label: `HEAD ^${ref}`,
      source: `fallback: ${ref}`,
      mustHaveCommits,
    }
  }

  return { args: null, label: null, source: "nothing to compare against", mustHaveCommits }
}

/** Every commit the scope selects, as { sha, message }. Empty is a valid answer. */
function commitsIn(logArgs) {
  // \x1f between the fields and \x1e between records: a commit message can hold
  // any newline arrangement it likes, and splitting on one would truncate the
  // very trailers this check is looking for.
  const raw = git(["log", "--format=%H%x1f%B%x1e", ...logArgs])
  if (raw === null) return null
  return raw
    .split("\x1e")
    .map((record) => record.replace(/^\n/, ""))
    .filter((record) => record.trim().length > 0)
    .map((record) => {
      const [sha, message = ""] = record.split("\x1f")
      return { sha, message }
    })
}

const { range: argvRange } = parseArgs(process.argv.slice(2))
const { args, label, source, mustHaveCommits } = resolveScope(argvRange)

if (!args) {
  annotate("The attribution check could not work out which commits to examine.")
  console.error(`\n✗ The attribution check could not work out which commits to examine.\n`)
  console.error(`  No usable base: the event carried none and neither origin/main nor main exists here.`)
  console.error(`  Pass one explicitly:  pnpm check:attribution --range <base>..HEAD\n`)
  process.exit(1)
}

const commits = commitsIn(args)
if (commits === null) {
  annotate(`The attribution check could not read ${label}.`)
  console.error(`\n✗ git log ${label} failed — it does not resolve in this checkout.\n`)
  process.exit(1)
}

if (commits.length === 0 && mustHaveCommits) {
  annotate(`The attribution check examined 0 commits in ${label}, which cannot be right on this event.`)
  console.error(`\n✗ The attribution check examined 0 commits in ${label}.\n`)
  console.error(`  A pull request and a merge-queue batch always carry at least one commit, so an`)
  console.error(`  empty range means the base was wrong — and a check that examined nothing must`)
  console.error(`  not report a pass. Range came from: ${source}.\n`)
  process.exit(1)
}

/* ── The verdict ────────────────────────────────────────────────────────── */

const offenders = []
for (const commit of commits) {
  const hits = findAttribution(commit.message)
  if (hits.length) offenders.push({ ...commit, hits })
}

if (offenders.length) {
  const lines = offenders.reduce((n, commit) => n + commit.hits.length, 0)
  annotate(
    `${offenders.length} commit(s) in this range carry AI attribution (${lines} line(s)). ` +
      `CLAUDE.md rule 10 forbids it in anything that reaches Git.`
  )
  console.error(`\n✗ ${offenders.length} commit(s) in ${label} carry AI attribution.\n`)
  for (const commit of offenders) {
    const subject = commit.message.split("\n")[0]
    console.error(`    ${commit.sha.slice(0, 8)}  ${subject}`)
    for (const hit of commit.hits) {
      console.error(`      line ${hit.line}: ${hit.why}`)
      console.error(`        ${hit.text}`)
    }
  }
  console.error(`\n  CLAUDE.md rule 10 forbids this in anything that reaches Git, and #409 records`)
  console.error(`  what it costs: 17 of 24 commits on protected history, permanently.\n`)
  console.error(`  Reword them — the history is still yours to change while it is on a branch:`)
  console.error(`      git commit --amend        (the tip)`)
  console.error(`      git rebase -i ${rebaseOnto()}   (anything older)\n`)
  console.error(`  Then stop it happening again: \`pnpm install\` installs .githooks/commit-msg,`)
  console.error(`  which removes these lines as they are written.\n`)
  process.exit(1)
}

console.log(
  `Commit attribution check passed: ${commits.length} commit(s) in ${label} (${source}) carry none.`
)
