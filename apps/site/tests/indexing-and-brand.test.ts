/**
 * What a search engine is told about this site, and whose name is on the card (#535).
 *
 * Four findings from the 15 September review of `apps/site`, all of them about
 * text a person never sees on the page and every crawler does.
 *
 * 1. THE OPEN GRAPH CARD SAID « Be in Digital ». That is the agency. This site
 *    sells BeYours, and the card is what appears when anybody shares a link to
 *    it — the one place the wrong brand reaches an audience that has not arrived
 *    yet. `README.md`'s Naming section exists because these two are routinely
 *    confused; the card was confusing them.
 *
 * 2. THE AFFILIATE CANONICAL WAS ON THE LAYOUT. `alternates: { canonical:
 *    "/parrainage" }` in `parrainage/layout.tsx` is inherited by every route
 *    under it — `connexion`, `contrat`, `inscription` and the whole dashboard —
 *    so four distinct pages told Google they were duplicates of the landing
 *    page. A canonical is a claim about ONE url and belongs on the page making
 *    it.
 *
 * 3. AND 4. NOTHING KEPT CRAWLERS OUT OF `/admin` OR THE AFFILIATE DASHBOARD.
 *    `robots.ts` disallowed `/checkout/` and `/api/` and neither of these, and
 *    no layout carried `robots: { index: false }`. Both are behind a sign-in, so
 *    what gets indexed is the sign-in wall — which is worthless in a result page
 *    and tells anybody reading the index where the console lives. Belt and
 *    braces on purpose: `robots.txt` is a request a crawler may ignore, and the
 *    meta tag is what a page carries when it is fetched anyway.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const APP = process.cwd()

function read(relative: string): string {
  return readFileSync(join(APP, relative), "utf8")
}

/**
 * The file with its comments removed.
 *
 * Necessary, and measured on this very test: both fixes below carry a comment
 * naming the thing they removed — the agency's name, and the canonical that
 * used to sit on the layout — and a scanner that reads comments cannot tell the
 * explanation from the thing explained. The same trap `convex/auth.ts` fell into
 * when it carried a comment forbidding a dev origin three lines above the code
 * adding one.
 */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
}

describe("the Open Graph card", () => {
  const source = code("app/opengraph-image.tsx")

  it("carries the product's name", () => {
    expect(source).toMatch(/Yours/)
  })

  it("catches the agency's name whichever way it is spaced", () => {
    // Anti-vacuity for the regex, and for `code()`: a comment naming the agency
    // must not count, and the markup must.
    const AGENCY = /Be\s*in\s*Digital/i
    expect(AGENCY.test("<span>Be</span><span>in</span><span>Digital</span>".replace(/<[^>]*>/g, " "))).toBe(true)
    expect(AGENCY.test("BeInDigital")).toBe(true)
    expect(code("app/opengraph-image.tsx")).not.toMatch(/Be in Digital/i)
  })

  it("does not carry the agency's", () => {
    /*
     * BeYours is the product sold to restaurant owners; BeInDigital is the
     * agency. Two brands, two businesses — and this card reaches people who
     * know neither.
     */
    const words = source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")
    expect(words).not.toMatch(/Be\s*in\s*Digital/i)
  })
})

describe("the affiliate section's canonical", () => {
  it("is not declared on the shared layout", () => {
    // Inherited by `connexion`, `contrat`, `inscription` and the dashboard, all
    // of which would then claim to be the landing page.
    expect(code("app/parrainage/layout.tsx")).not.toMatch(/canonical/)
  })

  it("is declared on the landing page itself", () => {
    // Anti-vacuity: deleting the canonical outright would satisfy the case
    // above and lose a claim the landing page should be making.
    expect(code("app/parrainage/page.tsx")).toMatch(/canonical:\s*"\/parrainage"/)
  })
})

describe("what robots.txt keeps out", () => {
  const source = code("app/robots.ts")

  it("still keeps out what it always did", () => {
    // Anti-vacuity for the two below: a rewritten rule set that dropped these
    // would pass them and be a regression.
    expect(source).toMatch(/"\/checkout\/"/)
    expect(source).toMatch(/"\/api\/"/)
  })

  it("keeps out the operations console", () => {
    expect(source).toMatch(/"\/admin\/"/)
  })

  it("keeps out the affiliate dashboard", () => {
    expect(source).toMatch(/"\/parrainage\/dashboard\/"/)
  })
})

describe("what the pages themselves say", () => {
  /*
   * `robots.txt` is a REQUEST. A crawler that ignores it, or one that reaches a
   * url from a link rather than from the root, gets the page — and the meta tag
   * is the only thing that travels with it.
   */
  const NOINDEX = /robots:\s*\{[^}]*index:\s*false/

  it("the admin console asks not to be indexed", () => {
    expect(code("app/admin/layout.tsx")).toMatch(NOINDEX)
  })

  it("the affiliate dashboard asks not to be indexed", () => {
    expect(code("app/parrainage/dashboard/layout.tsx")).toMatch(NOINDEX)
  })

  it("the public pages do not", () => {
    // Anti-vacuity, and the failure that would matter most: a `noindex` that
    // escaped onto the marketing site would take it out of Google entirely.
    expect(code("app/parrainage/layout.tsx")).not.toMatch(NOINDEX)
    expect(code("app/layout.tsx")).not.toMatch(NOINDEX)
  })
})
