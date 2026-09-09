import fs from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"

import { planPrices } from "../convex/planPrices"

/**
 * No page quotes a price the checkout does not charge.
 *
 * `convex/planPrices.ts` calls itself the single source of truth in its own
 * first line, and it is: the Stripe checkout, the superadmin console, the demo
 * seeder and `lib/payment-providers.ts` all read it. `/tarifs` derives its
 * display figures from it through `components/pricing/pricing-data.ts`, which
 * says in as many words "never hard-code an amount back in".
 *
 * `/decouvrir` did exactly that. It printed `3 500 €` and `1 000 €` as literals
 * in the markup and imported `planPrices` zero times — so the page a prospect
 * reads and the amount their card is debited were two independent facts that
 * happened to agree. This is the commercial site: a price that drifts here is a
 * quote we did not honour.
 *
 * Source-reading rather than rendering, deliberately. The claim is about where
 * a number COMES FROM, and a render test passes just as happily on a literal
 * that is currently correct — which is the state this closes.
 */

const SITE = path.join(__dirname, "..")

/** Every page and component under `app/` and `components/`. */
function sourceFiles(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (/\.tsx?$/.test(entry.name)) found.push(full)
    }
  }
  walk(path.join(SITE, "app"))
  walk(path.join(SITE, "components"))
  return found
}

/**
 * Every amount written next to a euro sign in a source file, in cents.
 *
 * Looks BACKWARDS from each `€`, which is what makes this usable: a bare
 * substring search for "100" or "1 000" matches class names, pixel values, z
 * indices and half the Tailwind in the file, and the first draft of this test
 * duly reported forty innocent components. A digit run immediately before a
 * euro sign is a price and is nothing else.
 *
 * The separators are the ones that actually appear in this codebase's French
 * typography: `&nbsp;`, `&#160;`, a literal no-break space, the narrow no-break
 * space `toLocaleString("fr-FR")` emits, and an ordinary one.
 */
const SEPARATOR = String.raw`(?:&nbsp;|&#160;|[\s\u00a0\u202f])`
const QUOTED_PRICE = new RegExp(
  String.raw`(\d(?:\d|${SEPARATOR})*?)${SEPARATOR}*€`,
  "g",
)

function quotedAmountsInCents(source: string): number[] {
  const found: number[] = []

  for (const match of source.matchAll(QUOTED_PRICE)) {
    const digits = match[1]!.replace(/[^\d]/g, "")
    if (!digits) continue
    found.push(Number(digits) * 100)
  }
  return found
}

/**
 * The figures a page presents as an offer's price.
 *
 * The MONTHLY amounts are deliberately not policed. They are 100 € and 200 €,
 * which is also what an illustrative sum looks like — `problem-section.tsx`
 * reads "Sur 100 € de commandes livrées" to explain a platform's commission,
 * and that has nothing to do with maintenance. A guard that fails on it would
 * be deleted within the week, and rightly. The creation and yearly-maintenance
 * figures carry no such collision, and they are the ones printed on an offer
 * card.
 */
const AMOUNTS = [
  ["essentielle creation", planPrices.essentielle.creation],
  ["essentielle maintenanceYearly", planPrices.essentielle.maintenanceYearly],
  ["premium creation", planPrices.premium.creation],
  ["premium maintenanceYearly", planPrices.premium.maintenanceYearly],
] as const

describe("prices a visitor reads", () => {
  const files = sourceFiles()

  test("the sweep found the pages it is meant to read", () => {
    // Guards the guard: a restructure that emptied this list would make every
    // assertion below pass by finding nothing.
    expect(files.length).toBeGreaterThan(20)
    expect(files.some((f) => f.endsWith("decouvrir/page.tsx"))).toBe(true)
  })

  test.each(AMOUNTS)("no page quotes the %s amount as a literal", (_label, cents) => {
    const offenders: string[] = []

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8")
      if (quotedAmountsInCents(source).includes(cents)) {
        offenders.push(path.relative(SITE, file))
      }
    }

    // `pricing-data.ts` is the derivation itself and quotes nothing; every
    // other file must reach a price through it or through `planPrices`.
    expect(offenders).toEqual([])
  })

  test("the discovery page derives its figures from the plan data", () => {
    const source = fs.readFileSync(
      path.join(SITE, "app/(landing)/decouvrir/page.tsx"),
      "utf8",
    )
    expect(source).toContain('from "@/components/pricing/pricing-data"')
    expect(source).toContain("formatPrice(essentielle.creation)")
    expect(source).toContain("formatPrice(essentielle.maintenanceYearly)")
  })
})
