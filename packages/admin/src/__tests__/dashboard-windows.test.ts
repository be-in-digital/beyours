/**
 * The half of the dashboard that stayed in the browser.
 *
 * The aggregation moved to the server when `/dashboard` stopped subscribing to
 * every order the establishment had ever taken. Two things could not move with
 * it: the day boundaries, because "today" is the restaurant's day and only the
 * browser knows which timezone that is, and the French labels, because the
 * server has no business knowing them. Both are pure, and this is what holds
 * them.
 */

import { describe, it, expect } from "vitest"
import {
  dashboardBreakdownSince,
  dashboardDayStarts,
  dashboardTodayEnd,
  labelDashboardStats,
  DASHBOARD_BREAKDOWN_DAYS,
  DASHBOARD_CHART_DAYS,
} from "../pages/dashboard/use-dashboard-stats"

const DAY = 24 * 60 * 60 * 1000

describe("dashboardDayStarts", () => {
  it("returns one boundary per bar of the chart, oldest first", () => {
    const starts = dashboardDayStarts(new Date("2026-03-15T14:32:11"))
    expect(starts).toHaveLength(DASHBOARD_CHART_DAYS)
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]!).toBeGreaterThan(starts[i - 1]!)
    }
  })

  it("puts today's local midnight last, whatever time of day it is asked", () => {
    const midnight = dashboardDayStarts(new Date("2026-03-15T23:59:59")).at(-1)
    const earlier = dashboardDayStarts(new Date("2026-03-15T00:00:01")).at(-1)
    expect(midnight).toBe(earlier)

    const asDate = new Date(midnight!)
    expect(asDate.getHours()).toBe(0)
    expect(asDate.getMinutes()).toBe(0)
    expect(asDate.getSeconds()).toBe(0)
    expect(asDate.getMilliseconds()).toBe(0)
  })

  it("walks the calendar rather than subtracting fixed 24-hour blocks", () => {
    // Every boundary is a local midnight. On a DST changeover one of the gaps
    // is 23 or 25 hours, and a boundary derived by subtracting 24h would land
    // at 23:00 or 01:00 and put a whole service in the wrong bar.
    for (const start of dashboardDayStarts(new Date("2026-11-01T12:00:00"))) {
      expect(new Date(start).getHours()).toBe(0)
    }
  })

  it("puts yesterday's midnight immediately before today's", () => {
    const starts = dashboardDayStarts(new Date("2026-03-15T10:00:00"))
    const [yesterday, today] = [starts.at(-2)!, starts.at(-1)!]
    expect(new Date(yesterday).getDate()).toBe(new Date(today).getDate() - 1)
  })
})

describe("dashboardTodayEnd", () => {
  it("is the midnight after today's, so today has an upper bound", () => {
    const now = new Date("2026-03-15T22:10:00")
    const todayStart = dashboardDayStarts(now).at(-1)!
    const end = dashboardTodayEnd(now)
    expect(end).toBeGreaterThan(todayStart)
    expect(new Date(end).getHours()).toBe(0)
    expect(new Date(end).getDate()).toBe(new Date(todayStart).getDate() + 1)
  })

  it("walks the calendar across a DST changeover rather than adding 24 hours", () => {
    // 25 October 2026 is the European autumn changeover. Whatever the offset
    // does, the boundary is still a local midnight.
    expect(new Date(dashboardTodayEnd(new Date("2026-10-24T12:00:00"))).getHours()).toBe(0)
    expect(new Date(dashboardTodayEnd(new Date("2026-10-25T12:00:00"))).getHours()).toBe(0)
  })
})

