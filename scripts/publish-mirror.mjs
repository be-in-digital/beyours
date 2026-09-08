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
 *   6. `pnpm.overrides` are honoured on the mirror and, for the same reason,
 *      read from the root here. `apps/themes` carried one entry and the root
 *      carries 22, so a client's lockfile resolved without nineteen security
 *      floors this repository enforces on itself. → merged in, root winning
 *      (`lib/mirror-overrides.mjs`).
 *
 * None of those six is theoretical: the first sync, done by hand on
 * 2026-08-16, missed the first four and left the mirror uninstallable for
 * twenty minutes. The fifth stopped the mirror dead for the twelve days after
 * that — see `mirrorPackageManager`. The sixth broke nothing at all, which is
 * why it took until #289 to see it: the mirror installed, the site built, and
 * only the resolved versions differed.
 *
 * Versions come from the REGISTRY, not from packages/*\/package.json: only the
 * registry says what a client can actually install. A package whose changeset
 * has not been published yet would otherwise resolve to nothing.
 *
 * What crosses and what does not is `lib/mirror-tree.mjs`, shared with
 * `check-mirror-css.mjs` so the tree CI builds is the tree this pushes.
 *
 * Three gates stand between the rewrite and the push, in widening order:
 * `lib/engine-exports.mjs` asks whether each engine subpath the tree imports
 * resolves in the published tarball and whether its file ships; then
 * `lib/mirror-overrides.mjs` reads the security floors back out of the lockfile
 * pnpm actually wrote; then `lib/mirror-typecheck.mjs` installs the pinned
 * versions in a sandbox and COMPILES the tree against them. The last one exists
 * because the first two reason about packaging and a symbol added inside a
 * module without a version bump leaves the packaging perfect — #408 shipped
 * exactly that, and the boilerplate has been red on `TS2339` ever since.
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
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  describeUnresolvable,
  engineImportsIn,
  EXPORTS_UNKNOWN,
  tarballContents,
  unresolvableImports,
} from "./lib/engine-exports.mjs"
import {
  describeMissing,
  divergentBuildAllowList,
  mergeOverrides,
  missingFromLockfile,
  parseLockfileOverrides,
} from "./lib/mirror-overrides.mjs"
import { materializeMirror } from "./lib/mirror-tree.mjs"
import {
  assertTypecheckScript,
  checkPinnedTree,
  describePinnedTreeFailure,
} from "./lib/mirror-typecheck.mjs"
// The same lookup `publish-plan.mjs` gates the release on. One copy, so the
// mirror cannot pin a version the gate never asked about.
import { publishedVersion, REGISTRY } from "./lib/registry.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SOURCE = join(ROOT, "apps/themes")
const MIRROR_REPO = "be-in-digital/beyours-boilerplate"
const MIRROR_PKG_NAME = "beyours-boilerplate"

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

/**
 * What the version a client would actually install carries: its `exports` map
 * and its file list, both read from the published TARBALL.
 *
 * Not from `npm view`: GitHub Packages omits `exports` from the abbreviated
 * packument that command reads, so the lookup answered empty for every engine
 * package, the emptiness was taken for "declares no exports → legacy → any
 * path allowed", and the gate flagged nothing while `admin@8.0.0` shipped
 * without the `./game` the template imports (#380). The tarball is what a
 * client installs and the registry cannot abbreviate it, so `npm pack` it and
 * read the archive inside.
 *
 * Both halves come from the one read, and are passed on together, because a
 * subpath fails in two ways: absent from the map, or present and pointing at a
 * file the archive never carried. Reading the map without the file list would
 * answer the first question and silently drop the second.
 *
 * Three answers, kept distinct on purpose:
 *   - a map (or string) — checked subpath by subpath, target by target;
 *   - `undefined` — the manifest genuinely declares no `exports`, which Node
 *     resolves legacily: any path allowed, nothing to verify;
 *   - `EXPORTS_UNKNOWN` — the tarball could not be fetched or read. That is a
 *     question with no answer, not an answer: `unresolvableImports` flags it
 *     and the sync refuses to run, because conflating "could not read the map"
 *     with "has no map" is exactly the defect this replaces. `files` is left
 *     undefined with it: nothing was read, so nothing is known to be missing.
 *
 * Each tarball is unpacked under `work`, so it is swept by the one `finally`
 * at the bottom along with the clone — the same reason nothing here calls
 * `process.exit`. It is therefore only callable once `work` exists, which is
 * to say from inside that try.
 */
