import { describe, expect, it } from "vitest"

import {
  TOP_PRODUCT_LIMIT,
  computeDashboardStats,
  diners,
  hourlyLoad,
  topProducts,
  type DashboardOrderRow,
} from "../dashboardStats"

/**
 * The three metrics `apps/site` named and the engine did not have (#365).
 *
 * A `grep -riE 'plats populaires|topProduct|peakHour|returnRate'` over
 * `apps/themes` and `packages` returned nothing at all before this: no
 * product-level aggregation, no time-of-day bucketing, no notion of a returning
 * customer. Two of the five metrics the site listed existed as today-only cards;
 * these three did not exist in any form.
 *
 * What is worth pinning is what a reader cannot check by looking: the sort key
 * of the dish list, the local-hour arithmetic across a DST change, and the
 * definition of « taux de retour » — which has several readings that disagree.
 */

/** A local midnight, so hour arithmetic reads as clock time. */
const MONDAY = new Date("2026-03-16T00:00:00").getTime()
const HOUR = 3_600_000

function order(over: Partial<DashboardOrderRow> = {}): DashboardOrderRow {
  return {
    status: "completed",
    paymentStatus: "paid",
    type: "pickup",
    createdAt: MONDAY + 12 * HOUR,
    total: 1_000,
    ...over,
  }
}

const line = (
  name: string,
  quantity: number,
  subtotal: number,
  productId?: string
) => ({ ...(productId ? { productId } : {}), productName: name, quantity, subtotal })

describe("topProducts", () => {
  it("ranks on units sold, not on money", () => {
    // The question is what the kitchen is making. Ranking on revenue answers a
    // different one: the 38 € plateau outranks the burger sold forty times.
    const ranked = topProducts([
      order({ items: [line("Plateau", 1, 3_800, "p1")] }),
      order({ items: [line("Burger", 4, 3_600, "p2")] }),
    ])
    expect(ranked.map((p) => p.name)).toEqual(["Burger", "Plateau"])
  })

  it("shows the money as well, so the other ordering is visible", () => {
    const ranked = topProducts([order({ items: [line("Plateau", 1, 3_800, "p1")] })])
    expect(ranked[0]).toMatchObject({ quantity: 1, revenue: 3_800, orderCount: 1 })
  })

  it("keeps a renamed dish as one dish", () => {
    // Keyed on the product id. Two names, one product, one row.
    const ranked = topProducts([
      order({ items: [line("Margherita", 1, 1_200, "p1")] }),
      order({ items: [line("Pizza Margherita", 1, 1_200, "p1")] }),
    ])
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.quantity).toBe(2)
  })

  it("shows a renamed dish under its newest name", () => {
    // Orders arrive newest first from the query, so the first line seen wins.
    const ranked = topProducts([
      order({ items: [line("Margherita", 1, 1_200, "p1")] }),
      order({ items: [line("Pizza Margherita", 1, 1_200, "p1")] }),
    ])
    expect(ranked[0]!.name).toBe("Margherita")
  })

  it("keeps two dishes that merely share a name apart", () => {
    const ranked = topProducts([
      order({ items: [line("Menu du jour", 1, 1_500, "p1")] }),
      order({ items: [line("Menu du jour", 1, 1_800, "p2")] }),
    ])
    expect(ranked).toHaveLength(2)
  })

  it("still counts a dish whose product has been deleted", () => {
    // No id left; the name is all that identifies what was sold, and dropping
    // the line would make a period's history change when a product is removed.
    const ranked = topProducts([order({ items: [line("Tiramisu", 3, 1_800)] })])
    expect(ranked[0]).toMatchObject({ name: "Tiramisu", quantity: 3 })
    expect(ranked[0]!.productId).toBeUndefined()
  })

  it("counts an unpaid dish as made and as no revenue", () => {
    // The kitchen made it either way. The money did not arrive.
    const ranked = topProducts([
      order({ paymentStatus: "pending", items: [line("Margherita", 2, 2_400, "p1")] }),
    ])
    expect(ranked[0]).toMatchObject({ quantity: 2, revenue: 0 })
  })

  it("ignores an order with no lines rather than counting a sale of nothing", () => {
    expect(topProducts([order({ items: [] }), order()])).toEqual([])
  })

  it("stops at the limit", () => {
    const many = Array.from({ length: TOP_PRODUCT_LIMIT + 5 }, (_, i) =>
      order({ items: [line(`Dish ${i}`, i + 1, 100, `p${i}`)] })
    )
    expect(topProducts(many)).toHaveLength(TOP_PRODUCT_LIMIT)
  })
})

