import { describe, expect, test } from "vitest"
import {
  CATCH_UP_WINDOW_HOURS,
  buildIdempotencyKey,
  dueSlots,
  getLocalParts,
  isDue,
  slotKey,
  themeForSlot,
  type ScheduleConfig,
} from "../blogAutoSchedule"

/**
 * The scheduling rule Auto Blog was sold on and never had.
 *
 * The interesting cases are all about the timezone: the owner picks an hour in
 * their own wall clock, the cron fires in UTC, and the gap between the two
 * moves twice a year.
 */

const weekly = (over: Partial<ScheduleConfig> = {}): ScheduleConfig => ({
  frequency: "weekly",
  preferredWeekdays: [2], // Tuesday
  preferredHour: 9,
  timezone: "Europe/Paris",
  ...over,
})

describe("getLocalParts", () => {
  test("reads an instant as the configuration's own wall clock", () => {
    // 07:00Z in July is 09:00 in Paris (CEST, UTC+2).
    const local = getLocalParts(Date.parse("2026-07-07T07:00:00Z"), "Europe/Paris")
    expect(local).toEqual({ year: 2026, month: 7, day: 7, hour: 9, weekday: 2 })
  })

  test("follows the summer-time shift rather than a fixed offset", () => {
    // The same 07:00Z in January is 08:00 in Paris (CET, UTC+1).
    const winter = getLocalParts(Date.parse("2026-01-06T07:00:00Z"), "Europe/Paris")
    expect(winter.hour).toBe(8)
  })

  test("renders local midnight as hour 0, not 24", () => {
    const local = getLocalParts(Date.parse("2026-07-06T22:00:00Z"), "Europe/Paris")
    expect(local.hour).toBe(0)
    expect(local.day).toBe(7)
  })

  test("falls back to UTC for a zone name that is not one", () => {
    const local = getLocalParts(Date.parse("2026-07-07T07:00:00Z"), "Mars/Olympus")
    expect(local.hour).toBe(7)
  })
})

describe("isDue", () => {
  test("fires on the configured weekday at the configured local hour", () => {
    expect(isDue(weekly(), Date.parse("2026-07-07T07:00:00Z"))).toBe(true)
  })

  test("does not fire an hour early", () => {
    expect(isDue(weekly(), Date.parse("2026-07-07T06:00:00Z"))).toBe(false)
  })

  test("does not fire on another weekday", () => {
    expect(isDue(weekly(), Date.parse("2026-07-08T07:00:00Z"))).toBe(false)
  })

  test("still fires at 09:00 local once the clocks have gone back", () => {
    // 08:00Z is 09:00 in Paris in January. Tuesday 6 January 2026.
    expect(isDue(weekly(), Date.parse("2026-01-06T08:00:00Z"))).toBe(true)
    expect(isDue(weekly(), Date.parse("2026-01-06T07:00:00Z"))).toBe(false)
  })

  test("honours several weekdays", () => {
    const config = weekly({ preferredWeekdays: [1, 4] })
    expect(isDue(config, Date.parse("2026-07-06T07:00:00Z"))).toBe(true) // Monday
    expect(isDue(config, Date.parse("2026-07-09T07:00:00Z"))).toBe(true) // Thursday
    expect(isDue(config, Date.parse("2026-07-07T07:00:00Z"))).toBe(false)
  })

  test("monthly fires on the day of the month, not the weekday", () => {
    const config: ScheduleConfig = {
      frequency: "monthly",
      preferredMonthDays: [15],
      preferredHour: 9,
      timezone: "Europe/Paris",
    }
    expect(isDue(config, Date.parse("2026-07-15T07:00:00Z"))).toBe(true)
    expect(isDue(config, Date.parse("2026-07-16T07:00:00Z"))).toBe(false)
  })

  test("a configuration with no days chosen is never due", () => {
    expect(isDue(weekly({ preferredWeekdays: [] }), Date.parse("2026-07-07T07:00:00Z"))).toBe(false)
    expect(isDue(weekly({ preferredWeekdays: undefined }), Date.parse("2026-07-07T07:00:00Z"))).toBe(false)
  })

  test("a timezone far from UTC gets its own local hour", () => {
    const config = weekly({ timezone: "Pacific/Auckland", preferredWeekdays: [2] })
    // 21:00Z Monday is 09:00 Tuesday in Auckland (NZST, UTC+12).
    expect(isDue(config, Date.parse("2026-07-06T21:00:00Z"))).toBe(true)
  })
})