function publishedTarball(pkg, version) {
  const dir = mkdtempSync(join(work, "pack-"))
  try {
    run("npm", ["pack", `${pkg}@${version}`, `--registry=${REGISTRY}`, "--pack-destination", dir])
    const tarball = readdirSync(dir).find((name) => name.endsWith(".tgz"))
    if (!tarball) throw new Error(`npm pack wrote no tarball for ${pkg}@${version}`)
    return tarballContents(join(dir, tarball))
  } catch {
    return { exports: EXPORTS_UNKNOWN, files: undefined }
  } finally {
    rmSync(dir, { recursive: true, force: true })
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

/**
 * The security floors the monorepo enforces on itself, carried to the mirror.
 *
 * pnpm reads `pnpm.overrides` from the WORKSPACE ROOT only. Here that is
 * `/package.json` and its 22 entries reach `apps/themes` like everything else;
 * on the mirror the copied `apps/themes/package.json` IS the root, and it
 * carried one. `pnpm install --lockfile-only` below then resolved every client
 * site's lockfile without the other 21 (#289).
 *
 * Rules and what is deliberately left behind: `lib/mirror-overrides.mjs`.
 * Whether pnpm actually took them is checked after the install, against the
 * lockfile it wrote — the gap is silent otherwise, which is the whole reason it
 * survived this long.
 *
 * @returns the merged block, so the caller can verify the lockfile against it.
 */
function mirrorOverrides(pkg, rootManifest) {
  const { overrides, carried, overruled } = mergeOverrides(rootManifest, pkg)

  const divergent = divergentBuildAllowList(rootManifest, pkg)
  if (divergent.rootOnly.length > 0 || divergent.templateOnly.length > 0) {
    // Not merged automatically: this list is what may run install scripts on a
    // client's machine, and widening it is a decision, not a sync. Failing is
    // how the decision gets made instead of skipped.
    fail(
      "pnpm.onlyBuiltDependencies differs between the monorepo root and " +
        "apps/themes, so a client's install would run a different set of build " +
        "scripts from this workspace's.\n" +
        `  only at the root:      ${divergent.rootOnly.join(", ") || "—"}\n` +
        `  only in apps/themes:   ${divergent.templateOnly.join(", ") || "—"}\n` +
        "Reconcile the two lists — it grants the right to execute code, so it is " +
        "carried by hand rather than by this script."
    )
  }

  pkg.pnpm = { ...pkg.pnpm, overrides }

  log(`   ${Object.keys(overrides).length} override(s), ${carried.length} carried from the root`)
  for (const entry of overruled) {
    log(
      `   ! ${entry.key}: apps/themes says ${entry.template}, the root says ${entry.root} — ` +
        "the root wins here as it already does in the workspace; the template's line is dead"
    )
  }

  return overrides
}

function mirrorPackageJson(sourcePkgPath, versions) {
  const pkg = JSON.parse(readFileSync(sourcePkgPath, "utf8"))
  const rootManifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))

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
  const overrides = mirrorOverrides(pkg, rootManifest)

  return { contents: JSON.stringify(pkg, null, 2) + "\n", overrides }
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

  log("→ checking the pinned versions can resolve what the tree imports")
  // CI builds `apps/themes` against `packages/*` at HEAD through the workspace
  // link; a client installs the tarballs pinned above. A subpath added to a
  // package's `exports` without a version bump exists in the first and not in
  // the second, so all four required checks stay green while the published
  // template cannot build. The tarball answers the second question too — does
  // the file each subpath points at actually ship — because a declaration the
  // build never emitted breaks the same client one step further along. See
  // `lib/engine-exports.mjs` for the measurement.
  const published = {}
  for (const [pkg, range] of Object.entries(versions)) {
    const version = range.replace(/^\^/, "")
    published[pkg] = { version, ...publishedTarball(pkg, version) }
  }
  const unresolvable = unresolvableImports(engineImportsIn(SOURCE), published)
  if (unresolvable.length > 0) fail(describeUnresolvable(unresolvable))
  log(`   ${Object.keys(published).length} package(s) verified`)

  log("→ copying contents")
  // What is shipped, and what the mirror keeps, is decided in
  // `lib/mirror-tree.mjs` — the same module `check-mirror-css.mjs` builds from,
  // so the tree this pushes is the tree CI proved.
  const { copied, deleted } = materializeMirror(SOURCE, clone)
  log(`   ${copied.length} file(s) shipped, ${deleted.length} removed`)

  log("→ rewriting package.json")
  const { contents, overrides } = mirrorPackageJson(join(SOURCE, "package.json"), versions)
  writeFileSync(join(clone, "package.json"), contents)

  log("→ prepending the \"generated repository\" banner to the README")
  const readme = join(clone, "README.md")
  if (existsSync(readme)) {
    writeFileSync(readme, MIRROR_README_BANNER + readFileSync(readme, "utf8"))
  }

  log("→ updating the lockfile")
  run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], { cwd: clone, stdio: "inherit" })

  // The one comparison nothing was making. A lockfile resolved against the
  // wrong override set installs, builds and looks identical — so the floors
  // have to be read back out of what pnpm actually wrote, not assumed from
  // what was written into the manifest a moment ago.
  log("→ checking the lockfile took the overrides")
  const lockfile = join(clone, "pnpm-lock.yaml")
  if (!existsSync(lockfile)) {
    fail("pnpm wrote no lockfile — a client repository cannot install without one.")
  }
  const written = parseLockfileOverrides(readFileSync(lockfile, "utf8"))
  const missing = missingFromLockfile(overrides, written)
  if (missing.length > 0) fail(describeMissing(missing))
  log(`   ${Object.keys(overrides).length} override(s) present in pnpm-lock.yaml`)

  // The gate the two above cannot be: a compiler, reading the published
  // modules rather than reasoning about their packaging.
  //
  // `unresolvableImports` asks whether each subpath resolves and whether its
  // target ships. Both are questions about the module. A symbol added inside a
  // module without a version bump answers yes to both and still breaks every
  // client — which is #408: `convex-functions@5.0.0` ships
  // `src/emailCampaigns.ts` and exports `./emailCampaigns`, the tree reads
  // `defs.markFailed` off it, the gate above reported "9 package(s)
  // verified", and the boilerplate has been red ever since. See
  // `lib/mirror-typecheck.mjs`.
  //
  // In a SANDBOX, not in the clone. The clone is what gets committed and
  // pushed to the repository every client site merges from, and an install
  // leaves `node_modules` and build state in it; that they are gitignored
  // today is not a property worth betting a client's repository on. The
  // sandbox is the same tree by construction — the same `materializeMirror`
  // call over the same source, the same rewritten package.json string, and the
  // lockfile the clone just generated.
  //
  // Before the "already up to date" exit below rather than after it, because
  // the question is not only "is what we are about to push sound" but "is what
  // a client is running right now sound". A sync with nothing to publish, over
  // a delivered template that cannot compile, is exactly the state #408
  // describes and exactly the state that reported success throughout.
  //
  // WHAT REFUSING COSTS, stated plainly because it is easy to discover the hard
  // way: this gate does not block only the change that outran the release. It
  // blocks EVERY change while the published engine is behind — an unrelated
  // storefront hotfix included. That is deliberate. A hotfix delivered on top
  // of a template a client cannot compile is not delivered; it is queued behind
  // a release, and the release is the fix. `pnpm check:pending-release` names
  // the changesets waiting, and the refusal message points at it. Where that
  // trade is genuinely wrong for an incident, the answer is to cut the release,
  // never to skip this.
  log("→ compiling the tree against the versions it pins")
  const badScript = assertTypecheckScript(JSON.parse(contents).scripts)
  if (badScript) fail(badScript)
  const sandbox = join(work, "typecheck")
  materializeMirror(SOURCE, sandbox, { prune: false })
  writeFileSync(join(sandbox, "package.json"), contents)
  copyFileSync(lockfile, join(sandbox, "pnpm-lock.yaml"))
  const compiled = checkPinnedTree(sandbox)
  if (!compiled.ok) fail(describePinnedTreeFailure(compiled))
  log("   installs from the registry and typechecks")

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
