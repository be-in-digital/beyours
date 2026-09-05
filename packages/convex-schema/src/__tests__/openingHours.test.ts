import { describe, it, expect } from "vitest"
import { isWithinBusinessHours, resolveStoreHours } from "../openingHours"
import type { BusinessHours } from "../types"

/**
 * The weekly opening schedule, and the hole it was written to close.
 *
 * Hours were enforced in the browser and nowhere else: `isOrderableStore` reads
 * `status` alone, nothing flips `status` on a schedule, and the only gate was a
 * `toast.error` on the checkout page. A tab left open past closing, a cart
 * restored from localStorage, or a direct call to `orders.create` produced an
 * order and a kitchen ticket at 4 a.m. in an empty building.
 *
 * These cases are the rule itself. That `orders.create` actually asks it is
 * held by `order-opening-hours.test.ts` in each app's own suite.
 */

/** Tuesday 3 July 2029, 12:00 UTC — 14:00 in Paris. */
const TUESDAY_NOON_UTC = Date.UTC(2029, 6, 3, 12, 0, 0)

const week = (
  open: string,
  close: string,
  isClosed = false
): BusinessHours[] =>
  Array.from({ length: 7 }, (_, day) => ({ day, open, close, isClosed }))

describe("resolveStoreHours", () => {
  const globalWeek = week("08:00", "16:00")
  const storeWeek = week("11:00", "23:00")

  it("takes the establishment's own week by default", () => {
    expect(
      resolveStoreHours({ hours: storeWeek }, { hours: globalWeek })
    ).toEqual(storeWeek)
  })

  it("takes the global week when the location follows it", () => {
    expect(
      resolveStoreHours(
        { hours: storeWeek, useGlobalHours: true },
        { hours: globalWeek }
      )
    ).toEqual(globalWeek)
  })

  it("falls back to the location's own when the global week is empty", () => {
    // An owner who ticks "horaires globaux" before anyone writes the global
    // week must not lose the hours the location already has.
    expect(
      resolveStoreHours({ hours: storeWeek, useGlobalHours: true }, { hours: [] })
    ).toEqual(storeWeek)
  })

  it("answers for a missing establishment without throwing", () => {
    expect(resolveStoreHours(null)).toEqual([])
    expect(resolveStoreHours(undefined)).toEqual([])
  })
})

