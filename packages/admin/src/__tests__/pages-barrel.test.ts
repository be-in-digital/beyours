/**
 * `@be-yours/admin/pages` carries every screen the root barrel does.
 *
 * `package.json` declared `"./pages": "./src/pages/index.ts"` for the life of
 * the entry with no such file behind it — the one broken subpath of the twenty
 * this package publishes, and the reason ten claims in `packages/mcp-server`'s
 * registry pointed client builds at a module that could not resolve.
 *
 * `src/pages/index.ts` re-exports the per-screen barrels with `export *`, so a
 * screen added to `pages/<dir>/index.ts` reaches this subpath on its own. What
 * that cannot catch is a *new directory*: add `pages/reports/`, export
 * `ReportsPage` from `src/index.ts`, forget the `export * from "./reports"`
 * here, and the root barrel offers a screen the subpath does not. That is the
 * gap this file holds.
 *
 * Sibling coverage, deliberately not repeated here: `page-reachability.test.ts`
 * checks that every exported page is actually mounted in both apps, and
 * `packages/mcp-server/src/__tests__/registry.test.ts` checks that every
 * declared subpath resolves to a file that exists.
 *
 * Read as text rather than imported: this package's Vitest environment is
 * `node`, and the page modules pull in `convex/react`, `recharts` and friends
 * at module scope.
 */

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

function read(relativePath: string): string {
  return readFileSync(join(packageRoot, relativePath), "utf8")
}

/** `export { A, B } from "./x"` — the names, and the `./x` each came from. */
function namedReExports(
  source: string,
): { name: string; from: string }[] {
  const found: { name: string; from: string }[] = []
  for (const [, body = "", from = ""] of source.matchAll(
    /export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g,
  )) {
    for (const entry of body.split(",")) {
      const name = entry.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]
      if (name) found.push({ name, from })
    }
  }
  return found
}

/** The `./x` of every `export * from "./x"`. */
function starReExports(source: string): string[] {
  return [...source.matchAll(/export\s*\*\s*from\s*"([^"]+)"/g)].map(
    ([, from]) => from ?? "",
  )
}

describe("@be-yours/admin/pages", () => {
  it("is the file the exports map points at", () => {
    const manifest = JSON.parse(read("package.json")) as {
      exports?: Record<string, string>
    }
    expect(manifest.exports?.["./pages"]).toBe("./src/pages/index.ts")
    expect(read("src/pages/index.ts")).toMatch(/export\s*\*/)
  })

  it("re-exports every page directory the root barrel draws from", () => {
    // `./pages/orders` in the root barrel -> `./orders` in the pages barrel.
    const rootDirectories = new Set(
      namedReExports(read("src/index.ts"))
        .filter(({ from }) => from.startsWith("./pages/"))
        .map(({ from }) => `.${from.slice("./pages".length)}`),
    )
    expect(rootDirectories.size).toBeGreaterThan(10)

    const covered = new Set(starReExports(read("src/pages/index.ts")))
    const missing = [...rootDirectories].filter((dir) => !covered.has(dir)).sort()
    expect(missing).toEqual([])
  })

  it("re-exports nothing from a directory that does not exist", () => {
    const unreadable = starReExports(read("src/pages/index.ts")).filter((from) => {
      try {
        read(join("src/pages", from, "index.ts"))
        return false
      } catch {
        return true
      }
    })
    expect(unreadable).toEqual([])
  })
})
