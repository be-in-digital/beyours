import { describe, it, expect } from "vitest"
import {
  computeDashboardStats,
  COLLECTED_PAYMENT_STATUSES,
  type DashboardOrderRow,
  type DashboardWindows,
} from "../dashboardStats"

/**
 * A fixed local day, so the buckets are readable rather than relative to now.
 *
 * 2026-09-07 00:00 UTC is "today"; the bar before it is yesterday.
 */
const TODAY = Date.UTC(2026, 8, 7)
const DAY = 24 * 60 * 60 * 1000

function windows(overrides: Partial<DashboardWindows> = {}): DashboardWindows {
  const dayStarts = [
    TODAY - 6 * DAY,
    TODAY - 5 * DAY,
    TODAY - 4 * DAY,
    TODAY - 3 * DAY,
    TODAY - 2 * DAY,
    TODAY - DAY,
    TODAY,
  ]
  return {
    dayStarts,
    todayEnd: TODAY + DAY,
    breakdownSince: TODAY - 30 * DAY,
    now: TODAY + 12 * 60 * 60 * 1000,
    ...overrides,
  }
}

function order(row: Partial<DashboardOrderRow> = {}): DashboardOrderRow {
  return {
    status: "completed",
    paymentStatus: "paid",
    type: "dine_in",
    source: "website",
    createdAt: TODAY + 60_000,
    total: 1_000,
    ...row,
  }
}

describe("computeDashboardStats — revenue is money that arrived", () => {
  it("leaves an unpaid order out of takings and keeps it in the order count", () => {
    // The reported defect: `status !== "cancelled"` is a filter about orders
    // being UNMADE, and was standing in for one about orders being PAID. The
    // probe read 1 720,00 € against 20,00 € collected.
    const stats = computeDashboardStats(
      [
        order({ total: 2_000, paymentStatus: "paid" }),
        order({ total: 170_000, paymentStatus: "pending" }),
      ],
      windows()
    )

    expect(stats.today.revenue).toBe(2_000)
    expect(stats.today.uncollected).toBe(170_000)
    expect(stats.today.orderCount).toBe(2)
    expect(stats.today.collectedOrderCount).toBe(1)
  })

  it("counts a failed card attempt as no revenue at all", () => {
    const stats = computeDashboardStats(
      [order({ total: 5_000, paymentStatus: "failed" })],
      windows()
    )

    expect(stats.today.revenue).toBe(0)
    expect(stats.today.uncollected).toBe(5_000)
    // It is still an order that happened, so it is still on the "Commandes"
    // card and in the breakdowns.
    expect(stats.today.orderCount).toBe(1)
    expect(stats.byType).toEqual([{ name: "dine_in", value: 1 }])
  })

  it("drops money that went back and keeps money merely owed back", () => {
    // `refund_pending` is the till still holding it — the refund has not been
    // sent. The day it is, the row becomes `refunded` and leaves by itself.
    const stats = computeDashboardStats(
      [
        order({ total: 4_000, paymentStatus: "refunded" }),
        order({ total: 3_000, paymentStatus: "refund_pending" }),
        order({ total: 2_000, paymentStatus: "partially_refunded" }),
      ],
      windows()
    )

    expect(stats.today.revenue).toBe(5_000)
    expect(stats.today.uncollected).toBe(4_000)
  })

  it("still excludes a cancelled order from both figures", () => {
    const stats = computeDashboardStats(
      [
        order({ total: 9_000, status: "cancelled", paymentStatus: "pending" }),
        order({ total: 1_000 }),
      ],
      windows()
    )

    expect(stats.today.orderCount).toBe(1)
    expect(stats.today.revenue).toBe(1_000)
    expect(stats.today.uncollected).toBe(0)
  })

  it("reads a row with no payment state as uncollected", () => {
    // The safe direction: a caller that cannot say whether money arrived has
    // not thereby asserted that it did.
    const stats = computeDashboardStats(
      [{ status: "completed", type: "pickup", createdAt: TODAY, total: 800 }],
      windows()
    )

    expect(stats.today.revenue).toBe(0)
    expect(stats.today.uncollected).toBe(800)
  })

  it("averages the basket over the collected orders, not over all of them", () => {
    // 2 000 collected over one order is a 20,00 € basket. Dividing by the two
    // orders placed would answer 10,00 € — a figure that falls as unpaid
    // orders pile up, which is the opposite of what a basket average is for.
    const stats = computeDashboardStats(
      [
        order({ total: 2_000, paymentStatus: "paid" }),
        order({ total: 2_000, paymentStatus: "pending" }),
      ],
      windows()
    )

    expect(stats.today.averageBasket).toBe(2_000)
  })

  it("has no basket to average when nothing has been collected", () => {
    const stats = computeDashboardStats(
      [order({ paymentStatus: "pending" })],
      windows()
    )

    expect(stats.today.averageBasket).toBe(0)
  })
})

describe("computeDashboardStats — the chart and the other windows", () => {
  it("applies the same rule to each bar", () => {
    const stats = computeDashboardStats(
      [
        order({ createdAt: TODAY - DAY + 60_000, total: 5_000, paymentStatus: "paid" }),
        order({ createdAt: TODAY - DAY + 60_000, total: 7_000, paymentStatus: "pending" }),
      ],
      windows()
    )

    const yesterdayBar = stats.days[5]
    expect(yesterdayBar?.revenue).toBe(5_000)
    // Both orders happened yesterday, and the bar's order count says so.
    expect(yesterdayBar?.orders).toBe(2)
    expect(stats.yesterday.revenue).toBe(5_000)
    expect(stats.yesterday.orderCount).toBe(2)
  })

  it("counts an active order regardless of whether it has been paid", () => {
    // "À traiter" is work on the pass, and an unpaid order is still work.
    const stats = computeDashboardStats(
      [order({ status: "preparing", paymentStatus: "pending" })],
      windows()
    )

    expect(stats.today.activeOrders).toBe(1)
  })
})

describe("COLLECTED_PAYMENT_STATUSES", () => {
  it("names only the states in which the money is held", () => {
    expect([...COLLECTED_PAYMENT_STATUSES].sort()).toEqual([
      "paid",
      "partially_refunded",
      "refund_pending",
    ])
  })
})