describe("dashboardBreakdownSince", () => {
  it("reaches back further than the chart does", () => {
    const now = new Date("2026-03-15T10:00:00")
    expect(dashboardBreakdownSince(now)).toBeLessThan(dashboardDayStarts(now)[0]!)
  })

  it("is a local midnight thirty days back", () => {
    const now = new Date("2026-03-15T10:00:00")
    const since = dashboardBreakdownSince(now)
    expect(new Date(since).getHours()).toBe(0)
    const todayStart = dashboardDayStarts(now).at(-1)!
    // Within an hour of thirty days, allowing for a DST changeover in between.
    expect(Math.abs(todayStart - since - DASHBOARD_BREAKDOWN_DAYS * DAY)).toBeLessThanOrEqual(
      60 * 60 * 1000
    )
  })
})

describe("labelDashboardStats", () => {
  const server = {
    // `revenue` is money COLLECTED and `orderCount` is orders PLACED, so the
    // two are over different sets and `uncollected` is the difference: three
    // orders today, two of them paid for.
    today: {
      revenue: 3_000,
      orderCount: 3,
      averageBasket: 1_500,
      collectedOrderCount: 2,
      uncollected: 900,
      activeOrders: 1,
    },
    yesterday: {
      revenue: 1_000,
      orderCount: 1,
      averageBasket: 1_000,
      collectedOrderCount: 1,
      uncollected: 0,
    },
    days: [
      // A Monday and the Tuesday after it, as local midnights.
      { dayStart: new Date("2026-03-16T00:00:00").getTime(), revenue: 100, orders: 1 },
      { dayStart: new Date("2026-03-17T00:00:00").getTime(), revenue: 200, orders: 2 },
    ],
    byType: [{ name: "delivery", value: 3 }],
    bySource: [{ name: "uber_eats", value: 2 }],
    topProducts: [
      { productId: "p1", name: "Margherita", quantity: 4, revenue: 4_800, orderCount: 3 },
    ],
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 })),
    diners: {
      identified: 3,
      returning: 1,
      newcomers: 2,
      returningRate: 1 / 3,
      anonymousOrders: 1,
    },
    truncated: false,
  }

  it("names each bar after its own weekday", () => {
    const labelled = labelDashboardStats(server)
    expect(labelled.days.map((day) => day.day)).toEqual(["Lun", "Mar"])
    expect(labelled.days.map((day) => day.revenue)).toEqual([100, 200])
  })

  it("numbers the bars instead when the period is longer than a week", () => {
    // Seven weekday names read cleanly; thirty repeat each name four times, and
    // a reader cannot tell which "Mar" is which.
    const march = (day: number) =>
      new Date(`2026-03-${String(day).padStart(2, "0")}T00:00:00`).getTime()
    const labelled = labelDashboardStats({
      ...server,
      days: Array.from({ length: 8 }, (_, index) => ({
        dayStart: march(index + 1),
        revenue: 0,
        orders: 0,
      })),
    })
    expect(labelled.days.map((day) => day.day)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8",
    ])
  })

  it("carries the three new metrics through unchanged", () => {
    // They need no labelling — a dish name is the establishment's own, an hour
    // is a number, and a rate is a rate. Carried rather than recomputed.
    const labelled = labelDashboardStats(server)
    expect(labelled.topProducts[0]!.name).toBe("Margherita")
    expect(labelled.hourly).toHaveLength(24)
    expect(labelled.diners?.returning).toBe(1)
  })

  it("passes a missing customer book through as null, not as zero", () => {
    // A zero would claim nobody came back.
    const labelled = labelDashboardStats({ ...server, diners: null })
    expect(labelled.diners).toBeNull()
  })

  it("translates the breakdown keys the server returns raw", () => {
    const labelled = labelDashboardStats(server)
    expect(labelled.byType[0]!.label).toBe("Livraison")
    expect(labelled.bySource[0]!.label).toBe("Uber Eats")
  })

  it("passes an unknown key through rather than rendering nothing", () => {
    const labelled = labelDashboardStats({
      ...server,
      bySource: [{ name: "carrier_pigeon", value: 1 }],
    })
    expect(labelled.bySource[0]!.label).toBe("carrier_pigeon")
  })

  it("carries the truncation flag through to the screen", () => {
    expect(labelDashboardStats({ ...server, truncated: true }).truncated).toBe(true)
  })
})