describe("hourlyLoad", () => {
  const windows = { dayStarts: [MONDAY], todayEnd: MONDAY + 24 * HOUR }

  it("reports all 24 hours, including the empty ones", () => {
    // A restaurant closed between 15:00 and 18:00 has a real trough there, and a
    // chart that dropped the empty bars would draw the afternoon as lunch.
    const buckets = hourlyLoad([order({ createdAt: MONDAY + 12 * HOUR })], windows)
    expect(buckets).toHaveLength(24)
    expect(buckets.map((b) => b.hour)).toEqual([...Array(24).keys()])
  })

  it("puts an order in its own local hour", () => {
    const buckets = hourlyLoad(
      [
        order({ createdAt: MONDAY + 12 * HOUR + 30 * 60_000 }),
        order({ createdAt: MONDAY + 20 * HOUR }),
      ],
      windows
    )
    expect(buckets[12]!.orders).toBe(1)
    expect(buckets[20]!.orders).toBe(1)
    expect(buckets[19]!.orders).toBe(0)
  })

  it("reads local hours the same on both sides of a clock change", () => {
    /*
     * THE WHOLE REASON THERE IS NO TIMEZONE ARGUMENT. These are the two local
     * midnights around the last Sunday in March 2026, when Paris loses an hour:
     * one day is 24 hours long and the next is 23. An offset passed once would
     * be wrong for one of them, and a service at 20:00 would be drawn at 19:00.
     *
     * `Date` here resolves the boundaries in the machine's own zone, which is
     * the same thing the browser does — so this test asserts the arithmetic,
     * not a particular zone.
     */
    const saturday = new Date("2026-03-28T00:00:00").getTime()
    const sunday = new Date("2026-03-29T00:00:00").getTime()
    const monday = new Date("2026-03-30T00:00:00").getTime()

    // 20:00 local on each of the two days, whatever the day's length.
    const saturdayService = new Date("2026-03-28T20:00:00").getTime()
    const sundayService = new Date("2026-03-29T20:00:00").getTime()

    const buckets = hourlyLoad(
      [order({ createdAt: saturdayService }), order({ createdAt: sundayService })],
      { dayStarts: [saturday, sunday], todayEnd: monday }
    )
    expect(buckets[20]!.orders).toBe(2)
  })

  it("counts only collected money", () => {
    const buckets = hourlyLoad(
      [
        order({ createdAt: MONDAY + 12 * HOUR, total: 1_000 }),
        order({ createdAt: MONDAY + 12 * HOUR, total: 5_000, paymentStatus: "pending" }),
      ],
      windows
    )
    expect(buckets[12]).toMatchObject({ orders: 2, revenue: 1_000 })
  })

  it("drops an order outside the period rather than forcing it into a bucket", () => {
    const buckets = hourlyLoad(
      [order({ createdAt: MONDAY - 5 * HOUR }), order({ createdAt: MONDAY + 25 * HOUR })],
      windows
    )
    expect(buckets.reduce((sum, b) => sum + b.orders, 0)).toBe(0)
  })
})

