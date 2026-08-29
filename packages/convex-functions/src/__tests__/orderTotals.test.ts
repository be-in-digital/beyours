import { describe, it, expect } from "vitest"
import {
  resolveTaxRatePercent,
  computeOrderTotals,
  taxIncludedIn,
} from "../orderTotals"

describe("resolveTaxRatePercent", () => {
  it("uses the global rate", () => {
    expect(resolveTaxRatePercent({ globalTaxRate: 20 })).toBe(20)
  })

  it("honours an explicit zero — a tax-free establishment is a real case", () => {
    // `?? ` would have fallen through to 0 anyway here, but the point stands:
    // a configured zero is a value, not a missing one.
    expect(resolveTaxRatePercent({ globalTaxRate: 0 })).toBe(0)
  })

  it("falls back to zero when nothing is configured", () => {
    expect(resolveTaxRatePercent({})).toBe(0)
    expect(resolveTaxRatePercent({ globalTaxRate: null })).toBe(0)
  })

  it("ignores a non-finite rate rather than producing NaN totals", () => {
    expect(resolveTaxRatePercent({ globalTaxRate: Number.NaN })).toBe(0)
  })
})

describe("taxIncludedIn", () => {
  it("extracts the tax a tax-inclusive price already contains", () => {
    // 12,00 € TTC at 10 % contains 1,09 € — adding 10 % on top produced 1,20 €
    // and charged 13,20 €.
    expect(taxIncludedIn(1_200, 10)).toBe(109)
    expect(taxIncludedIn(1_200, 20)).toBe(200)
    expect(taxIncludedIn(1_200, 5.5)).toBe(63)
  })

  it("extracts nothing at a zero or absent rate", () => {
    expect(taxIncludedIn(1_200, 0)).toBe(0)
    expect(taxIncludedIn(1_200, Number.NaN)).toBe(0)
  })
})

describe("computeOrderTotals", () => {
  /**
   * The rule the whole regime rests on: the price the owner typed is the price
   * the customer pays. The rate says how much of it is tax, and nothing else.
   */
  it.each([0, 5.5, 10, 20])("charges the displayed price at %p %%", (rate) => {
    const totals = computeOrderTotals({
      subtotal: 2_000,
      taxRatePercent: rate,
      deliveryFee: 490,
      discount: 250,
    })

    expect(totals.total).toBe(2_000 + 490 - 250)
    expect(totals.subtotal).toBe(2_000)
  })

  it("takes the tax out of the price instead of adding it", () => {
    const totals = computeOrderTotals({ subtotal: 2_000, taxRatePercent: 10 })
    expect(totals.taxAmount).toBe(182)
    expect(totals.total).toBe(2_000)
  })

  it("leaves the delivery fee out of the tax base", () => {
    // The courier quotes one amount and no rate is attached to it anywhere in
    // the product.
    const totals = computeOrderTotals({
      subtotal: 10_000,
      taxRatePercent: 10,
      deliveryFee: 500,
    })
    expect(totals.taxAmount).toBe(909)
    expect(totals.total).toBe(10_500)
  })

  it("subtracts the discount from what is charged", () => {
    const totals = computeOrderTotals({
      subtotal: 10_000,
      taxRatePercent: 10,
      deliveryFee: 500,
      discount: 1_000,
    })
    expect(totals.total).toBe(9_500)
  })

  it("never goes below zero", () => {
    const totals = computeOrderTotals({
      subtotal: 1_000,
      taxRatePercent: 0,
      discount: 99_999,
    })
    expect(totals.total).toBe(0)
  })

  it("charges no tax at a zero rate", () => {
    const totals = computeOrderTotals({ subtotal: 5_000, taxRatePercent: 0 })
    expect(totals.taxAmount).toBe(0)
    expect(totals.taxBreakdown).toEqual([])
    expect(totals.total).toBe(5_000)
  })

  describe("a basket that mixes rates", () => {
    // A menu at 10 % and a bottle of wine at 20 % — inexpressible with one rate
    // over the basket, which is what every order used until now.
    const lines = [
      { subtotal: 2_400, taxRatePercent: 10 },
      { subtotal: 1_800, taxRatePercent: 20 },
      { subtotal: 1_200, taxRatePercent: 10 },
    ]

    it("declares each rate separately", () => {
      const totals = computeOrderTotals({
        subtotal: 5_400,
        taxRatePercent: 10,
        lines,
      })

      expect(totals.taxBreakdown).toEqual([
        { ratePercent: 10, grossAmount: 3_600, taxAmount: 327 },
        { ratePercent: 20, grossAmount: 1_800, taxAmount: 300 },
      ])
      expect(totals.taxAmount).toBe(627)
    })

    it("still charges exactly the sum of the lines", () => {
      const totals = computeOrderTotals({
        subtotal: 5_400,
        taxRatePercent: 10,
        lines,
        deliveryFee: 490,
      })
      expect(totals.total).toBe(5_890)
    })

    it("rounds once per rate, not once per line", () => {
      // Three lines at 10 %: 3 × 1 200 rounds to 327, where rounding each line
      // and summing would give 3 × 109 = 327 here but drifts on other amounts.
      const totals = computeOrderTotals({
        subtotal: 3_600,
        taxRatePercent: 10,
        lines: [
          { subtotal: 1_200, taxRatePercent: 10 },
          { subtotal: 1_200, taxRatePercent: 10 },
          { subtotal: 1_200, taxRatePercent: 10 },
        ],
      })
      expect(totals.taxBreakdown).toHaveLength(1)
      expect(totals.taxAmount).toBe(taxIncludedIn(3_600, 10))
    })

    it("falls back to the single rate when no line carries one", () => {
      const totals = computeOrderTotals({ subtotal: 5_400, taxRatePercent: 20 })
      expect(totals.taxBreakdown).toEqual([
        { ratePercent: 20, grossAmount: 5_400, taxAmount: 900 },
      ])
    })
  })

  it("returns every component so a summary can itemise what it displays", () => {
    expect(
      computeOrderTotals({
        subtotal: 10_000,
        taxRatePercent: 20,
        deliveryFee: 490,
        discount: 250,
      })
    ).toEqual({
      subtotal: 10_000,
      taxAmount: 1_667,
      taxBreakdown: [{ ratePercent: 20, grossAmount: 10_000, taxAmount: 1_667 }],
      deliveryFee: 490,
      discount: 250,
      total: 10_240,
    })
  })
})
