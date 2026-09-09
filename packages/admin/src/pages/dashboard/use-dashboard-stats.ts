"use client"

/**
 * Dashboard state behind one narrow interface — the `use-store-detail`
 * pattern applied here: queries, time windows and aggregates live in this
 * hook; the page only renders. The interface is the test surface.
 *
 * WHAT MOVED, AND WHY. The arithmetic used to be here, over `orders.list` —
 * every order the establishment had ever taken, on a live subscription, so a
 * new order re-sent the whole history to every open admin tab. Measured on a
 * seeded store: 5,000 rows, 3.07 MB, and a screen on course to exceed Convex's
 * 16,384-document transaction limit and then throw on every load. The
 * aggregation now happens where the orders are; this hook decides the windows
 * and renders the labels.
 *
 * The day boundaries are computed here rather than on the server on purpose:
 * "today" is the restaurant's day, and the browser is the only party that knows
 * which timezone that is.
 */

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { ORDER_TYPE_LABELS, ORDER_SOURCE_LABELS } from "../../lib/vocabulary"

type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready"
  | "out_for_delivery" | "delivered" | "completed" | "cancelled"

type OrderType = "delivery" | "pickup" | "dine_in"
type OrderSource = "website" | "uber_eats" | "deliveroo" | "pos"

export interface DashboardOrder {
  _id: string
  status: OrderStatus
  type: OrderType
  source?: OrderSource
  createdAt: number
  total: number
  orderNumber: string
  customerInfo: { name: string; email?: string; phone?: string }
  items: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number }>
}

/**
 * One window's figures, as the server computes them.
 *
 * `revenue` is money COLLECTED, not money ordered, and `orderCount` is orders
 * placed — so the two are counted over different sets on purpose and
 * `uncollected` is the difference. See `dashboardStats.ts` in
 * `@be-in-digital/convex-functions` for the rule.
 */
export interface DashboardTotals {
  revenue: number
  orderCount: number
  averageBasket: number
  collectedOrderCount: number
  uncollected: number
}

export interface DashboardStats {
  today: DashboardTotals & { activeOrders: number }
  yesterday: DashboardTotals
  last7Days: Array<{ day: string; revenue: number; orders: number }>
  byType: Array<{ name: string; value: number; label: string }>
  bySource: Array<{ name: string; value: number; label: string }>
  /** True when the server stopped at its read cap, so the figures are floors. */
  truncated: boolean
}

/** What `orders.dashboardStats` answers, before the labels are attached. */
interface ServerDashboardStats {
  today: DashboardTotals & { activeOrders: number }
  yesterday: DashboardTotals
  last7Days: Array<{ dayStart: number; revenue: number; orders: number }>
  byType: Array<{ name: string; value: number }>
  bySource: Array<{ name: string; value: number }>
  truncated: boolean
}

const DAY_NAMES: Record<number, string> = {
  0: "Dim", 1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam",
}

/** Bars on the orders chart. */
export const DASHBOARD_CHART_DAYS = 7

/** How far back the type and source breakdowns look. */
export const DASHBOARD_BREAKDOWN_DAYS = 30

/**
 * The local-midnight boundaries the chart is bucketed against, oldest first.
 *
 * Derived from the browser's own calendar, so a DST change moves the boundary
 * with it rather than shifting every bar by an hour.
 */
export function dashboardDayStarts(
  now: Date = new Date(),
  days: number = DASHBOARD_CHART_DAYS
): number[] {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const starts: number[] = []
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(todayStart)
    day.setDate(day.getDate() - back)
    starts.push(day.getTime())
  }
  return starts
}

/**
 * Tomorrow's local midnight — the exclusive end of today.
 *
 * Walked with the calendar rather than added as 24h, so a DST changeover does
 * not move the boundary by an hour.
 */
export function dashboardTodayEnd(now: Date = new Date()): number {
  const tomorrow = new Date(now)
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.getTime()
}

