import { describe, it, expect } from "vitest"
import { stockPatch } from "../products"

/**
 * What a product's stock counter becomes, and whether that switches it off.
 *
 * The auto-disable rule lived inline in `updateStock`'s handler, so it only ran
 * when an owner retyped the number in the Inventaire screen. `orders.create`
 * now sells stock too — the decrement that never existed — and a dish that runs
 * out has to come off the menu whichever of the two took the last portion.
 */

const tracked = (over: Record<string, unknown> = {}) => ({
  stock: {
    tracked: true,
    quantity: 5,
    lowStockThreshold: 2,
    ...over,
  },
  isActive: true,
})

describe("stockPatch", () => {
  it("writes the new quantity and keeps the rest of the counter", () => {
    const patch = stockPatch(tracked(), 3)
    expect(patch.stock).toEqual({
      tracked: true,
      quantity: 3,
      lowStockThreshold: 2,
    })
  })

  it("leaves isActive alone when the owner did not ask for auto-disable", () => {
    expect(stockPatch(tracked(), 0).isActive).toBeUndefined()
  })

  it("takes the dish off the menu when it empties", () => {
    const patch = stockPatch(tracked({ autoDisableWhenEmpty: true }), 0)
    expect(patch.isActive).toBe(false)
  })

  it("puts it back when it is restocked", () => {
    const patch = stockPatch(
      { stock: { tracked: true, quantity: 0, lowStockThreshold: 2, autoDisableWhenEmpty: true }, isActive: false },
      4
    )
    expect(patch.isActive).toBe(true)
  })

  it("does not toggle a product that is already in the right state", () => {
    // A patch that sets `isActive` to what it already is would be a write for
    // nothing, and on the order path it is a write per line.
    expect(stockPatch(tracked({ autoDisableWhenEmpty: true }), 3).isActive).toBeUndefined()
    expect(
      stockPatch(
        { stock: { tracked: true, quantity: 0, lowStockThreshold: 0, autoDisableWhenEmpty: true }, isActive: false },
        0
      ).isActive
    ).toBeUndefined()
  })

  it("keeps autoDisableWhenEmpty on the document", () => {
    const patch = stockPatch(tracked({ autoDisableWhenEmpty: true }), 1)
    expect(patch.stock.autoDisableWhenEmpty).toBe(true)
  })
})
