#!/usr/bin/env node
/**
 * Compiles the shippable cut of `apps/themes` against the engine packages as
 * TARBALLS — the artefact a client actually installs — and fails if it does
 * not typecheck.
 *
 * WHY THIS EXISTS. No CHECK in this repository compiles the published shape.
 * CI builds `apps/themes` through the pnpm workspace link, against `packages/*`
 * at HEAD. A client installs what the registry holds. The two are routinely
 * different code, and the difference is invisible here: `check-mirror-css.mjs`
 * does materialise the client tree, but it assembles `node_modules` by
 * SYMLINKING `packages/<name>`, so it never sees a pinned version either — it
 * is measuring the stylesheet, not the resolution.
 *
 * The sync compiles it (`lib/mirror-typecheck.mjs`), which is the last line
 * rather than the first: it runs after the merge, against what the registry
 * already serves, and all it can do by then is refuse to deliver. This runs
 * before, against the code you are about to publish.
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
 * `publish-mirror.mjs` refuses such a sync twice over — its pinned versions
 * must resolve what the tree imports, and the tree must then COMPILE against
 * them — which stops the mirror shipping it. Both of those measure what is
 * already published. This measures what is about to be: the tarballs are packed
 * from `packages/*` at HEAD, so a break introduced by the release you are
 * cutting shows up here and cannot show up there until the release has gone
 * out. Run it before, and again after.
 *
 * HOW. `pnpm pack` every engine package — NOT `npm pack`: only pnpm rewrites
 * `workspace:*`/`workspace:^` to a concrete version, and `pnpm publish` is what
 * `changeset publish` invokes for this workspace, so an npm-packed tarball
 * would carry a protocol no client can resolve and would be testing a shape
 * nobody ever receives. `lib/mirror-tree.mjs` — the module the publisher
 * itself copies with — materialises the shippable tree. Every engine
 * dependency is then pinned to its tarball, transitive ones included via
 * `pnpm.overrides`, and the result is both typechecked and RUN — the template's
 * own `pnpm typecheck`, then its own test suite.
 *
 * BOTH HALVES ARE LOAD-BEARING, and the second one is here because the first
 * release cut with this check in place passed it and still shipped a red
 * boilerplate. Four engine packages (`admin`, `convex-functions`,
 * `convex-schema`, `ui`) publish raw `src/*.ts` rather than a build. `tsc`
 * reads that happily; Vitest refuses to transform it inside `node_modules`, so
 * a client's own `pnpm test` died with
 * ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING and a bare `React is not
 * defined` while this check was green. A check that never executes the
 * published tree cannot see a module that resolves, typechecks, and then fails
 * to load.
 *
 * Packages are built first, because three of them (`core`, `restaurant`,
 * `cms`) publish `dist` and a tarball packed before the build would be empty
 * of it. Turbo caches that, so it is nearly free on a repeat run.
 *
 * WHAT IT CANNOT SEE. Anything registry-side: a botched publish, a missing
 * tarball, an auth failure. It proves the CODE is consistent, not that the
 * upload happened — so it is a pre-flight, not a replacement for cloning
 * `beyours-boilerplate` and building it after a release. It also stops short
 * of `next build` and `convex deploy`, which need an application env and a
 * live backend respectively — neither belongs in a check.
 *
 * WHERE IT RUNS. Not in `ci.yml` — it builds and installs the whole engine, and
 * paying that on every pull request is a decision about CI time rather than
 * about correctness. It runs on the DELIVERY, as `Verify the delivered tree`
 * in `.github/workflows/publish-mirror.yml`, gating the sync on every path that
 * pushes to the boilerplate. Keep running it by hand before cutting a release
 * and after publishing one; the workflow is the floor, not a replacement.
 *
 * It was wired there after being green and unused for the failure it was
 * written for. Four SHIPPED test files reached above the application root —
 * `path.join(APP, "../..", "packages")`, `new URL("../../../docs/…")`, a
 * hard-coded sibling app — so on a client clone one scan silently lost every
 * caller living in the engine (79 public Convex functions reported unreached)
 * and two files died on ENOENT before collecting. `beyours-boilerplate` was red
 * from 7 September while every required check here stayed green, because none
 * of them runs outside the workspace those paths resolve in. Run against
 * `a7862e90` this check reproduced the boilerplate's own line exactly —
 * `Test Files 3 failed | 140 passed (143)` — and `grep -rn check:mirror-build
 * .github/` returned nothing. A gate that never executes is not a gate.
 *
 * Usage:  node scripts/check-mirror-build.mjs   (also: pnpm check:mirror-build)
 *         --keep   leave the temporary tree in place for inspection
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { materializeMirror, trackedFiles } from "./lib/mirror-tree.mjs"

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
  // Same tree as the publisher's, `tracked` included.
  const { copied } = materializeMirror(SOURCE, tree, { tracked: trackedFiles(SOURCE) })
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

  const failed = []

  // The template's own script, not a bare `tsc --noEmit`, and for the same
  // reason `lib/mirror-typecheck.mjs` runs it in the sync: `apps/themes`
  // defines it as `tsc --noEmit && tsc --noEmit -p convex/tsconfig.json`, and
  // the root project EXCLUDES `convex/` — it reaches a backend module only
  // where app code transitively imports one. A bare `tsc` here checked the
  // backend by accident, and would have stopped doing so the moment a
  // `convex/` module lost its last importer.
  log("→ typechecking the published tree")
  try {
    run("pnpm", ["run", "typecheck"], { cwd: tree, stdio: "inherit" })
  } catch {
    failed.push(
      [
        "✗ the published tree does not typecheck.",
        "",
        "The template compiles here through the workspace link and would NOT compile",
        "for a client. The usual cause is an import of something `packages/*` has at",
        "HEAD and the packed version does not — a subpath added to an `exports` map,",
        "or a file missing from a package's `files`.",
        "",
        "Fix the package, not the import: add a changeset, release, and re-run. Removing",
        "the import hides the defect and ships the same broken template.",
        "",
        "A symbol MISSING FROM A MODULE the package does ship reads the same way here",
        "and is invisible to every other check — `exports` map and file list are both",
        "perfect. That is #408, and it is why the sync compiles too, against the",
        "REGISTRY versions rather than these locally packed ones.",
      ].join("\n"),
    )
  }

  // A typecheck is not enough, and that is the lesson of the 2026-09-06
  // release. `tsc` reads a package published as raw `src/*.ts` perfectly
  // happily, so this check went green while the boilerplate's own CI died on
  // ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING and a bare `React is not
  // defined`. Four engine packages ship TypeScript rather than a build, Vitest
  // does not transform `node_modules`, and nothing here had executed a single
  // line of the published tree. Running the template's own suite is what makes
  // this check see a module that resolves, typechecks, and cannot be loaded.
  log("→ running the template's own tests against the published tree")
  try {
    run("pnpm", ["test"], { cwd: tree, stdio: "inherit" })
  } catch {
    failed.push(
      [
        "✗ the published tree does not pass its own tests.",
        "",
        "This is the half a typecheck cannot see: a module that resolves and",
        "typechecks can still fail to LOAD for a client. The engine packages ship",
        "TypeScript source rather than a build, so everything that has to transform",
        "them must be told they are not ordinary `node_modules` — `next.config.ts`",
        "says so with `transpilePackages`, and every other runner in the template",
        "needs its own equivalent (Vitest: `test.server.deps.inline`).",
        "",
        "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING, or a bare `React is not",
        "defined` from a path inside `node_modules/@be-in-digital/`, is that and",
        "nothing else.",
      ].join("\n"),
    )
  }

  if (failed.length) {
    console.error("\n" + failed.join("\n\n"))
    process.exitCode = 1
  } else {
    log("\n✓ the published tree typechecks and passes its tests against the packed engine")
  }
  if (keep) log(`\ntree kept at ${tree}`)
} finally {
  if (!keep) rmSync(work, { recursive: true, force: true })
}
