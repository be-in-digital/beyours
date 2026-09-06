#!/usr/bin/env node
/**
 * Compiles the shippable cut of `apps/themes` against the engine packages as
 * TARBALLS — the artefact a client actually installs — and fails if it does
 * not typecheck.
 *
 * WHY THIS EXISTS. Nothing else in this repository ever compiles the published
 * shape. CI builds `apps/themes` through the pnpm workspace link, against
 * `packages/*` at HEAD. A client installs what the registry holds. The two are
 * routinely different code, and the difference is invisible here:
 * `check-mirror-css.mjs` does materialise the client tree, but it assembles
 * `node_modules` by SYMLINKING `packages/<name>`, so it never sees a pinned
 * version either — it is measuring the stylesheet, not the resolution.
 *
 * The cost of that gap, measured: `be-in-digital/beyours-boilerplate` ran 71
 * failures to 1 success over its last 100 CI runs, failing Typecheck with
 * `Cannot find module '@be-in-digital/admin/game'`, while every required check
 * in THIS repository was green (#321). The subpath had been added to
 * `packages/admin` without a version bump, so it existed at HEAD and not in
 * the published `admin@8.0.0`. Every site created from the boilerplate for
 * nine days was dead on arrival, and `pnpm update:template` carried the same
 * breakage into existing client sites. It was the third occurrence of the
 * class (#209, #283 are earlier ones).
 *
 * `publish-mirror.mjs`'s gate now refuses a sync whose pinned versions cannot
 * resolve what the tree imports, which stops the mirror SHIPPING it. This is
 * the other half: it tells you the same thing before the release, by building
 * the thing rather than reasoning about its `exports` map. A subpath that
 * resolves but whose file was never shipped fails here and passes there.
 *
 * HOW. `pnpm pack` every engine package — NOT `npm pack`: only pnpm rewrites
 * `workspace:*`/`workspace:^` to a concrete version, and `pnpm publish` is what
 * `changeset publish` invokes for this workspace, so an npm-packed tarball
 * would carry a protocol no client can resolve and would be testing a shape
 * nobody ever receives. `lib/mirror-tree.mjs` — the module the publisher
 * itself copies with — materialises the shippable tree. Every engine
 * dependency is then pinned to its tarball, transitive ones included via
 * `pnpm.overrides`, and `tsc --noEmit` runs over the result.
 *
 * Packages are built first, because three of them (`core`, `restaurant`,
 * `cms`) publish `dist` and a tarball packed before the build would be empty
 * of it. Turbo caches that, so it is nearly free on a repeat run.
 *
 * WHAT IT CANNOT SEE. Anything registry-side: a botched publish, a missing
 * tarball, an auth failure. It proves the CODE is consistent, not that the
 * upload happened — so it is a pre-flight, not a replacement for cloning
 * `beyours-boilerplate` and building it after a release. It also stops at
 * `tsc`: `next build` needs an application env and `convex deploy` needs a
 * live backend, neither of which belongs in a check.
 *
 * Deliberately NOT wired into CI: it builds and installs the whole engine, and
 * paying that on every run is a decision about CI time rather than about
 * correctness. Run it before cutting a release, and after publishing one.
 *
 * Usage:  node scripts/check-mirror-build.mjs   (also: pnpm check:mirror-build)
 *         --keep   leave the temporary tree in place for inspection
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { materializeMirror } from "./lib/mirror-tree.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SOURCE = join(ROOT, "apps/themes")
const PACKAGES = join(ROOT, "packages")
const MIRROR_PKG_NAME = "beyours-boilerplate"

const keep = process.argv.includes("--keep")

const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) ?? "").trim()

const log = (msg) => console.log(msg)

const work = mkdtempSync(join(tmpdir(), "beyours-mirror-build-"))
const packs = join(work, "packs")
const tree = join(work, "clone")

try {
  mkdirSync(packs, { recursive: true })
  mkdirSync(tree, { recursive: true })

  // `dist` has to exist before anything is packed: `pnpm pack` copies what
  // `files` names, it does not build it.
  log("→ building the engine packages")
  run("pnpm", ["build", "--filter=./packages/*"], { cwd: ROOT })

  log("→ packing them as the registry would receive them")
  const tarballs = {}
  for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = entry.name
    const manifest = join(PACKAGES, dir, "package.json")
    // A directory under `packages/` that is not a package — a scratch clone, a
    // half-removed one — is skipped rather than crashing the run.
    if (!existsSync(manifest)) continue
    const { name, version } = JSON.parse(readFileSync(manifest, "utf8"))
    run("pnpm", ["pack", "--pack-destination", packs], { cwd: join(PACKAGES, dir) })
    // npm's naming, derived rather than matched by substring — several of
    // these package names contain one another.
    const file = `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`
    if (!readdirSync(packs).includes(file)) {
      throw new Error(`pnpm pack did not write ${file} for ${name}`)
    }
    tarballs[name] = join(packs, file)
    log(`   ${name.padEnd(34)} ${version}`)
  }

  log("→ materialising the mirror tree")
  const { copied } = materializeMirror(SOURCE, tree)
  log(`   ${copied.length} file(s)`)

  log("→ pinning every engine dependency to its tarball")
  const pkg = JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf8"))
  pkg.name = MIRROR_PKG_NAME
  pkg.packageManager = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).packageManager
  for (const dep of Object.keys(pkg.dependencies)) {
    if (!dep.startsWith("@be-in-digital/")) continue
    if (!tarballs[dep]) throw new Error(`${dep} is a dependency but no package in packages/ provides it`)
    pkg.dependencies[dep] = `file:${tarballs[dep]}`
  }
  // A packed tarball names its own engine dependencies by VERSION, which pnpm
  // would go to the registry for. Override them to the same local tarballs, so
  // the whole engine graph is this working tree's code and the check does not
  // silently measure whatever is published today.
  pkg.pnpm = { ...(pkg.pnpm ?? {}) }
  pkg.pnpm.overrides = { ...(pkg.pnpm.overrides ?? {}) }
  for (const [name, tgz] of Object.entries(tarballs)) pkg.pnpm.overrides[name] = `file:${tgz}`
  writeFileSync(join(tree, "package.json"), JSON.stringify(pkg, null, 2) + "\n")
  // The shipped `.npmrc` points the scope at GitHub Packages. Nothing here is
  // fetched from it, and leaving it in place only invites a 401 in a
  // credential-less checkout.
  writeFileSync(join(tree, ".npmrc"), "")

  log("→ installing (tarballs, the way a client resolves them)")
  run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"], { cwd: tree, stdio: "inherit" })

  log("→ typechecking the published tree")
  try {
    run("npx", ["tsc", "--noEmit"], { cwd: tree, stdio: "inherit" })
  } catch {
    console.error(
      [
        "",
        "✗ the published tree does not typecheck.",
        "",
        "The template compiles here through the workspace link and would NOT compile",
        "for a client. The usual cause is an import of something `packages/*` has at",
        "HEAD and the packed version does not — a subpath added to an `exports` map,",
        "or a file missing from a package's `files`.",
        "",
        "Fix the package, not the import: add a changeset, release, and re-run. Removing",
        "the import hides the defect and ships the same broken template.",
      ].join("\n"),
    )
    process.exitCode = 1
  }

  if (process.exitCode !== 1) log("\n✓ the published tree typechecks against the packed engine")
  if (keep) log(`\ntree kept at ${tree}`)
} finally {
  if (!keep) rmSync(work, { recursive: true, force: true })
}