describe("slotKey and buildIdempotencyKey", () => {
  test("two sweeps of the same hour name the same slot", () => {
    const a = slotKey(getLocalParts(Date.parse("2026-07-07T07:00:00Z"), "Europe/Paris"))
    const b = slotKey(getLocalParts(Date.parse("2026-07-07T07:59:59Z"), "Europe/Paris"))
    expect(a).toBe("2026-07-07T09")
    expect(b).toBe(a)
  })

  test("the next hour is a different slot", () => {
    const a = slotKey(getLocalParts(Date.parse("2026-07-07T07:00:00Z"), "Europe/Paris"))
    const b = slotKey(getLocalParts(Date.parse("2026-07-07T08:00:00Z"), "Europe/Paris"))
    expect(b).not.toBe(a)
  })

  test("the key is scoped to one establishment", () => {
    expect(buildIdempotencyKey("store_a", "2026-07-07T09")).toBe("store_a:2026-07-07T09")
    expect(buildIdempotencyKey("store_b", "2026-07-07T09")).not.toBe(
      buildIdempotencyKey("store_a", "2026-07-07T09"),
    )
  })

  test("the theme is not part of the key, so an edit cannot double-queue a slot", () => {
    const key = buildIdempotencyKey("store_a", "2026-07-07T09")
    expect(key).not.toContain("theme")
  })
})

describe("themeForSlot", () => {
  test("rotates through the list on consecutive days", () => {
    const themes = ["desserts", "vins", "saison"]
    const days = [5, 6, 7, 8].map((d) =>
      themeForSlot(themes, getLocalParts(Date.parse(`2026-07-0${d}T09:00:00Z`), "UTC")),
    )
    expect(new Set(days.slice(0, 3)).size).toBe(3)
    expect(days[3]).toBe(days[0])
  })

  test("a replanned slot chooses the same theme", () => {
    const themes = ["desserts", "vins"]
    const local = getLocalParts(Date.parse("2026-07-07T09:00:00Z"), "UTC")
    expect(themeForSlot(themes, local)).toBe(themeForSlot(themes, local))
  })

  test("no themes means nothing to write about", () => {
    expect(themeForSlot([], getLocalParts(Date.now(), "UTC"))).toBeNull()
  })

  test("a single theme is always the answer", () => {
    const local = getLocalParts(Date.parse("2026-07-07T09:00:00Z"), "UTC")
    expect(themeForSlot(["desserts"], local)).toBe("desserts")
  })
})

describe("summer time", () => {
  /**
   * Europe/Paris, 25 October 2026: the clocks go back at 03:00, so 02:00 local
   * happens twice — at 00:00Z (CEST) and again at 01:00Z (CET).
   */
  const config: ScheduleConfig = {
    frequency: "monthly",
    preferredMonthDays: [25],
    preferredHour: 2,
    timezone: "Europe/Paris",
  }

  test("an hour that occurs twice is due both times", () => {
    expect(isDue(config, Date.parse("2026-10-25T00:00:00Z"))).toBe(true)
    expect(isDue(config, Date.parse("2026-10-25T01:00:00Z"))).toBe(true)
  })

  test("...but it is one slot, so only one article is ever queued for it", () => {
    const first = slotKey(getLocalParts(Date.parse("2026-10-25T00:00:00Z"), "Europe/Paris"))
    const second = slotKey(getLocalParts(Date.parse("2026-10-25T01:00:00Z"), "Europe/Paris"))
    expect(first).toBe("2026-10-25T02")
    expect(second).toBe(first)
  })

  /**
   * 29 March 2026: the clocks go forward at 02:00, so 02:00 local never
   * happens. Pinned as the known gap rather than asserted as correct — an owner
   * who picked that exact hour loses one article a year.
   */
  test("an hour the clocks skip is never due, which is the one gap", () => {
    const hours = Array.from({ length: 24 }, (_, h) =>
      getLocalParts(Date.parse(`2026-03-29T${String(h).padStart(2, "0")}:00:00Z`), "Europe/Paris").hour,
    )
    expect(hours).not.toContain(2)
    expect(isDue({ ...config, preferredMonthDays: [29] }, Date.parse("2026-03-29T01:00:00Z"))).toBe(false)
  })
})

