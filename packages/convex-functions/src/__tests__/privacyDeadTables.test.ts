import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { DINER_TABLES } from "../privacy"

/**
 * An erasure report does not ask for a manual check that cannot find anything.
 *
 * WHAT WAS BROKEN (#434.7). Sixteen legacy `cms*` singletons have no reader and
 * no writer anywhere in the product — measured across every non-schema source:
 *
 *     cms, cmsHome, cmsMenu, cmsAbout, cmsContact, cmsBlogPosts, cmsCart,
 *     cmsCheckout, cmsTracking, cmsSignin, cmsSignup, cmsPrivacy, cmsTerms,
 *     cms404, cmsMaintenance, cmsAccount          reads=0  inserts=0
 *
 * `privacy.ts` listed `cmsHome` as a diner table, and ended every erasure with
 * an unconditional note telling the operator to check the homepage testimonials
 * by hand. For testimonials that do not exist and cannot.
 *
 * That is worse than noise on a document an establishment answers a subject
 * request with: it makes every erasure read as incomplete, and an operator who
 * dutifully checks and finds nothing learns to skip the notes — including the
 * four that are real (the auth component, the webhook queue, the e-mail
 * segments, and the invoice retained under art. 17.3.b).
 *
 * The tables themselves are still declared, and the schema says why at length:
 * Convex refuses a deploy that drops a table while documents exist, and "zero
 * writers in this repository" is a measurement of the code rather than of any
 * client's data.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, "..", "..", "..", "..")

/** The sixteen, by name, so the assertion is about a set and not a grep. */
const DEAD_CMS_TABLES = [
  "cms",
  "cmsHome",
  "cmsMenu",
  "cmsAbout",
  "cmsContact",
  "cmsBlogPosts",
  "cmsCart",
  "cmsCheckout",
  "cmsTracking",
  "cmsSignin",
  "cmsSignup",
  "cmsPrivacy",
  "cmsTerms",
  "cms404",
  "cmsMaintenance",
  "cmsAccount",
] as const

/** Every TypeScript source that could read or write a table, schema excluded. */
function productSources(): string[] {
  const roots = [
    join(REPO, "packages", "convex-functions", "src"),
    join(REPO, "apps", "themes", "convex"),
    join(REPO, "apps", "themes", "components"),
  ]
  const files: string[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === "_generated" || entry === "node_modules" || entry === "__tests__") continue
        walk(full)
      } else if (/\.tsx?$/.test(entry)) {
        files.push(full)
      }
    }
  }
  roots.forEach(walk)
  return files
}

describe("the legacy cms singletons", () => {
  it("are still read and written by nothing", () => {
    // The premise the rest of this file rests on. If one of them acquires a
    // writer, it stops being dead and every decision below has to be revisited
    // — starting with whether it belongs in the erasure sweep after all.
    const sources = productSources()
    expect(sources.length).toBeGreaterThan(100)

    const alive: string[] = []
    for (const table of DEAD_CMS_TABLES) {
      const pattern = new RegExp(
        `(insert|patch|replace)\\(\\s*"${table}"|db\\.query\\(\\s*"${table}"`
      )
      for (const file of sources) {
        // `privacy.ts` and `backupTables.ts` ENUMERATE them; they do not read
        // or write one. The distinction is the whole point.
        if (/privacy\.ts$|backupTables\.ts$/.test(file)) continue
        if (pattern.test(readFileSync(file, "utf8"))) {
          alive.push(`${table} in ${file.slice(REPO.length + 1)}`)
          break
        }
      }
    }
    expect(alive).toEqual([])
  })

  it("are not treated as a diner's personal data", () => {
    // `cmsHome` was, and that is what put an impossible instruction on a
    // legally-facing report.
    const listed = DEAD_CMS_TABLES.filter((table) =>
      (DINER_TABLES as readonly string[]).includes(table)
    )
    expect(listed).toEqual([])
  })

  it("and the erasure prints no note about one", () => {
    // The note was unconditional — added at the end of every run, not on a
    // count. So it was on every report an establishment ever produced.
    const source = readFileSync(join(HERE, "..", "privacy.ts"), "utf8")
    // Only inside the comment that records why it was removed.
    const noteCalls = source
      .split("\n")
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /"cmsHome"/.test(line) && !/^\s*[/*]/.test(line))
    expect(noteCalls.map(({ i }) => i + 1)).toEqual([])
  })

  it("the notes that remain are about tables that can actually hold data", () => {
    // The four real ones, kept: an erasure that reported nothing retained would
    // be the opposite failure, and art. 17.3.b requires the invoice to be named.
    const source = readFileSync(join(HERE, "..", "privacy.ts"), "utf8")
    expect(source).toMatch(/"betterAuth"/)
    expect(source).toMatch(/"platformWebhookFailures"/)
    expect(source).toMatch(/"emailSegments"/)
  })
})
