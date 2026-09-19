/**
 * Nothing this package imports may reach `dist` as a runtime TypeScript import.
 *
 * WHY THIS EXISTS. Several engine packages publish raw `.ts` on purpose:
 * `@be-yours/convex-schema` publishes its whole source, and
 * `@be-yours/core` declares nine subpaths pointing straight at `src/`. That
 * is deliberate — the Convex bundler compiles them, and a schema has to stay
 * readable as source. It also means that any of them left EXTERNAL by `tsup`
 * becomes a runtime `require` for a `.ts` file in the published bundle.
 *
 * WHAT THAT BREAKS, AND WHY NOBODY SAW IT. Two different failures, both of them
 * a client's and neither of them reproducible on a developer's machine:
 *
 *   - Node 22 and 24 strip types, but refuse to do so under `node_modules`:
 *     "Stripping types is currently unsupported for files under node_modules".
 *     In this monorepo the package resolves through the workspace, OUTSIDE
 *     `node_modules`, so it loads. A client installs from the registry, where it
 *     does not.
 *   - Node 20 does not strip types at all, so it fails on the first `as const`
 *     wherever the file sits. That is what CI runs.
 *
 * So a bundle can be green in the monorepo on Node 24, green in a plain `node
 * -e` locally, and dead on every client repository. `engine-bundle-loads.test.ts`
 * in both apps catches it by spawning a real Node — and only catches what THAT
 * Node happens to refuse. This one is static: it asks the export maps, so it
 * gives the same answer on every runtime.
 *
 * IT IS NOT A LIST. `tsup.config.ts` derives `noExternal` from core's own export
 * map for the same reason this test reads it: the two literals that used to be
 * there missed `./status-labels`, which is how a client's Playwright run became
 * the thing that found it.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE = join(HERE, "../..")
const SRC = join(PACKAGE, "src")
const PACKAGES = join(PACKAGE, "..")

/** Every `.ts`/`.tsx` file under `src/`, tests excluded. */
function sources(dir: string = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Every `@be-yours/…` specifier this package imports, deduplicated. */
function engineImports(): string[] {
  const found = new Set<string>()
  for (const file of sources()) {
    const source = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "")
    for (const match of source.matchAll(
      /from\s+["'](@be-yours\/[^"']+)["']/g
    )) {
      found.add(match[1]!)
    }
  }
  return [...found].sort()
}

/**
 * The file a specifier resolves to, as the package's own manifest declares it.
 *
 * `null` when the manifest does not answer — an unknown package, or a subpath
 * it does not export. Either is a different defect and not this test's.
 */
function resolvedTarget(specifier: string): string | null {
  const [, name, ...rest] = specifier.split("/")
  const manifestPath = join(PACKAGES, name!, "package.json")
  let manifest: { main?: string; exports?: Record<string, unknown> }
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch {
    return null
  }

  const subpath = rest.length > 0 ? `./${rest.join("/")}` : "."
  const declared = manifest.exports?.[subpath]
  if (typeof declared === "string") return declared
  if (declared && typeof declared === "object") {
    const conditions = declared as Record<string, unknown>
    const pick = conditions.require ?? conditions.import ?? conditions.default
    return typeof pick === "string" ? pick : null
  }
  // No `exports` entry at all: the root falls back to `main`.
  return subpath === "." ? (manifest.main ?? null) : null
}

/** What `tsup.config.ts` will actually bundle, evaluated rather than parsed. */
async function bundledSpecifiers(): Promise<string[]> {
  const config = (await import("../../tsup.config")).default as {
    noExternal?: unknown[]
  }
  return (config.noExternal ?? []).filter(
    (entry): entry is string => typeof entry === "string"
  )
}

describe("the published bundle", () => {
  it("imports something from the engine at all", async () => {
    // Anti-vacuity: a wrong SRC path, or a regex that stopped matching, would
    // make the assertion below pass by finding nothing to check.
    expect(engineImports().length).toBeGreaterThan(0)
  })

  it("resolves at least one import to raw TypeScript", () => {
    // The other half of the anti-vacuity, and the reason this file exists: if
    // no engine package published raw `.ts` any more, this test should be
    // deleted rather than left passing over an empty set.
    const raw = engineImports().filter((s) => resolvedTarget(s)?.endsWith(".ts"))
    expect(raw.length).toBeGreaterThan(0)
  })

  it("bundles every import that resolves to raw TypeScript", async () => {
    /*
     * THE DEFECT, TWICE. `@be-yours/convex-schema` was external and broke
     * every client's Playwright run; `@be-yours/core/status-labels` was
     * external and broke the same runs on Node 20, after the first fix.
     */
    const bundled = await bundledSpecifiers()
    const leaked = engineImports().filter((specifier) => {
      const target = resolvedTarget(specifier)
      if (!target?.endsWith(".ts")) return false
      // A package bundled whole covers its subpaths.
      return !bundled.some(
        (entry) => entry === specifier || specifier.startsWith(`${entry}/`)
      )
    })

    expect(
      leaked,
      "left external, these reach dist as a runtime require for a .ts file"
    ).toEqual([])
  })

  it("does not bundle a package that ships compiled JavaScript", async () => {
    // Bundling is not free: core's root entry pulls in the AWS SDK, and this
    // package must not carry it. Only the raw-source subpaths are bundled.
    const bundled = await bundledSpecifiers()
    const overreach = bundled.filter((specifier) => {
      const target = resolvedTarget(specifier)
      return target !== null && !target.endsWith(".ts")
    })

    expect(overreach, "this specifier ships JavaScript; leave it external").toEqual([])
  })
})