/** Start of the wider window the breakdown pies cover. */
export function dashboardBreakdownSince(
  now: Date = new Date(),
  days: number = DASHBOARD_BREAKDOWN_DAYS
): number {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days)
  return start.getTime()
}

/** Attach the French labels the server has no business knowing about. */
export function labelDashboardStats(stats: ServerDashboardStats): DashboardStats {
  return {
    today: stats.today,
    yesterday: stats.yesterday,
    last7Days: stats.last7Days.map((day) => ({
      day: DAY_NAMES[new Date(day.dayStart).getDay()] ?? "",
      revenue: day.revenue,
      orders: day.orders,
    })),
    byType: stats.byType.map((entry) => ({
      ...entry,
      label: ORDER_TYPE_LABELS[entry.name as OrderType] || entry.name,
    })),
    bySource: stats.bySource.map((entry) => ({
      ...entry,
      label: ORDER_SOURCE_LABELS[entry.name] || entry.name,
    })),
    truncated: stats.truncated,
  }
}

/**
 * Today's local midnight, and it changes when today does.
 *
 * This screen runs on a tablet nobody closes: the pass is open at 23:50 and
 * still open at 00:10, and a boundary captured at mount would go on labelling
 * yesterday's takings "aujourd'hui" until somebody reloaded. One timeout, armed
 * for the next midnight, rather than a poll.
 */
function useTodayStart(): number {
  // A counter rather than the boundary itself, because the effect has to re-arm
  // even when the day has not turned. `setTodayStart(sameValue)` would be a
  // React bail-out: the effect would not re-run, no new timer would be armed,
  // and one early wake would freeze the dashboard on yesterday until reload.
  const [tick, setTick] = useState(0)
  const todayStart = useMemo(() => startOfLocalDay(new Date()), [tick])

  useEffect(() => {
    // Walked with the calendar rather than assumed to be 24h away: a DST change
    // makes the day 23 or 25 hours long, and `setTimeout` does not know that.
    const nextDay = new Date(todayStart)
    nextDay.setDate(nextDay.getDate() + 1)

    const timer = setTimeout(
      () => setTick((previous) => previous + 1),
      Math.max(1_000, startOfLocalDay(nextDay) - Date.now())
    )
    return () => clearTimeout(timer)
  }, [todayStart])

  return todayStart
}

/** Midnight of `date` in the browser's own timezone. */
function startOfLocalDay(date: Date): number {
  const midnight = new Date(date)
  midnight.setHours(0, 0, 0, 0)
  return midnight.getTime()
}

export function useDashboardStats(): {
  storeId: string | null
  stats: DashboardStats | null
  orders: DashboardOrder[]
} {
  const storeId = useAdminStoreId()
  const { api } = useAdminApiStore()
  const todayStart = useTodayStart()

  // Keyed on today's midnight rather than recomputed per render: a boundary
  // that moved on every render would resubscribe the query on every render,
  // and one fixed at mount would still call yesterday "today" on a screen the
  // kitchen leaves open through the night.
  const windows = useMemo(
    () => ({
      dayStarts: dashboardDayStarts(new Date(todayStart)),
      todayEnd: dashboardTodayEnd(new Date(todayStart)),
      breakdownSince: dashboardBreakdownSince(new Date(todayStart)),
    }),
    [todayStart]
  )

  // `api` is injected by the admin layout, so both references are absent on the
  // first render and `"skip"` is what `useQuery` wants until they arrive.
  const statsRef =
    storeId && api?.orders?.dashboardStats ? api.orders.dashboardStats : "skip"
  const recentRef = storeId && api?.orders?.recent ? api.orders.recent : "skip"

  const serverStats = useQuery(
    statsRef,
    storeId ? { storeId, ...windows } : "skip"
  ) as ServerDashboardStats | undefined

  const recentOrders = useQuery(recentRef, storeId ? { storeId } : "skip") as
    | DashboardOrder[]
    | undefined

  const stats = useMemo(
    () => (serverStats ? labelDashboardStats(serverStats) : null),
    [serverStats]
  )

  return { storeId, stats, orders: recentOrders ?? [] }
}
