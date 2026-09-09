/**
 * Every runtime dependency this app declares is reachable from its source.
 *
 * WHAT WENT WRONG. `apps/site` declared `three`, `@react-three/fiber`,
 * `@react-three/drei`, `split-type`, `react-wrap-balancer` and `@types/three`.
 * Together that was 44 MB of `node_modules` — `three` alone measured 39 MB —
 * installed on every CI run and every deploy of the commercial site.
 *
 * Three of them were imported by nothing at all. The other two were imported
 * by exactly one file, `components/webgl/hero-scene.tsx`, whose `HeroScene`
 * export no route ever rendered: `grep -rn "HeroScene\|hero-scene"` over
 * `apps/site` returned only the component's own three self-references. Its
 * private helper library, `lib/webgl/` (five files, 205 lines), had no other
 * consumer either, so the whole subtree was reachable from no page.
 *
 * This is the second time this app has carried a dependency nobody imported —
 * `README.md`'s own history records `tokens` being "dropped: it was declared as
 * a dependency without being imported anywhere". Noticing it twice by hand is
 * what this test replaces.
 *
 * WHAT THIS DOES AND DOES NOT HOLD. It catches a dependency no source file
 * imports. It does NOT catch a dependency imported only by a component nothing
 * renders — that is how `three` survived, and only the deletion of the dead
 * component turned it into something this test can see. A reachability check
 * from the route tree would catch both; it is not what this is.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const SITE = path.join(__dirname, "..")

/** Everything a bundler or a test could import from. */
const SOURCE_DIRS = ["app", "components", "lib", "convex", "tests", "e2e"]

/**
 * Declared, and genuinely imported by no source file — so an absence here is
 * correct, not drift. One entry, and it carries its reason.
 *
 * The list is deliberately this short. `next`, `react`, `react-dom` and
 * `tw-animate-css` were on it in a first draft as "toolchain"; all four turned
 * out to be imported perfectly normally (`next/link`, `react`, `react-dom`, and
 * `@import "tw-animate-css"` from `app/globals.css`), so an excuse for them
 * would have been an excuse the code did not need — and every unnecessary entry
 * is a hole this test cannot see through. The second case below exists to keep
 * that from creeping back.
 */
const NOT_IMPORTED_BY_SOURCE: Record<string, string> = {
  "@auth/core": "a REQUIRED peer of @convex-dev/auth — dropping it breaks install, not a build",
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry === "_generated") continue
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts|js|jsx|mjs|css)$/.test(p)) out.push(p)
  }
  return out
}

const sources = SOURCE_DIRS.flatMap((d) => walk(path.join(SITE, d)))
const haystack = sources.map((f) => readFileSync(f, "utf8")).join("\n")

const pkg = JSON.parse(readFileSync(path.join(SITE, "package.json"), "utf8")) as {
  dependencies: Record<string, string>
}

/** `from "x"`, `from "x/sub"`, `require("x")`, `import("x")`, and CSS `@import "x"`. */
function isImported(dep: string): boolean {
  const name = dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(
    `(from\\s+["'\`]|require\\(\\s*["'\`]|import\\(\\s*["'\`]|@import\\s+["'\`])${name}(/|["'\`])`
  ).test(haystack)
}

describe("apps/site dependencies", () => {
  it("declares no runtime dependency that no source file imports", () => {
    const unused = Object.keys(pkg.dependencies)
      .filter((d) => !(d in NOT_IMPORTED_BY_SOURCE))
      .filter((d) => !isImported(d))

    expect(unused).toEqual([])
  })

  it("keeps the allowlist honest — an entry that IS imported has no excuse to be on it", () => {
    // An allowlist is a hole in the check above, so every entry must still earn
    // its place. If one of these starts being imported normally it stops needing
    // an excuse, and this fails until the excuse is deleted.
    const nowImported = Object.keys(NOT_IMPORTED_BY_SOURCE).filter(
      (d) => d in pkg.dependencies && isImported(d)
    )

    expect(nowImported).toEqual([])
  })

  it("keeps the allowlist honest — an entry that is no longer declared should leave it", () => {
    const notDeclared = Object.keys(NOT_IMPORTED_BY_SOURCE).filter(
      (d) => !(d in pkg.dependencies)
    )

    expect(notDeclared).toEqual([])
  })

  it("no longer carries the 3D stack that no page rendered", () => {
    const gone = ["three", "@react-three/fiber", "@react-three/drei", "split-type"]
    expect(gone.filter((d) => d in pkg.dependencies)).toEqual([])
  })
})
