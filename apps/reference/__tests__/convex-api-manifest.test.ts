import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"

/**
 * The committed `convex/_generated/api.d.ts` must name every module in
 * `convex/`.
 *
 * It did not. Both twins' generated file listed 115 modules against 120 on
 * disk: three of the five are `schema`, `auth.config` and `convex.config`,
 * which Convex codegen excludes by design — and the other two,
 * `emailTransport` and `lib/menuSync`, were simply missing. Neither name has
 * ever appeared in the committed file: `git log -S"emailTransport" --
 * convex/_generated/api.d.ts` returns nothing, while the file itself has been
 * edited six times since `lib/menuSync.ts` landed. It is being hand-edited
 * rather than regenerated.
 *
 * Nothing noticed, and nothing could have. `scripts/check-app-divergence.mjs`
 * compares the two apps to each other and lists `_generated` in its `SKIP_DIRS`
 * (`:45-48`), so it cannot see this file at all — which is also why the ~21,800
 * line `betterAuth` divergence between the two copies goes unreported. `tsc` is
 * blind to it too: the missing modules are imported by RELATIVE PATH
 * (`./emailTransport`, `./lib/menuSync`), so a short `api.d.ts` compiles
 * perfectly. And no workflow runs `convex codegen` — the only definition of it
 * is `apps/themes/package.json`'s `convex:codegen`, invoked by two hand-run
 * helper scripts.
 *
 * What is NOT the reason, because an earlier draft of this file said it was:
 * that `internal.emailTransport.sendEmail` would now resolve. It does not.
 * Both modules export plain functions rather than a `mutation`/`internalAction`,
 * and `FilterApi` prunes a module with no function references out of `api` and
 * `internal` — measured, the property is still absent after the fix. The reason
 * is narrower and duller: this file must be what codegen writes. A hand-edited
 * manifest drifts, and the drift is invisible until the day one of those
 * modules gains a Convex function — at which point the entry that should
 * already be there is not, and the failure looks like a bug in the new code.
 *
 * The mirror ships the file verbatim (`scripts/lib/mirror-tree.mjs:54-55`
 * walks the filesystem and consults no gitignore), so every client clone of
 * `beyours-boilerplate` received the same two-module-short manifest.
 *
 * Why a source comparison rather than a `convex codegen --dry-run` diff:
 * codegen resolves component definitions against a live deployment
 * (`convex.config.ts` registers `betterAuth`), so it cannot run in CI or on a
 * bench without a backend. The module list is the half that can be checked
 * offline, and it is the half that was wrong.
 *
 * Bench-only, like `mirror-publisher.test.ts` and `workflow-publish-gates.test.ts`:
 * it reads both apps from the monorepo root and would be meaningless on a
 * client site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")
const APPS = ["reference", "themes"] as const

/**
 * Convex's own entry-point rule, transcribed from `convex@1.44.0`,
 * `dist/esm/bundler/index.js:264-356`.
 *
 * An earlier draft of this file hardcoded three module NAMES — `schema`,
 * `auth.config`, `convex.config` — which is not the rule and produced false
 * failures on ordinary trees. `auth.config` and `convex.config` are not special
 * cases at all: they fall out of the *multiple dots* clause, which also excludes
 * the colocated `*.test.ts` Convex's own documentation recommends. An adversarial
 * pass added `convex/menuSync.test.ts` and `convex/constants.ts` — both perfectly
 * legal — and the guard demanded entries codegen would never emit, with a failure
 * message telling the developer to hand-write them into `fullApi`. A guard that
 * pushes toward a wrong `api.d.ts` is worse than none.
 */
const ENTRY_POINT_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".jsx"]

/** Convex's `entryPoints()`, applied to one file. `relPath` is POSIX, from `convex/`. */
function isEntryPoint(relPath: string, fullPath: string): boolean {
  const base = relPath.split("/").pop() ?? ""
  if (!ENTRY_POINT_EXTENSIONS.some((ext) => relPath.endsWith(ext))) return false
  if (relPath.startsWith("_generated/") || relPath.startsWith("_deps/")) return false
  if (base.startsWith(".")) return false
  // An emacs tempfile.
  if (base.startsWith("#")) return false
  if (base === "schema.ts" || base === "schema.js") return false
  // The clause that quietly covers `auth.config.ts`, `convex.config.ts` and
  // every `*.test.ts` / `*.spec.ts`.
  if ((base.match(/\./g) ?? []).length > 1) return false
  if (relPath.includes(" ")) return false
  // And last: a `.ts`/`.tsx` with no top-level import or export is not a module,
  // so codegen drops it after collecting it.
  if (relPath.endsWith(".ts") || relPath.endsWith(".tsx")) {
    if (!/^\s{0,100}(import|export)/m.test(fs.readFileSync(fullPath, "utf8"))) return false
  }
  return true
}