describe("the deprecated single-day fields", () => {
  /**
   * The schema still declares `preferredWeekday` and `preferredMonthDay`, and
   * still holds them for configurations saved before the multi-day pickers.
   * Reading only the plural fields meant every one of those rows was silently
   * never due: not queued, not skipped, not reported.
   */
  test("a weekly config saved in the old shape is still due", () => {
    const legacy: ScheduleConfig = {
      frequency: "weekly",
      preferredWeekday: 2,
      preferredHour: 9,
      timezone: "Europe/Paris",
    }
    expect(isDue(legacy, Date.parse("2026-07-07T07:00:00Z"))).toBe(true)
    expect(isDue(legacy, Date.parse("2026-07-08T07:00:00Z"))).toBe(false)
  })

  test("a monthly config saved in the old shape is still due", () => {
    const legacy: ScheduleConfig = {
      frequency: "monthly",
      preferredMonthDay: 15,
      preferredHour: 9,
      timezone: "Europe/Paris",
    }
    expect(isDue(legacy, Date.parse("2026-07-15T07:00:00Z"))).toBe(true)
    expect(isDue(legacy, Date.parse("2026-07-16T07:00:00Z"))).toBe(false)
  })

  test("the new shape wins when a row carries both", () => {
    const both: ScheduleConfig = {
      frequency: "weekly",
      preferredWeekday: 5,
      preferredWeekdays: [2],
      preferredHour: 9,
      timezone: "Europe/Paris",
    }
    expect(isDue(both, Date.parse("2026-07-07T07:00:00Z"))).toBe(true)
    expect(isDue(both, Date.parse("2026-07-10T07:00:00Z"))).toBe(false)
  })
})

describe("dueSlots", () => {
  const weeklyTuesday: ScheduleConfig = {
    frequency: "weekly",
    preferredWeekdays: [2],
    preferredHour: 9,
    timezone: "Europe/Paris",
  }

  test("names the current slot when the hour has just arrived", () => {
    const slots = dueSlots(weeklyTuesday, Date.parse("2026-07-07T07:00:00Z"))
    expect(slots.map(slotKey)).toEqual(["2026-07-07T09"])
  })

  test("still names it three hours late, so a missed sweep is recoverable", () => {
    const slots = dueSlots(weeklyTuesday, Date.parse("2026-07-07T10:00:00Z"))
    expect(slots.map(slotKey)).toEqual(["2026-07-07T09"])
  })

  test("gives up once the window has passed, rather than posting yesterday's article", () => {
    const late = Date.parse("2026-07-07T07:00:00Z") + (CATCH_UP_WINDOW_HOURS + 1) * 3_600_000
    expect(dueSlots(weeklyTuesday, late)).toEqual([])
  })

  test("names nothing on a day the configuration does not want", () => {
    expect(dueSlots(weeklyTuesday, Date.parse("2026-07-08T07:00:00Z"))).toEqual([])
  })

  test("a configuration due every day inside the window names each missed hour once", () => {
    const hourly: ScheduleConfig = {
      frequency: "weekly",
      preferredWeekdays: [0, 1, 2, 3, 4, 5, 6],
      preferredHour: 9,
      timezone: "UTC",
    }
    const slots = dueSlots(hourly, Date.parse("2026-07-07T09:00:00Z"))
    expect(slots.map(slotKey)).toEqual(["2026-07-07T09"])
  })
})
