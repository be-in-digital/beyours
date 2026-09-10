/**
 * Which clock the kitchen is read on when nothing has said.
 *
 * WHAT WAS BROKEN. `restaurantClock` fell back to `getUTCDay()` /
 * `getUTCHours()` whenever `timezone` was absent. `timezone` comes from
 * `globalSettings.timezone`, and `globalSettings` is a singleton the team
 * writes — nothing seeds it — so a deployment whose settings have never been
 * saved passed `undefined` from every call site and had its opening hours,
 * its dish schedules and its happy hours all enforced on the server clock.
 *
 * Measured on the order path, a store open 11:00–14:00 with no settings row:
 * an order at 14:30 Paris was accepted and written to the kitchen, and one at
 * 11:30 Paris was refused `outside_opening_hours`. Two hours of every summer
 * day taking orders after closing and refusing them during service.
 *
 * Nothing could see it: every case in `order-opening-hours.test.ts` seeded the
 * settings row, which is the one thing that hides it. So the default is pinned
 * HERE, next to the function that applies it, rather than left to be inferred
 * from a fixture.
 *
 * The offsets below are the point of the assertions, so they are chosen where
 * UTC and Paris disagree by a known amount: 3 July is CEST, UTC+2.
 */

import { describe, expect, it } from "vitest"

import {
  DEFAULT_RESTAURANT_TIMEZONE,
  isWithinWindow,
  restaurantClock,
} from "../timeWindow"

/** Tuesday 3 July 2029, 12:30 UTC — 14:30 in Paris (CEST, UTC+2). */
const TUESDAY_1230_UTC = Date.UTC(2029, 6, 3, 12, 30, 0)
/** Tuesday 3 July 2029, 23:30 UTC — 01:30 on WEDNESDAY in Paris. */
const TUESDAY_2330_UTC = Date.UTC(2029, 6, 3, 23, 30, 0)

const at = (clock: { day: number; minutes: number }) =>
  `${clock.day}/${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(
    clock.minutes % 60,
  ).padStart(2, "0")}`

describe("the default clock", () => {
  it("is the one a French établissement keeps", () => {
    // Pinned as a value, not only through behaviour: this is a product
    // decision, and a reader should find it stated rather than deduced.
    expect(DEFAULT_RESTAURANT_TIMEZONE).toBe("Europe/Paris")
  })

  it("is used when no timezone is given at all", () => {
    // The `globalSettings`-less deployment. Was 2/12:30 — the server's.
    expect(at(restaurantClock(TUESDAY_1230_UTC))).toBe("2/14:30")
  })

  it("is used when the timezone is an empty string", () => {
    // A settings row saved with the field cleared reaches here as `""`, which
    // is falsy and took the same path as `undefined`.
    expect(at(restaurantClock(TUESDAY_1230_UTC, ""))).toBe("2/14:30")
  })

  it("is used when Intl refuses the timezone", () => {
    // A settings row holding a typo must not close the whole catalogue — the
    // reason the old fallback existed. It now fails to the product's clock
    // rather than to the server's.
    expect(at(restaurantClock(TUESDAY_1230_UTC, "Europe/Pariss"))).toBe("2/14:30")
  })

  it("carries the day across midnight, not just the hour", () => {
    // 23:30 UTC on Tuesday is 01:30 on WEDNESDAY in Paris. A default that got
    // the hour right and the day wrong would serve Tuesday's menu.
    expect(at(restaurantClock(TUESDAY_2330_UTC))).toBe("3/01:30")
  })

  it("never overrides a timezone that was given", () => {
    // The default is the absence of an answer, not a policy. A deployment that
    // has set its timezone is unaffected.
    expect(at(restaurantClock(TUESDAY_1230_UTC, "UTC"))).toBe("2/12:30")
    expect(at(restaurantClock(TUESDAY_1230_UTC, "America/New_York"))).toBe("2/08:30")
    expect(at(restaurantClock(TUESDAY_1230_UTC, "Asia/Tokyo"))).toBe("2/21:30")
  })
})

describe("what the default changes for a window", () => {
  const LUNCH = { from: "11:00", until: "14:00" }

  it("closes a lunch service that the server clock still called open", () => {
    // 12:30 UTC is 14:30 Paris — closed. This is the accepted-after-closing
    // half of the measurement above.
    expect(isWithinWindow(LUNCH, TUESDAY_1230_UTC)).toBe(false)
  })

  it("opens a lunch service that the server clock called shut", () => {
    // 09:30 UTC is 11:30 Paris — open. This is the refused-during-service half.
    expect(isWithinWindow(LUNCH, Date.UTC(2029, 6, 3, 9, 30, 0))).toBe(true)
  })

  it("still serves an overnight window on the right day", () => {
    // A Tuesday-only 22:00–02:00 late menu, at 01:30 Wednesday Paris. The
    // served day is the one that started the evening before.
    const LATE = { days: [2], from: "22:00", until: "02:00" }
    expect(isWithinWindow(LATE, TUESDAY_2330_UTC)).toBe(true)
  })
})
