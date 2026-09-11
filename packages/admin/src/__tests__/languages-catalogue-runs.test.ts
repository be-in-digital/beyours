import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The owner can see what a catalogue back-fill did.
 *
 * WHAT WAS BROKEN (#95). `translateCatalogue` has always written a
 * `translationJobs` row and kept it up to date — items completed, status, and
 * the error when the daily quota stopped the run. Nothing read any of it, so a
 * run that stopped at 80 of 300 looked exactly like one that finished: the
 * toast says « Traduction du catalogue lancée : 300 éléments » either way, and
 * the first evidence anybody got was a German storefront with French dish names
 * on it.
 *
 * This file asserts the SCREEN half — the query is exercised in
 * `convex-functions/src/__tests__/translationJobs.test.ts`. Read from the
 * source rather than rendered, because what is being pinned is that the page
 * asks for the data and shows the failure state at all; a render test would
 * need a Convex client and would pass on a page that never queried.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = join(HERE, "..", "pages", "languages", "languages-page.tsx")
const NAV = join(HERE, "..", "config", "nav-config.ts")

const page = () => readFileSync(PAGE, "utf8")

describe("the languages screen", () => {
  it("asks for the catalogue runs", () => {
    expect(page()).toMatch(/api\.autoTranslate\.listJobs/)
  })

  it("gives them somewhere to be seen", () => {
    // A query whose result is never rendered is the same defect one step along.
    const source = page()
    expect(source).toMatch(/TabsTrigger value="jobs"/)
    expect(source).toMatch(/TabsContent value="jobs"/)
  })

  it("shows the reason a run stopped, in the server's own words", () => {
    // Not a code, and not a second wording invented here: the server's sentence
    // already says what to do — wait for the quota to reset — and two wordings
    // drift.
    expect(page()).toMatch(/\{job\.error\}/)
  })

  it("marks an interrupted run as such rather than reporting a count", () => {
    // "80 / 300" beside nothing else reads as "in progress". The status is the
    // part that distinguishes a run that stopped from one still going.
    const source = page()
    expect(source).toMatch(/Interrompue/)
    expect(source).toMatch(/text-destructive/)
  })

  it("says so when there has never been a run", () => {
    // An empty panel is indistinguishable from a broken one.
    expect(page()).toMatch(/Aucune traduction du catalogue/)
  })

  it("and the nav gate names the resource the screen enforces", () => {
    // `nav-permission-surface.test.ts` requires this in general; pinned here
    // because adding the query is what exposed the mismatch. It changes nobody's
    // access — every role holding `settings:read` holds `translations:read` —
    // but the label and the gate now say the same thing.
    const nav = readFileSync(NAV, "utf8")
    const entry = nav.slice(nav.indexOf('label: "Langues"'))
    expect(entry.slice(0, 400)).toMatch(/requiredPermission: "translations:read"/)
  })
})
