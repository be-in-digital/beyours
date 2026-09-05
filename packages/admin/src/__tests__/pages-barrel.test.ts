/**
 * `package.json` declares `"./pages": "./src/pages/index.ts"`, and for the whole
 * life of that entry the file did not exist. Anyone following the export map —
 * including `@be-in-digital/mcp-server`, which advertised ten page components at
 * `@be-in-digital/admin/pages` — got a module-not-found.
 *
 * The barrel exists now. These tests hold it to two things: it stays present, and
 * it stays in step with the page components the root barrel re-exports. Reading
 * the two files as text rather than importing them is deliberate — this package's
 * Vitest environment is `node`, and the page modules pull in `convex/react`,
 * `recharts` and friends at module scope.
 */

import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

function read(relativePath: string): string {
  return readFileSync(join(packageRoot, relativePath), "utf8")
}

/** Every identifier in `export { A, B } from "./x"` clauses, `type` aliases aside. */
function namedReExports(source: string, fromMatching: RegExp): string[] {
  const names: string[] = []
  const clause = /export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g
  for (const [, body = "", from = ""] of source.matchAll(clause)) {
    if (!fromMatching.test(from)) continue
    for (const entry of body.split(",")) {
      const name = entry.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]
      if (name) names.push(name)
    }
  }
  return names
}

describe("@be-in-digital/admin/pages", () => {
  it("is the file the exports map points at", () => {
    const manifest = JSON.parse(read("package.json")) as {
      exports?: Record<string, string>
    }
    const declared = manifest.exports?.["./pages"]
    expect(declared).toBe("./src/pages/index.ts")
    expect(read("src/pages/index.ts")).toContain("export {")
  })

  it("re-exports every page the root barrel does", () => {
    const fromRoot = namedReExports(read("src/index.ts"), /^\.\/pages\//)
    const fromBarrel = namedReExports(read("src/pages/index.ts"), /^\.\//)

    expect(fromRoot.length).toBeGreaterThan(20)
    expect(fromRoot.filter((name) => !fromBarrel.includes(name))).toEqual([])
  })

  it("adds nothing the root barrel does not also carry", () => {
    // The two are one surface reached by two paths. A name on only one side is a
    // consumer picking an import path and getting a different package.
    const fromRoot = namedReExports(read("src/index.ts"), /^\.\/pages\//)
    const fromBarrel = namedReExports(read("src/pages/index.ts"), /^\.\//)
    expect(fromBarrel.filter((name) => !fromRoot.includes(name))).toEqual([])
  })
})
