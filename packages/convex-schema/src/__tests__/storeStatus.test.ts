import { describe, it, expect } from "vitest"
import { PUBLISHED_STORE_STATUSES, isPublishedStore } from "../storeStatus"

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