describe("isWithinBusinessHours", () => {
  it("accepts a moment inside the day's service", () => {
    expect(
      isWithinBusinessHours(week("11:00", "14:00"), TUESDAY_NOON_UTC, "Europe/Paris")
    ).toBe(false) // 14:00 Paris is the closing minute
    expect(
      isWithinBusinessHours(week("11:00", "23:00"), TUESDAY_NOON_UTC, "Europe/Paris")
    ).toBe(true)
  })

  it("refuses 04:00 against an 11:00-14:00 service", () => {
    // The probe from the audit: a kitchen ticket at 4 a.m. in an empty
    // building, produced by a tab that had been open since lunch.
    const fourAmParis = Date.UTC(2029, 6, 3, 2, 0, 0)
    expect(
      isWithinBusinessHours(week("11:00", "14:00"), fourAmParis, "Europe/Paris")
    ).toBe(false)
  })

  it("refuses every day the owner marked closed", () => {
    expect(
      isWithinBusinessHours(week("11:00", "23:00", true), TUESDAY_NOON_UTC, "Europe/Paris")
    ).toBe(false)
  })

  it("reads the establishment's clock, not the server's", () => {
    // Convex runs in UTC. 23:30 UTC is 01:30 the next morning in Paris, which
    // is outside a 09:00-22:00 week — and inside it if you read UTC.
    const lateUtc = Date.UTC(2029, 6, 3, 23, 30, 0)
    expect(isWithinBusinessHours(week("09:00", "22:00"), lateUtc)).toBe(false)
    expect(
      isWithinBusinessHours(week("09:00", "23:59"), lateUtc, "Europe/Paris")
    ).toBe(false)
    expect(
      isWithinBusinessHours(week("00:00", "23:59"), lateUtc, "Europe/Paris")
    ).toBe(true)
  })

  it("falls back to UTC for a timezone Intl does not know", () => {
    // A settings row can hold a typo. It must not close the whole shop.
    expect(
      isWithinBusinessHours(week("09:00", "22:00"), TUESDAY_NOON_UTC, "Mars/Olympus")
    ).toBe(true)
  })

  describe("a service that crosses midnight", () => {
    const lateWeek = week("18:00", "02:00")

    it("is open at 23:00", () => {
      const at23 = Date.UTC(2029, 6, 3, 21, 0, 0)
      expect(isWithinBusinessHours(lateWeek, at23, "Europe/Paris")).toBe(true)
    })

    it("is still open at 01:00 the next morning", () => {
      // Wednesday's own row starts at 18:00 and says nothing about this hour;
      // the row that has to answer is Tuesday's.
      const at01 = Date.UTC(2029, 6, 3, 23, 0, 0)
      expect(isWithinBusinessHours(lateWeek, at01, "Europe/Paris")).toBe(true)
    })

    it("is shut at 10:00, between its close and its open", () => {
      const at10 = Date.UTC(2029, 6, 3, 8, 0, 0)
      expect(isWithinBusinessHours(lateWeek, at10, "Europe/Paris")).toBe(false)
    })

    it("does not carry into a day whose own row is the closed one", () => {
      // Monday 18:00-02:00, and nothing else in the week. At 01:00 on Tuesday
      // Monday's service is still running; at 23:00 on Tuesday nothing is.
      const mondayOnly: BusinessHours[] = [
        { day: 1, open: "18:00", close: "02:00", isClosed: false },
      ]
      const tuesday01 = Date.UTC(2029, 6, 2, 23, 0, 0)
      const tuesday23 = Date.UTC(2029, 6, 3, 21, 0, 0)
      expect(isWithinBusinessHours(mondayOnly, tuesday01, "Europe/Paris")).toBe(true)
      expect(isWithinBusinessHours(mondayOnly, tuesday23, "Europe/Paris")).toBe(false)
    })
  })

  describe("an hour written without its leading zero", () => {
    // `parseClockTime` accepts "9:00"; the overnight test used to compare the
    // raw strings, and the two then disagreed about what a time is — in both
    // directions, each with its own outage.

    it("does not turn a 9-to-5 bakery into a 24-hour one", () => {
      // `"17:00" <= "9:00"` is lexicographically true, so this week read as an
      // overnight service: open all evening, and open all night through the
      // previous day's row. An order at 04:00 was accepted.
      const bakery = week("9:00", "17:00")
      const fourAm = Date.UTC(2029, 6, 3, 2, 0, 0)
      const eightPm = Date.UTC(2029, 6, 3, 18, 0, 0)

      expect(isWithinBusinessHours(bakery, fourAm, "Europe/Paris")).toBe(false)
      expect(isWithinBusinessHours(bakery, eightPm, "Europe/Paris")).toBe(false)
      expect(
        isWithinBusinessHours(bakery, Date.UTC(2029, 6, 3, 8, 0, 0), "Europe/Paris")
      ).toBe(true)
    })

    it("does not shut a food truck for the whole of its own service", () => {
      // `"2:00" <= "18:00"` is false, so this read as a same-day window from
      // 18:00 to 02:00 — a window no minute can be inside. The truck could not
      // sell at any hour.
      const truck = week("18:00", "2:00")

      expect(
        isWithinBusinessHours(truck, Date.UTC(2029, 6, 3, 21, 0, 0), "Europe/Paris")
      ).toBe(true)
      expect(
        isWithinBusinessHours(truck, Date.UTC(2029, 6, 3, 23, 0, 0), "Europe/Paris")
      ).toBe(true)
      expect(
        isWithinBusinessHours(truck, Date.UTC(2029, 6, 3, 8, 0, 0), "Europe/Paris")
      ).toBe(false)
    })

    it("trims the same whitespace `parseClockTime` trims", () => {
      const padded = week("11:00", " 14:00")
      expect(
        isWithinBusinessHours(padded, Date.UTC(2029, 6, 3, 2, 0, 0), "Europe/Paris")
      ).toBe(false)
    })
  })

  describe("what it will and will not close the shop over", () => {
    it("does not close it over an empty week — nothing was declared", () => {
      // `status` decides then, and every caller checks it alongside this.
      expect(isWithinBusinessHours([], TUESDAY_NOON_UTC, "Europe/Paris")).toBe(true)
    })

    it("closes it over times no owner could have written", () => {
      // `<input type="time">` cannot produce these, so a row holding one came
      // from a migration, an import or a hand-edited document. Waving it
      // through is the 4 a.m. kitchen ticket this file exists to stop, and the
      // publication rule next door makes the same call: forgetting should hide
      // a restaurant, not let one take orders it cannot honour.
      const nonsense: BusinessHours[] = [
        { day: 2, open: "lunch", close: "dinner", isClosed: false },
        { day: 2, open: "25:00", close: "14:00", isClosed: false },
      ]
      expect(isWithinBusinessHours(nonsense, TUESDAY_NOON_UTC, "Europe/Paris")).toBe(false)
      expect(
        isWithinBusinessHours(
          [{ day: 2, open: "", close: "14:00", isClosed: false }],
          TUESDAY_NOON_UTC,
          "Europe/Paris"
        )
      ).toBe(false)
    })

    it("does not let an unreadable previous day carry into today", () => {
      const hours: BusinessHours[] = [
        { day: 1, open: "18:00", close: "later", isClosed: false },
        { day: 2, open: "11:00", close: "14:00", isClosed: false },
      ]
      // 01:00 on Tuesday: Monday's row cannot say whether it is still serving.
      expect(
        isWithinBusinessHours(hours, Date.UTC(2029, 6, 2, 23, 0, 0), "Europe/Paris")
      ).toBe(false)
    })
  })
})
