#!/usr/bin/env node
/**
 * Points `core.hooksPath` at the tracked `.githooks/` directory. Runs as the
 * root `prepare` script, so `pnpm install` installs the hooks.
 *
 * It replaces `"prepare": "husky"`, which was not doing this job. husky writes
 * its wrappers into `.husky/_` and gitignores them from inside
 * (`.husky/_/.gitignore` is `*`), so the directory `core.hooksPath` names is
 * absent from every checkout that has not run an install — including every
 * linked worktree, which shares the config but not the ignored directory. Git
 * does not warn when a hooks path resolves to nothing. It runs no hook and
 * exits 0.
 *
 * Measured on this repository on 09/09/2026, after a clean `pnpm install`:
 *
 *     git config --get core.hooksPath          -> .husky/_
 *     git check-ignore -v .husky/_/pre-commit  -> .husky/_/.gitignore:1:*
 *
 * and in a scratch repository with that same configuration, a commit made from
 * a linked worktree ran no hook and exited 0. No hook file had ever been
 * tracked here in any case — `git log -- .husky` is empty — so husky had been
 * running on every install for months with nothing to run. #409 is the bill.
 *
 * Two details carry the fix:
 *
 *   1. `.githooks/` is tracked, so `git worktree add` checks it out like any
 *      other file and the path cannot resolve to nothing.
 *   2. The configured value stays RELATIVE. `core.hooksPath` lives in the
 *      shared `.git/config` and git resolves a relative one against whichever
 *      working tree the commit is made from; an absolute path would pin every
 *      worktree to the checkout that happened to run the install.
 *
 * `pnpm install` is not a guarantee that anyone runs, which is why the same
 * assertion lives in the required `Lint` job as `pnpm check:attribution`.
 */

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Relative on purpose — see the header. */
const HOOKS_DIR = ".githooks"

/**
 * One hook, and only one. `lint-staged` is configured in the root manifest and
 * has never had a hook to run it either — wiring a `pre-commit` would change
 * how everyone commits, which is a decision for the team and not a side effect
 * of #409.
 */
const HOOKS = ["commit-msg"]

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

// `prepare` also runs where there is no repository at all — a tarball install,
// a Docker build that copied the sources without `.git`. Nothing to do, and
// nothing worth failing an install over.
if (git(["rev-parse", "--git-dir"]) === null) {
  console.log("git hooks: not a git checkout, skipping.")
  process.exit(0)
}

// The check that would have caught the `.husky/_` failure at the moment it was
// configured, rather than 17 commits later.
const missing = HOOKS.filter((hook) => !fs.existsSync(path.join(ROOT, HOOKS_DIR, hook)))
if (missing.length) {
  console.warn(
    `git hooks: ${HOOKS_DIR}/${missing.join(", ")} missing from this checkout — hooks NOT installed.`
  )
  console.warn(`  Commits will not be checked locally; the Lint job still refuses attributed ones.`)
  process.exit(0)
}

// Git needs the executable bit, and only says "hook was ignored because it's
// not set as executable" on some versions. The bit is tracked (mode 100755), so
// this only matters on a filesystem or a umask that dropped it.
for (const hook of HOOKS) {
  const file = path.join(ROOT, HOOKS_DIR, hook)
  try {
    fs.accessSync(file, fs.constants.X_OK)
  } catch {
    try {
      fs.chmodSync(file, 0o755)
    } catch (error) {
      console.warn(`git hooks: ${HOOKS_DIR}/${hook} is not executable (${error.message}).`)
    }
  }
}

const current = git(["config", "--get", "core.hooksPath"])
if (current === HOOKS_DIR) process.exit(0)

if (git(["config", "core.hooksPath", HOOKS_DIR]) === null) {
  console.warn(`git hooks: could not set core.hooksPath to ${HOOKS_DIR}.`)
  process.exit(0)
}

if (current === null) {
  console.log(`git hooks: core.hooksPath -> ${HOOKS_DIR} (${HOOKS.join(", ")}).`)
} else {
  console.log(`git hooks: core.hooksPath ${current} -> ${HOOKS_DIR} (${HOOKS.join(", ")}).`)
  if (current.startsWith(".husky")) {
    console.log(`  ${current} is gitignored by husky, so it was absent from every fresh worktree.`)
  }
}
