/**
 * The screen and the order path read `useGlobalHours` the same way.
 *
 * WHAT WAS BROKEN. `useGlobalHours` is `v.optional(v.boolean())`, so a store
 * written before the field existed carries no value. The dashboard read that
 * as `?? true` and drew the switch ON; `resolveStoreHours` read it as a falsy
 * `&&` and served the store's own week. An owner could edit the deployment-wide
 * hours, watch the screen confirm this location follows them, and have
 * `orders.create` enforce a different schedule — refusing orders during
 * service, or accepting one at four in the morning.
 *
 * Neither reading was indefensible. Having two was the defect, so the fix is a
 * single function both ends call, and this file is what stops them drifting
 * apart again: it pins the default, and it pins the resolution that depends on
 * it. A test that only checked `resolveStoreHours` would have passed
 * throughout the entire period the two disagreed.
 */

import { describe, expect, it } from "vitest"

import {
  FOLLOWS_GLOBAL_HOURS_BY_DEFAULT,
  followsGlobalHours,
  resolveStoreHours,
} from "../openingHours"
import type { BusinessHours } from "../types"

const OWN: BusinessHours[] = [
  { day: 1, open: "09:00", close: "22:00", isClosed: false },
]
const GLOBAL: BusinessHours[] = [
  { day: 1, open: "11:00", close: "15:00", isClosed: false },
]

describe("followsGlobalHours", () => {
  it("takes the flag at its word when it has been written", () => {
    expect(followsGlobalHours({ useGlobalHours: true })).toBe(true)
    expect(followsGlobalHours({ useGlobalHours: false })).toBe(false)
  })

  it("falls back to the one declared default when it has not", () => {
    // Pinned against the constant rather than against `false`, so changing the
    // product's mind is one edit and this test follows it — while an
    // accidental divergence between the two ends still fails below.
    expect(followsGlobalHours({})).toBe(FOLLOWS_GLOBAL_HOURS_BY_DEFAULT)
    expect(followsGlobalHours({ useGlobalHours: undefined })).toBe(
      FOLLOWS_GLOBAL_HOURS_BY_DEFAULT,
    )
    expect(followsGlobalHours({ useGlobalHours: null })).toBe(
      FOLLOWS_GLOBAL_HOURS_BY_DEFAULT,
    )
    expect(followsGlobalHours(null)).toBe(FOLLOWS_GLOBAL_HOURS_BY_DEFAULT)
    expect(followsGlobalHours(undefined)).toBe(FOLLOWS_GLOBAL_HOURS_BY_DEFAULT)
  })
})

describe("resolveStoreHours agrees with the switch the owner is shown", () => {
  it("serves whichever week `followsGlobalHours` names, for an unwritten flag", () => {
    const store = { hours: OWN }
    const resolved = resolveStoreHours(store, { hours: GLOBAL })

    // The assertion that makes this a drift test rather than a value test:
    // whatever the default is, the hours served must be the ones the screen
    // says are served.
    expect(resolved).toEqual(followsGlobalHours(store) ? GLOBAL : OWN)
  })

  it("serves the deployment-wide week when the flag is on", () => {
    expect(resolveStoreHours({ hours: OWN, useGlobalHours: true }, { hours: GLOBAL })).toEqual(
      GLOBAL,
    )
  })

  it("serves the location's own week when the flag is off", () => {
    expect(resolveStoreHours({ hours: OWN, useGlobalHours: false }, { hours: GLOBAL })).toEqual(
      OWN,
    )
  })

  it("keeps the location's own week when there is no global one to follow", () => {
    // An empty global week is nobody having declared one, not a closure — the
    // guard that was already there and stays.
    expect(resolveStoreHours({ hours: OWN, useGlobalHours: true }, { hours: [] })).toEqual(OWN)
    expect(resolveStoreHours({ hours: OWN, useGlobalHours: true }, null)).toEqual(OWN)
  })
})
