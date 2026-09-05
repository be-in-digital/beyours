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
    today: { revenue: 3_000, orderCount: 2, averageBasket: 1_500, activeOrders: 1 },
    yesterday: { revenue: 1_000, orderCount: 1, averageBasket: 1_000 },
    last7Days: [
      // A Monday and the Tuesday after it, as local midnights.
      { dayStart: new Date("2026-03-16T00:00:00").getTime(), revenue: 100, orders: 1 },
      { dayStart: new Date("2026-03-17T00:00:00").getTime(), revenue: 200, orders: 2 },
    ],
    byType: [{ name: "delivery", value: 3 }],
    bySource: [{ name: "uber_eats", value: 2 }],
    truncated: false,
  }

  it("names each bar after its own weekday", () => {
    const labelled = labelDashboardStats(server)
    expect(labelled.last7Days.map((day) => day.day)).toEqual(["Lun", "Mar"])
    expect(labelled.last7Days.map((day) => day.revenue)).toEqual([100, 200])
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
