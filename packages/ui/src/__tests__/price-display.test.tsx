/**
 * PriceDisplay must not print a stray `0` next to the price.
 *
 * The discount guard read `showDiscount && originalAmount && originalAmount >
 * amount`. With `originalAmount={0}` that whole expression evaluates to the
 * *number* `0`, and JSX renders `{0 && …}` as a literal `0` — so a dish with a
 * zero original amount showed "12,50 €0" on the storefront.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PriceDisplay } from "../components/restaurant/PriceDisplay"

function render(props: React.ComponentProps<typeof PriceDisplay>) {
  return renderToStaticMarkup(<PriceDisplay {...props} />)
}

/**
 * Strip tags so assertions read the text a diner sees, and fold the Unicode
 * spaces `Intl.NumberFormat("fr-FR")` emits — U+202F before the euro sign and
 * as the thousands separator — onto a plain space, so the expectations below
 * stay readable.
 */
function text(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/[\u00a0\u202f\u2009]/g, " ")
}

describe("PriceDisplay — the falsy-number guard", () => {
  it("prints no stray digit for originalAmount={0}", () => {
    const html = render({ amount: 12.5, originalAmount: 0 })
    expect(html).not.toMatch(/<\/span>0/)
    expect(text(html)).toBe("12,50 €")
  })

  it("prints no stray digit when the original equals the amount", () => {
    expect(text(render({ amount: 12.5, originalAmount: 12.5 }))).toBe("12,50 €")
  })

  it("prints no stray digit when the original is lower than the amount", () => {
    expect(text(render({ amount: 12.5, originalAmount: 9 }))).toBe("12,50 €")
  })

  it("prints no stray digit with no original amount at all", () => {
    expect(text(render({ amount: 12.5 }))).toBe("12,50 €")
  })

  it("prints no stray digit when discounts are switched off", () => {
    const html = render({ amount: 10, originalAmount: 20, showDiscount: false })
    expect(text(html)).toBe("10,00 €")
  })
})

describe("PriceDisplay — a genuine discount", () => {
  it("still shows the original price and the percentage", () => {
    const shown = text(render({ amount: 15, originalAmount: 20 }))
    expect(shown).toContain("15,00 €")
    expect(shown).toContain("20,00 €")
    expect(shown).toContain("-25%")
  })

  it("formats in fr-FR by default", () => {
    expect(text(render({ amount: 1234.5 }))).toBe("1 234,50 €")
  })

  it("honours a currency symbol override", () => {
    expect(text(render({ amount: 12.5, currencySymbol: "$" }))).toBe("$12.50")
  })
})