function convexDir(app: string): string {
  return path.join(REPO_ROOT, "apps", app, "convex")
}

/** Every module in `convex/`, as codegen names it: POSIX, extension stripped. */
function modulesOnDisk(app: string): string[] {
  const root = convexDir(app)
  const found: string[] = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "_generated" || entry.name === "_deps") continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      const relPath = path.relative(root, full).split(path.sep).join("/")
      if (!isEntryPoint(relPath, full)) continue
      found.push(relPath.replace(/\.(js|mjs|cjs|ts|tsx|mts|cts|jsx)$/, ""))
    }
  }

  walk(root)
  return found.sort()
}

/** Every module the committed `api.d.ts` imports, in the order it imports them. */
function modulesImported(app: string): string[] {
  const source = fs.readFileSync(path.join(convexDir(app), "_generated/api.d.ts"), "utf8")
  return [...source.matchAll(/^import type \* as [\w$]+ from "\.\.\/(.+?)\.js";$/gm)].flatMap(
    (match) => (match[1] === undefined ? [] : [match[1]]),
  )
}

/** Every module the committed `api.d.ts` places in `fullApi`. */
function modulesInFullApi(app: string): string[] {
  const source = fs.readFileSync(path.join(convexDir(app), "_generated/api.d.ts"), "utf8")
  const block = source.match(/declare const fullApi: ApiFromModules<\{([\s\S]*?)\n\}>;/)
  expect(block?.[1], `${app}: api.d.ts has no fullApi block`).toBeTruthy()
  // `-` is in the character class because `moduleIdentifier` maps it to `_` for
  // the IMPORT alias but leaves it in the quoted `fullApi` key: a module at
  // `convex/lib/menu-sync.ts` survived the import scan and vanished here.
  // `,` as well as `;` because codegen's native output uses a trailing comma
  // and this repository's prettier rewrites it to a semicolon — a guard that
  // only knew the formatted shape would fail on a freshly generated file.
  return [...(block?.[1] ?? "").matchAll(/^\s*"?([\w./-]+)"?: typeof \w+[;,]$/gm)].flatMap(
    (match) => (match[1] === undefined ? [] : [match[1]]),
  )
}

describe.each(APPS)("apps/%s convex/_generated/api.d.ts", (app) => {
  test("names every module in convex/", () => {
    const onDisk = modulesOnDisk(app)
    const imported = modulesImported(app)

    // Reported as a set difference rather than a length, because the useful
    // half of the failure is WHICH module was added without regenerating.
    expect(onDisk.filter((name) => !imported.includes(name))).toEqual([])
  })

  test("names no module that is not in convex/", () => {
    const onDisk = modulesOnDisk(app)
    const imported = modulesImported(app)

    // The other direction, and the one a deletion produces: a module removed
    // from the tree leaves a `typeof` pointing at a file that no longer
    // exists, which `tsc` catches — but only once someone typechecks this app,
    // and the mirror ships the file either way.
    expect(imported.filter((name) => !onDisk.includes(name))).toEqual([])
  })

  test("puts every imported module in fullApi", () => {
    // Codegen writes the import and the `fullApi` entry together, so a file
    // where they disagree has been edited by hand — which is exactly how the
    // two modules went missing.
    expect(modulesInFullApi(app).sort()).toEqual(modulesImported(app).sort())
  })
})

test("both twins declare the same convex modules", () => {
  // `check-app-divergence.mjs` skips `_generated` entirely, so this is the only
  // place the two generated manifests are compared. Their *contents* legitimately
  // diverge — `apps/reference` refers to the betterAuth component type by import
  // while `apps/themes` inlines it — but the module list is the same tree twice
  // and must not drift.
  expect(modulesImported("themes")).toEqual(modulesImported("reference"))
})
