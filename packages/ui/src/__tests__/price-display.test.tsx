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

describe("PriceDisplay — nonsense numbers print nothing, not garbage", () => {
  // Each of these was a string the storefront printed next to the price.
  it.each([
    ["Infinity as the original", { amount: 12.5, originalAmount: Infinity }],
    ["Infinity as the amount", { amount: Infinity, originalAmount: 10 }],
    ["NaN as the original", { amount: 12.5, originalAmount: NaN }],
    ["NaN as the amount", { amount: NaN, originalAmount: 10 }],
    ["a negative amount", { amount: -5, originalAmount: 10 }],
    ["-Infinity as the amount", { amount: -Infinity, originalAmount: 10 }],
    ["a negative original", { amount: 12.5, originalAmount: -20 }],
    ["-0 as the original", { amount: 12.5, originalAmount: -0 }],
  ])("shows no discount for %s", (_label, props) => {
    // Scoped to the discount block: a caller who passes NaN as the *amount*
    // still gets "NaN €" as the price, which is their bug, not this one.
    const html = render(props as React.ComponentProps<typeof PriceDisplay>)
    const afterPrice = html.split("</span>").slice(1).join("</span>")
    expect(afterPrice).not.toContain("%")
    expect(afterPrice).not.toContain("NaN")
    expect(afterPrice).not.toContain("Infinity")
    expect(html).not.toContain("line-through")
  })

  it("shows no discount for a markdown that rounds to nothing", () => {
    // 0.4% off printed "-0%", which reads as a promotion and is not one.
    const html = render({ amount: 9.96, originalAmount: 10 })
    expect(html).not.toContain("%")
    expect(html).not.toContain("line-through")
  })

  it("is not fooled by a falsy showDiscount that is a number", () => {
    // The original bug was `{0 && …}` rendering `0`. Hardening only
    // `originalAmount` left the same hole on the other operand of the chain.
    const html = render({
      amount: 10,
      originalAmount: 20,
      showDiscount: 0 as unknown as boolean,
    })
    expect(html).not.toMatch(/<\/span>0/)
    expect(text(html)).toBe("10,00 €")
  })
})

describe("PriceDisplay — the percentage it prints", () => {
  it.each([
    [15, 20, "-25%"],
    [10, 20, "-50%"],
    [20, 30, "-33%"],
    [1, 100, "-99%"],
    [0, 10, "-100%"],
  ])("prints %s off %s as %s", (amount, originalAmount, expected) => {
    expect(text(render({ amount, originalAmount }))).toContain(expected)
  })

  it("shows no discount for a zero or negative original", () => {
    // These printed "-Infinity%" and a double minus before the guard.
    expect(render({ amount: -5, originalAmount: 0 })).not.toContain("%")
    expect(render({ amount: 12.5, originalAmount: -0 })).not.toContain("--")
    expect(render({ amount: 0, originalAmount: 0 })).not.toContain("%")
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
