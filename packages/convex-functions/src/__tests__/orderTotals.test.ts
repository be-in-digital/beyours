import { describe, it, expect } from "vitest"
import { resolveTaxRatePercent, computeOrderTotals } from "../orderTotals"

describe("resolveTaxRatePercent", () => {
  it("prefers the store rate over the global one", () => {
    expect(resolveTaxRatePercent({ storeTaxRate: 5, globalTaxRate: 20 })).toBe(5)
  })

  it("honours an explicit zero on the store — a tax-free store is a real case", () => {
    // `?? ` would have fallen through to the global rate here and taxed a store
    // that is configured not to be taxed.
    expect(resolveTaxRatePercent({ storeTaxRate: 0, globalTaxRate: 20 })).toBe(0)
  })

  it("falls back to the global rate when the store has none", () => {
    expect(resolveTaxRatePercent({ globalTaxRate: 20 })).toBe(20)
    expect(resolveTaxRatePercent({ storeTaxRate: null, globalTaxRate: 20 })).toBe(20)
  })

  it("falls back to zero when nothing is configured", () => {
    expect(resolveTaxRatePercent({})).toBe(0)
    expect(resolveTaxRatePercent({ storeTaxRate: null, globalTaxRate: null })).toBe(0)
  })

  it("ignores a non-finite rate rather than producing NaN totals", () => {
    expect(resolveTaxRatePercent({ storeTaxRate: Number.NaN, globalTaxRate: 20 })).toBe(20)
  })
})

describe("computeOrderTotals", () => {
  it("adds tax to the subtotal", () => {
    const totals = computeOrderTotals({ subtotal: 2_000, taxRatePercent: 10 })
    expect(totals.taxAmount).toBe(200)
    expect(totals.total).toBe(2_200)
  })

  it("reproduces the mismatch the storefront used to display", () => {
    // The summary showed 2 000 under "Taxes incluses"; the server charged 2 200.
    const totals = computeOrderTotals({ subtotal: 2_000, taxRatePercent: 10 })
    expect(totals.total).not.toBe(2_000)
    expect(totals.total).toBe(2_200)
  })

  it("taxes the goods only, never the delivery fee", () => {
    const totals = computeOrderTotals({
      subtotal: 10_000,
      taxRatePercent: 10,
      deliveryFee: 500,
    })
    expect(totals.taxAmount).toBe(1_000)
    expect(totals.total).toBe(11_500)
  })

  it("subtracts the discount after tax", () => {
    const totals = computeOrderTotals({
      subtotal: 10_000,
      taxRatePercent: 10,
      deliveryFee: 500,
      discount: 1_000,
    })
    expect(totals.total).toBe(10_500)
  })

  it("never goes below zero", () => {
    const totals = computeOrderTotals({
      subtotal: 1_000,
      taxRatePercent: 0,
      discount: 99_999,
    })
    expect(totals.total).toBe(0)
  })

  it("rounds tax to the nearest cent", () => {
    // 3 333 * 5.5% = 183.315
    expect(computeOrderTotals({ subtotal: 3_333, taxRatePercent: 5.5 }).taxAmount).toBe(183)
    // 3 333 * 10% = 333.3
    expect(computeOrderTotals({ subtotal: 3_333, taxRatePercent: 10 }).taxAmount).toBe(333)
  })

  it("charges no tax at a zero rate", () => {
    const totals = computeOrderTotals({ subtotal: 5_000, taxRatePercent: 0 })
    expect(totals.taxAmount).toBe(0)
    expect(totals.total).toBe(5_000)
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
      taxAmount: 2_000,
      deliveryFee: 490,
      discount: 250,
      total: 12_240,
    })
  })
})
