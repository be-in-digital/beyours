#!/usr/bin/env node
/**
 * Publishes `apps/themes` to the distribution mirror
 * `be-in-digital/beyours-boilerplate`, the repository client sites are cloned
 * from.
 *
 * Why a mirror. A client cannot clone a subdirectory of a monorepo: git clones
 * whole repositories. The mirror is the shippable cut — the same code, but
 * consumable on its own.
 *
 * What the crossing must fix, on pain of breaking `beyours create`:
 *
 *   1. Engine dependencies are `workspace:^` here. Outside a workspace, pnpm
 *      cannot resolve them. → versions published to the registry.
 *   2. The monorepo has a single lockfile, at its root. A client repository
 *      needs its own, otherwise `--frozen-lockfile` fails in CI. → generated.
 *   3. The root `vercel.json` carries a `turbo-ignore`: there is no turbo
 *      workspace on the client side. → dropped (`lib/mirror-tree.mjs`).
 *   4. The package name is `@beyours/themes`, scoped to the monorepo.
 *      → `beyours-boilerplate`.
 *   5. `packageManager` is honoured on the mirror and ignored here — inside a
 *      workspace only the root's counts. It must therefore name the pnpm this
 *      job actually has. → taken from the monorepo root.
 *
 * None of those five is theoretical: the first sync, done by hand on
 * 2026-08-16, missed the first four and left the mirror uninstallable for
 * twenty minutes. The fifth stopped the mirror dead for the twelve days after
 * that — see `mirrorPackageManager`.
 *
 * Versions come from the REGISTRY, not from packages/*\/package.json: only the
 * registry says what a client can actually install. A package whose changeset
 * has not been published yet would otherwise resolve to nothing.
 *
 * What crosses and what does not is `lib/mirror-tree.mjs`, shared with
 * `check-mirror-css.mjs` so the tree CI builds is the tree this pushes.
 *
 * The mirror's history is preserved — a plain commit on top, never a
 * force-push. Every client site has a `template` remote pointing at it and
 * merges from it: rewriting history would break `pnpm update:template`
 * everywhere.
 *
 * Usage:
 *   node scripts/publish-mirror.mjs --check   # dry run, exit 1 on drift
 *   node scripts/publish-mirror.mjs           # sync and push
 *
 * Auth: NODE_AUTH_TOKEN (registry read) and, to push, MIRROR_PUSH_TOKEN — a
 * `contents: write` PAT on beyours-boilerplate.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { materializeMirror } from "./lib/mirror-tree.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SOURCE = join(ROOT, "apps/themes")
const MIRROR_REPO = "be-in-digital/beyours-boilerplate"
const MIRROR_PKG_NAME = "beyours-boilerplate"
const REGISTRY = "https://npm.pkg.github.com"

/**
 * The mirror is rebuilt in full on every run — anything the source no longer
 * has is deleted — so a commit made directly on it disappears at the next sync.
 * The banner says so where someone will actually read it: at the top of the
 * README.
 */
const MIRROR_README_BANNER = `<!-- Generated automatically — do not edit here. -->

> ⚠️ **Generated repository.** Its contents are produced from \`apps/themes\` in
> the [beyours](https://github.com/${MIRROR_REPO.split("/")[0]}/beyours)
> monorepo and replaced in full on every sync. **A commit made directly here
> will be lost** — changes belong in the monorepo.
>
> This repository exists because a client site cannot clone a subdirectory of a
> monorepo: it is the shippable cut, with the engine packages at published
> versions and a lockfile of its own.

`

const check = process.argv.includes("--check")

// `stdio: "inherit"` makes execFileSync return null — hence the ?? "".
const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) ?? "").trim()

const log = (msg) => console.log(msg)

/**
 * Reported, then unwound — never `process.exit`.
 *
 * `process.exit` does not run pending `finally` blocks, so every run that
 * ended inside the `try` below left its clone of the mirror in the temp
 * directory: the whole tree, on every sync and every `--check`.
 */
class Stop extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}
const fail = (msg) => {
  throw new Stop(msg, 1)
}
const done = (msg) => {
  throw new Stop(msg, 0)
}

// ---------------------------------------------------------------------------
// 1. Published versions
// ---------------------------------------------------------------------------

function publishedVersion(pkg) {
  try {
    return run("npm", ["view", pkg, "version", `--registry=${REGISTRY}`])
  } catch {
    return null
  }
}

function resolveVersions(deps) {
  const engineDeps = Object.keys(deps).filter((k) => k.startsWith("@be-in-digital/"))
  const resolved = {}
  for (const pkg of engineDeps) {
    const v = publishedVersion(pkg)
    if (!v) fail(`${pkg} not found on ${REGISTRY}. Is NODE_AUTH_TOKEN set, and the package published?`)
    resolved[pkg] = `^${v}`
  }
  return resolved
}

// ---------------------------------------------------------------------------
// 2. package.json transformation
// ---------------------------------------------------------------------------