describe("diners", () => {
  it("counts a diner as returning when their first order predates the period", () => {
    const periodStart = MONDAY
    const result = diners(
      [
        { firstOrderAt: MONDAY - 90 * 24 * HOUR, lastOrderAt: MONDAY + HOUR },
        { firstOrderAt: MONDAY + 2 * HOUR, lastOrderAt: MONDAY + 2 * HOUR },
      ],
      periodStart,
      0
    )
    expect(result).toMatchObject({
      identified: 2,
      returning: 1,
      newcomers: 1,
      returningRate: 0.5,
    })
  })

  it("counts diners, not orders", () => {
    // A regular who came four times is one returning customer. Counting orders
    // would make the rate rise with the appetite of a single person.
    const result = diners(
      [{ firstOrderAt: MONDAY - 24 * HOUR, lastOrderAt: MONDAY + 8 * HOUR }],
      MONDAY,
      0
    )
    expect(result.identified).toBe(1)
    expect(result.returningRate).toBe(1)
  })

  it("is not a rate over a window: the same regular scores the same either way", () => {
    /*
     * The reading this definition REFUSES. Under "ordered twice inside the
     * window", a regular who comes once a fortnight scores 0 on a week and 1 on
     * a month — so the figure would measure the picker, not the restaurant.
     * Here the answer is the same for both, because the question is about their
     * first ever order.
     */
    const regular = { firstOrderAt: MONDAY - 365 * 24 * HOUR, lastOrderAt: MONDAY + HOUR }
    expect(diners([regular], MONDAY, 0).returningRate).toBe(1)
    expect(diners([regular], MONDAY - 29 * 24 * HOUR, 0).returningRate).toBe(1)
  })

  it("reports the anonymous orders rather than folding them into either side", () => {
    // A cash-heavy establishment would otherwise read a rate computed over a
    // minority of its trade with nothing saying so.
    const result = diners(
      [{ firstOrderAt: MONDAY + HOUR, lastOrderAt: MONDAY + HOUR }],
      MONDAY,
      17
    )
    expect(result).toMatchObject({ identified: 1, newcomers: 1, anonymousOrders: 17 })
  })

  it("is zero, not NaN, when nobody identifiable ordered", () => {
    expect(diners([], MONDAY, 4).returningRate).toBe(0)
  })

  it("treats a first order exactly at the boundary as new", () => {
    // The period is half-open at the start, like every other window here: an
    // order AT `periodStart` is inside the period, so it is not "before" it.
    expect(diners([{ firstOrderAt: MONDAY, lastOrderAt: MONDAY }], MONDAY, 0).returning).toBe(0)
  })
})

describe("computeDashboardStats, with the metrics attached", () => {
  const windows = {
    dayStarts: [MONDAY, MONDAY + 24 * HOUR],
    todayEnd: MONDAY + 48 * HOUR,
    breakdownSince: MONDAY,
    now: MONDAY + 30 * HOUR,
  }

  it("computes the dishes and hours over the whole period, not just today", () => {
    // The chart's period IS the period. Before the picker these were separate
    // literals and the donuts answered about a different stretch of time.
    const stats = computeDashboardStats(
      [
        order({ createdAt: MONDAY + 12 * HOUR, items: [line("Margherita", 1, 1_200, "p1")] }),
        order({ createdAt: MONDAY + 36 * HOUR, items: [line("Margherita", 2, 2_400, "p1")] }),
      ],
      windows
    )
    expect(stats.topProducts[0]!.quantity).toBe(3)
    // Both services are at local 12:00 — one on each day of the period — so
    // they share a bucket. That sharing is the point: the hours are a
    // time-of-day profile over the period, not a second timeline.
    expect(stats.hourly[12]!.orders).toBe(2)
  })

  it("leaves a cancelled order out of the dish ranking", () => {
    const stats = computeDashboardStats(
      [
        order({
          status: "cancelled",
          createdAt: MONDAY + 12 * HOUR,
          items: [line("Margherita", 9, 9_000, "p1")],
        }),
      ],
      windows
    )
    expect(stats.topProducts).toEqual([])
  })

  it("answers null for the diners when given no customer book", () => {
    const stats = computeDashboardStats([order()], windows)
    expect(stats.diners).toBeNull()
  })

  it("counts the period's address-less orders as anonymous", () => {
    const stats = computeDashboardStats(
      [
        order({ createdAt: MONDAY + 12 * HOUR, customerEmailKey: "a@b.com" }),
        order({ createdAt: MONDAY + 13 * HOUR }),
      ],
      windows,
      false,
      [{ firstOrderAt: MONDAY - HOUR, lastOrderAt: MONDAY + 12 * HOUR }]
    )
    expect(stats.diners).toMatchObject({
      identified: 1,
      returning: 1,
      anonymousOrders: 1,
    })
  })

  it("still calls the chart entries `days`, one per boundary", () => {
    const stats = computeDashboardStats([order()], windows)
    expect(stats.days.map((day) => day.dayStart)).toEqual(windows.dayStarts)
  })
})
