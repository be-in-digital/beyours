/**
 * The site quotes one delivery time (#535).
 *
 * WHAT WAS MEASURED, 17 September 2026. Five places on this site tell a
 * restaurateur how long it takes to go live. Three said four to six weeks — the
 * hero, the pricing FAQ, and the FAQ JSON-LD. Two said two to four: the contact
 * FAQ and the about FAQ, word for word the same sentence duplicated across two
 * files.
 *
 * IT WAS NOT ONLY AN INTERNAL DISAGREEMENT. `components/seo/json-ld.tsx` is
 * structured data, so the figure a search engine indexed — and could show in a
 * result — was four to six, while the page the reader then landed on said two to
 * four. Structured data is required to match what the page shows, and here it
 * could not, whichever of the two was true.
 *
 * Four to six is the true one, and this file is where that is now written down.
 *
 * WHY A SWEEP RATHER THAN TWO FIXED ASSERTIONS. The defect was one sentence
 * duplicated into two files, and a duplicated sentence drifts again the moment
 * somebody writes a third FAQ. Pinning the two known sites would guard the two
 * that have already been fixed and nothing else. The sweep fails on any delivery
 * claim that disagrees, wherever it is added.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const APP = process.cwd()

/** Where copy a visitor or a crawler receives can come from. */
const SCANNED = ["app", "components", "lib"]

/** « 4 à 6 semaines » and « entre 4 et 6 semaines » — both ways people write it. */
const CLAIM = /(\d+)\s*(?:à|et)\s*(\d+)\s+semaines?/g

/** The answer of 17 September 2026. Change it here, and the site follows. */
const AGREED = { from: 4, to: 6 }

/**
 * Comments removed, because this fix is the kind that gets explained in one.
 *
 * A file that says « said 2 et 4 semaines before » in a comment is describing
 * the defect, not committing it, and a scanner that cannot tell the two apart
 * accuses the fix of being the bug. `//` is left alone when it follows a colon,
 * so an `https://` url does not swallow the rest of its line.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules" || entry === ".next") continue
      const full = join(current, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry)) found.push(full)
    }
  }
  walk(join(APP, dir))
  return found
}

interface Claim {
  file: string
  from: number
  to: number
  text: string
}

function deliveryClaims(): Claim[] {
  const claims: Claim[] = []
  for (const dir of SCANNED) {
    for (const file of sourceFiles(dir)) {
      const source = withoutComments(readFileSync(file, "utf8"))
      for (const match of source.matchAll(CLAIM)) {
        claims.push({
          file: relative(APP, file),
          from: Number(match[1]),
          to: Number(match[2]),
          text: match[0],
        })
      }
    }
  }
  return claims
}

describe("how long the site says it takes to go live", () => {
  it("there are claims to check, and the sweep reads them", () => {
    // Anti-vacuity. A broken walk or a regex that stopped matching would let
    // every assertion below pass over an empty list, and the guard would report
    // agreement it had not looked for.
    const claims = deliveryClaims()
    expect(claims.length).toBeGreaterThanOrEqual(5)
    expect(claims.map((c) => c.file)).toContain("components/hero-section.tsx")
  })

  it("every one of them quotes the same figure", () => {
    const disagreeing = deliveryClaims().filter(
      (c) => c.from !== AGREED.from || c.to !== AGREED.to,
    )

    expect(
      disagreeing.map((c) => `${c.file}: « ${c.text} »`),
      `the site promises ${AGREED.from} to ${AGREED.to} weeks; these say otherwise`,
    ).toEqual([])
  })

  it("and the crawler is told what the reader is told", () => {
    // The half that made this worth a guard rather than a one-line edit: the
    // JSON-LD is a separate voice, and it was the one that happened to be right.
    const structured = deliveryClaims().filter((c) =>
      c.file.includes("json-ld"),
    )

    expect(structured.length).toBeGreaterThan(0)
    for (const claim of structured) {
      expect({ from: claim.from, to: claim.to }).toEqual(AGREED)
    }
  })
})
