import { describe, it, expect } from "vitest"
import {
  PUBLISHED_STORE_STATUSES,
  isOrderableStore,
  isPublishedStore,
} from "../storeStatus"

/**
 * The rule that decides whether an establishment is a storefront.
 *
 * `stores.list`, `orders.create` and the storefront redirect all read it, and
 * the bug it exists to prevent is a `draft` restaurant taking a real order.
 */

describe("PUBLISHED_STORE_STATUSES", () => {
  it("does not contain draft", () => {
    expect(PUBLISHED_STORE_STATUSES).not.toContain("draft")
  })

  it("contains the three statuses of a published establishment", () => {
    expect([...PUBLISHED_STORE_STATUSES].sort()).toEqual([
      "closed",
      "open",
      "temporarily_unavailable",
    ])
  })
})

describe("isPublishedStore", () => {
  it.each(["open", "closed", "temporarily_unavailable"])(
    "accepts a %s establishment",
    (status) => {
      expect(isPublishedStore({ status })).toBe(true)
    }
  )

  it("refuses a draft", () => {
    expect(isPublishedStore({ status: "draft" })).toBe(false)
  })

  it("refuses a status it does not recognise", () => {
    // An allow-list, not `!== "draft"`. A status added to the union later stays
    // out of the storefront until someone decides it belongs there — the cost
    // of forgetting is a hidden restaurant, not one taking orders it cannot
    // honour.
    expect(isPublishedStore({ status: "seasonal_popup" })).toBe(false)
  })

  it.each([
    ["a missing status", {}],
    ["an empty status", { status: "" }],
    ["a null status", { status: null }],
    ["a null store", null],
    ["an undefined store", undefined],
  ])("refuses %s", (_label, store) => {
    expect(isPublishedStore(store)).toBe(false)
  })
})

/**
 * The narrower rule: published means listed and readable, orderable means the
 * kitchen is taking orders. `orders.create` checked only the first, so an owner
 * who set "Fermé" or "Indisponible" in the dashboard still received orders —
 * the storefront greyed out the buttons and nothing else stopped anyone.
 */
describe("isOrderableStore", () => {
  it("accepts an open establishment", () => {
    expect(isOrderableStore({ status: "open" })).toBe(true)
  })

  it.each(["closed", "temporarily_unavailable"])(
    "refuses a %s establishment, though it stays published",
    (status) => {
      expect(isPublishedStore({ status })).toBe(true)
      expect(isOrderableStore({ status })).toBe(false)
    }
  )

  it("refuses a draft", () => {
    expect(isOrderableStore({ status: "draft" })).toBe(false)
  })

  it("refuses anything without a recognised status", () => {
    expect(isOrderableStore(null)).toBe(false)
    expect(isOrderableStore(undefined)).toBe(false)
    expect(isOrderableStore({})).toBe(false)
    expect(isOrderableStore({ status: "" })).toBe(false)
  })
})