/**
 * Which pnpm the mirror should declare.
 *
 * Inside this workspace `apps/themes/package.json`'s `packageManager` is inert:
 * pnpm reads the root's. On the mirror — a standalone repository — it is the
 * one that counts, and pnpm will try to SWITCH to it.
 *
 * That is what broke the sync. `apps/themes` carried `pnpm@10.28.1`, inherited
 * from the subtree it was imported as and never noticed, while every workflow
 * installs the root's `10.4.1`. Told to switch, pnpm failed with
 * `spawnSync ... ENOENT` and then hung instead of exiting; the job was killed
 * as `cancelled`, which is neither a pass nor a failure, so nothing raised a
 * hand. The mirror last moved on 2026-08-16 and no one was told.
 *
 * Reading the root keeps the two in lockstep whatever version CI installs.
 */
function mirrorPackageManager() {
  const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
  const declared = root.packageManager

  if (!declared) {
    fail(
      "the monorepo root declares no packageManager — the mirror needs one, " +
        "otherwise pnpm picks its own and the lockfile stops being reproducible."
    )
  }
  return declared
}

function mirrorPackageJson(sourcePkgPath, versions) {
  const pkg = JSON.parse(readFileSync(sourcePkgPath, "utf8"))
  pkg.name = MIRROR_PKG_NAME
  pkg.packageManager = mirrorPackageManager()
  for (const [dep, range] of Object.entries(versions)) {
    pkg.dependencies[dep] = range
  }
  const stillWorkspace = Object.entries(pkg.dependencies)
    .filter(([, v]) => String(v).startsWith("workspace:"))
    .map(([k]) => k)
  if (stillWorkspace.length) {
    fail(`dependencies still on workspace:  ${stillWorkspace.join(", ")}`)
  }
  return JSON.stringify(pkg, null, 2) + "\n"
}

// ---------------------------------------------------------------------------
// 3. Sync
// ---------------------------------------------------------------------------

const pushToken = process.env.MIRROR_PUSH_TOKEN
const work = mkdtempSync(join(tmpdir(), "beyours-mirror-"))
const clone = join(work, "mirror")

// Every guard from here down runs inside the try, so that reporting one still
// takes the temp directory with it.
try {
  if (!existsSync(SOURCE)) fail(`source not found: ${SOURCE}`)
  if (!check && !pushToken) {
    fail("MIRROR_PUSH_TOKEN is missing — cannot push. Re-run with --check for a dry run.")
  }

  const remote = pushToken
    ? `https://x-access-token:${pushToken}@github.com/${MIRROR_REPO}.git`
    : `https://github.com/${MIRROR_REPO}.git`

  log(`→ cloning ${MIRROR_REPO}`)
  run("git", ["clone", "--depth", "1", remote, clone])

  log("→ resolving published versions")
  const sourcePkg = JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf8"))
  const versions = resolveVersions(sourcePkg.dependencies)
  for (const [pkg, range] of Object.entries(versions)) log(`   ${pkg} → ${range}`)

  log("→ copying contents")
  // What is shipped, and what the mirror keeps, is decided in
  // `lib/mirror-tree.mjs` — the same module `check-mirror-css.mjs` builds from,
  // so the tree this pushes is the tree CI proved.
  const { copied, deleted } = materializeMirror(SOURCE, clone)
  log(`   ${copied.length} file(s) shipped, ${deleted.length} removed`)

  log("→ rewriting package.json")
  writeFileSync(join(clone, "package.json"), mirrorPackageJson(join(SOURCE, "package.json"), versions))

  log("→ prepending the \"generated repository\" banner to the README")
  const readme = join(clone, "README.md")
  if (existsSync(readme)) {
    writeFileSync(readme, MIRROR_README_BANNER + readFileSync(readme, "utf8"))
  }

  log("→ updating the lockfile")
  run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], { cwd: clone, stdio: "inherit" })

  const status = run("git", ["status", "--porcelain"], { cwd: clone })
  if (!status) done("✓ the mirror is already up to date")

  const changed = status.split("\n").length
  log(`→ ${changed} file(s) to publish`)

  if (check) {
    log(run("git", ["status", "--short"], { cwd: clone }))
    fail("drift detected between apps/themes and the mirror (--check mode)")
  }

  const sha = run("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT })
  const subject = run("git", ["log", "-1", "--format=%s"], { cwd: ROOT })

  run("git", ["config", "user.name", "beyours-bot"], { cwd: clone })
  run("git", ["config", "user.email", "bot@beyours.fr"], { cwd: clone })
  run("git", ["add", "-A"], { cwd: clone })
  run("git", ["commit", "-m", `chore: sync from apps/themes (${sha})\n\n${subject}`], { cwd: clone })
  run("git", ["push", "origin", "HEAD:main"], { cwd: clone })

  log(`✓ mirror published — ${MIRROR_REPO}`)
} catch (error) {
  if (!(error instanceof Stop)) throw error
  if (error.code === 0) log(error.message)
  else console.error(`✗ ${error.message}`)
  process.exitCode = error.code
} finally {
  rmSync(work, { recursive: true, force: true })
}
