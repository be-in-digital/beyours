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
 *   3. `vercel.json` carries a `turbo-ignore`: there is no turbo workspace on
 *      the client side. → dropped.
 *   4. The package name is `@beyours/themes`, scoped to the monorepo.
 *      → `beyours-boilerplate`.
 *
 * None of those four is theoretical: the first sync, done by hand on
 * 2026-08-16, missed all of them and left the mirror uninstallable for twenty
 * minutes.
 *
 * Versions come from the REGISTRY, not from packages/*\/package.json: only the
 * registry says what a client can actually install. A package whose changeset
 * has not been published yet would otherwise resolve to nothing.
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

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SOURCE = join(ROOT, "apps/themes")
const MIRROR_REPO = "be-in-digital/beyours-boilerplate"
const MIRROR_PKG_NAME = "beyours-boilerplate"
const REGISTRY = "https://npm.pkg.github.com"

/** Never sent to the mirror: only meaningful inside the monorepo. */
const NOT_SHIPPED = ["vercel.json", ".turbo", "tsconfig.tsbuildinfo"]

/** Never overwritten on the mirror: belongs to it, or is regenerated. */
const MIRROR_OWNED = [".git", "node_modules", ".next", "pnpm-lock.yaml", "next-env.d.ts"]

/**
 * The mirror is rebuilt in full on every run (rsync --delete): a commit made
 * directly on it disappears at the next sync. The banner says so where someone
 * will actually read it — at the top of the README.
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
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
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

function mirrorPackageJson(sourcePkgPath, versions) {
  const pkg = JSON.parse(readFileSync(sourcePkgPath, "utf8"))
  pkg.name = MIRROR_PKG_NAME
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
// 3. Lockfile
// ---------------------------------------------------------------------------

/** Long enough for a cold install, short enough that a hang is not a workday. */
const LOCKFILE_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Write the mirror's lockfile with the pnpm the mirror asks for.
 *
 * The clone's `package.json` carries a `packageManager` field, copied from
 * `apps/themes`, and pnpm honours it by switching itself to that version. When
 * that switch cannot be completed pnpm does not fail — it prints
 * `Failed to switch pnpm to vX` and then **hangs**, holding the job until the
 * runner's own limit. The mirror went twelve days without a sync that way, and
 * the workflow had no timeout to notice.
 *
 * The workflow now installs exactly the version named here, so no switch is
 * attempted. This ceiling exists for the day that stops being true: a mismatch
 * should fail in ten minutes with a message naming the two versions, not hang.
 */
function updateLockfile(clone) {
  const declared =
    JSON.parse(readFileSync(join(clone, "package.json"), "utf8")).packageManager ?? "(none)"

  try {
    run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], {
      cwd: clone,
      stdio: "inherit",
      timeout: LOCKFILE_TIMEOUT_MS,
    })
  } catch (error) {
    const timedOut = error?.code === "ETIMEDOUT" || error?.signal === "SIGTERM"
    if (!timedOut) throw error

    const running = (() => {
      try {
        return run("pnpm", ["--version"])
      } catch {
        return "unknown"
      }
    })()

    fail(
      `pnpm install did not finish within ${LOCKFILE_TIMEOUT_MS / 60_000} minutes.\n` +
        `  the mirror declares: ${declared}\n` +
        `  this job is running: pnpm@${running}\n` +
        `  When these differ, pnpm tries to switch itself and hangs if it cannot. ` +
        `The workflow reads the version from apps/themes/package.json — check that step.`,
    )
  }
}

// ---------------------------------------------------------------------------
// 4. Sync
// ---------------------------------------------------------------------------

if (!existsSync(SOURCE)) fail(`source not found: ${SOURCE}`)

const pushToken = process.env.MIRROR_PUSH_TOKEN
if (!check && !pushToken) {
  fail("MIRROR_PUSH_TOKEN is missing — cannot push. Re-run with --check for a dry run.")
}

const work = mkdtempSync(join(tmpdir(), "beyours-mirror-"))
const clone = join(work, "mirror")

try {
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
  const excludes = [...NOT_SHIPPED, ...MIRROR_OWNED].flatMap((e) => ["--exclude", e])
  run("rsync", ["-a", "--delete", ...excludes, `${SOURCE}/`, `${clone}/`])

  log("→ rewriting package.json")
  writeFileSync(join(clone, "package.json"), mirrorPackageJson(join(SOURCE, "package.json"), versions))

  log("→ prepending the \"generated repository\" banner to the README")
  const readme = join(clone, "README.md")
  if (existsSync(readme)) {
    writeFileSync(readme, MIRROR_README_BANNER + readFileSync(readme, "utf8"))
  }

  log("→ updating the lockfile")
  updateLockfile(clone)

  const status = run("git", ["status", "--porcelain"], { cwd: clone })
  if (!status) {
    log("✓ the mirror is already up to date")
    process.exit(0)
  }

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
} finally {
  rmSync(work, { recursive: true, force: true })
}
