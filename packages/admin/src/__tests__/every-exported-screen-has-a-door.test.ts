/**
 * A component this package exports is rendered by something (#525).
 *
 * WHAT THIS CATCHES. `PropagationModal` and `DuplicateCatalogModal` were
 * exported from `pages/products/index.ts` and rendered by nothing. Their back
 * halves were live the whole time — `products.updateWithPropagation` and
 * `products.duplicateCatalog` are registered as `storeMutation` in both apps,
 * permission-guarded and covered by `catalogue-scope.test.ts` — so multi-store
 * catalogue propagation was a feature that existed everywhere except on a
 * screen. The feature ledger counted it as shipping.
 *
 * The barrel's own comment had recorded the gap and called closing it "a change
 * with its own review". That review is #525; this is what stops the next one
 * lasting as long.
 *
 * WHY THE HAYSTACK INCLUDES THE APPS. Almost every screen here is exported for
 * `apps/themes` and `apps/reference` to mount — `ProductsPage`, `KitchenPage`,
 * forty-odd others — so a scan limited to this package would report them all as
 * doorless and be switched off within a week. Measured: 45 of 74 "unrendered"
 * against the package alone, and 1 against the monorepo.
 *
 * WHY `<Name` AND NOT THE IMPORT. An import proves somebody named it; only a
 * JSX tag proves somebody renders it. `PropagationModal` was imported by its own
 * barrel and by nothing else, which is exactly the shape that reads as used.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_SRC = join(HERE, "..")
const REPO_ROOT = join(HERE, "../../../..")

const SKIP = new Set(["node_modules", "__tests__", "tests", ".next", ".turbo", "dist"])

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

/**
 * Not a component, and never rendered as one.
 *
 * The one exemption, and it has to earn its place: anything else on this list
 * would be the gap this test exists to close.
 */
const NOT_A_COMPONENT = new Set(["TOUR_STEPS"])

/** Every capitalised name re-exported from a barrel in this package. */
function exportedNames(files: string[]): string[] {
  const names = new Set<string>()
  for (const file of files) {
    if (!file.endsWith("index.ts")) continue
    const source = readFileSync(file, "utf8")
    for (const [, name] of source.matchAll(/export \{ ([A-Z]\w+)(?: as \w+)? \} from/g)) {
      if (name) names.add(name)
    }
  }
  return [...names].sort()
}

/** Everywhere in the monorepo a screen could be mounted from. */
function renderSites(): string {
  const roots = [
    join(PACKAGE_SRC),
    join(REPO_ROOT, "apps/themes/app"),
    join(REPO_ROOT, "apps/themes/components"),
    join(REPO_ROOT, "apps/reference/app"),
    join(REPO_ROOT, "apps/reference/components"),
  ]
  let haystack = ""
  for (const root of roots) {
    for (const file of walk(root)) haystack += "\n" + readFileSync(file, "utf8")
  }
  return haystack
}

describe("every screen this package exports", () => {
  const files = walk(PACKAGE_SRC)
  const exported = exportedNames(files)
  const haystack = renderSites()

  it("has barrels and render sites to compare", () => {
    // Anti-vacuity on both sides. An empty export list passes trivially; an
    // empty haystack fails everything and would be switched off rather than read.
    expect(exported.length).toBeGreaterThan(40)
    expect(haystack.length).toBeGreaterThan(200_000)
  })

  it("is rendered somewhere", () => {
    const doorless = exported.filter(
      (name) => !NOT_A_COMPONENT.has(name) && !new RegExp(`<${name}[\\s/>]`).test(haystack)
    )

    expect(
      doorless,
      "exported and mounted by nothing — wire it into a screen, or delete it"
    ).toEqual([])
  })

  it("the two this issue was about are mounted", () => {
    /*
     * Named directly as well as covered by the sweep, so deleting the exemption
     * list or loosening the regex would not silently release them.
     */
    expect(haystack).toMatch(/<DuplicateCatalogModal[\s/>]/)
    expect(haystack).toMatch(/<PropagationModal[\s/>]/)
  })

  it("and so is the dead-letter queue's screen", () => {
    // `platformWebhookFailures.listUnresolved` and `markResolved` were wrapped
    // and guarded in both apps with nothing rendering them, so a dropped Uber
    // Eats or Deliveroo order was written down and seen by nobody.
    expect(haystack).toMatch(/<WebhookFailuresPanel[\s/>]/)
  })

  it("the exemption is not a component", () => {
    // A guard whose allow-list can hold anything is an allow-list. Each entry
    // must be a name nothing could render: no file may define it as a component.
    for (const name of NOT_A_COMPONENT) {
      const defined = files.some((file) =>
        new RegExp(`export function ${name}\\s*\\(`).test(readFileSync(file, "utf8"))
      )
      expect(defined, `${name} is a component after all`).toBe(false)
    }
  })
})
