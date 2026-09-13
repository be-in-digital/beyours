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
import { hasPermission, type Role } from "@be-in-digital/core"
import { profileAllowsPermission } from "@be-in-digital/convex-functions/teamAccess"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
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

/** One dish in « Plats populaires ». */
export interface DashboardProduct {
  productId?: string
  name: string
  quantity: number
  revenue: number
  orderCount: number
}

/** One hour of the establishment's trading day. */
export interface DashboardHour {
  hour: number
  orders: number
  revenue: number
}

/** Who ordered over the period. See the server's `DashboardDiners`. */
export interface DashboardDiners {
  identified: number
  returning: number
  newcomers: number
  returningRate: number
  anonymousOrders: number
}

export interface DashboardStats {
  today: DashboardTotals & { activeOrders: number }
  yesterday: DashboardTotals
  /** One bar per day of the chosen period, oldest first, labelled. */
  days: Array<{ day: string; revenue: number; orders: number }>
  byType: Array<{ name: string; value: number; label: string }>
  bySource: Array<{ name: string; value: number; label: string }>
  topProducts: DashboardProduct[]
  /** 24 entries, always all of them — an empty hour is a measurement. */
  hourly: DashboardHour[]
  diners: DashboardDiners | null
  /** True when the server stopped at its read cap, so the figures are floors. */
  truncated: boolean
}

/** What `orders.dashboardStats` answers, before the labels are attached. */
interface ServerDashboardStats {
  today: DashboardTotals & { activeOrders: number }
  yesterday: DashboardTotals
  days: Array<{ dayStart: number; revenue: number; orders: number }>
  byType: Array<{ name: string; value: number }>
  bySource: Array<{ name: string; value: number }>
  topProducts: DashboardProduct[]
  hourly: DashboardHour[]
  diners: DashboardDiners | null
  truncated: boolean
}

const DAY_NAMES: Record<number, string> = {
  0: "Dim", 1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam",
}

/**
 * The periods the overview can be read over.
 *
 * These replace the literals this screen used to carry — a fixed seven-bar
 * chart and a fixed thirty-day breakdown, neither of them a parameter. The site
 * copy promised « analyse des tendances et des performances par période » while
 * no period could be chosen.
 *
 * Thirty is the ceiling because `MAX_DAY_BUCKETS` in `dashboardStats.ts` is 31:
 * the chart has one bar per day, and the hour-of-day buckets are derived from
 * those same local midnights, which is what makes them DST-correct without a
 * timezone argument.
 */
export const DASHBOARD_PERIODS = [7, 14, 30] as const

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

/** What the picker calls each one. */
export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  7: "7 jours",
  14: "14 jours",
  30: "30 jours",
}

/** The period a first visit lands on. */
export const DASHBOARD_DEFAULT_PERIOD: DashboardPeriod = 7

/** Bars on the orders chart, when no period has been chosen. */
export const DASHBOARD_CHART_DAYS = DASHBOARD_DEFAULT_PERIOD

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
    days: stats.days.map((day) => ({
      // A 30-day chart repeats each weekday four times, so the day number goes
      // on the label as well. Seven bars keep the bare name they always had.
      day:
        stats.days.length > DASHBOARD_CHART_DAYS
          ? `${new Date(day.dayStart).getDate()}`
          : DAY_NAMES[new Date(day.dayStart).getDay()] ?? "",
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
    topProducts: stats.topProducts,
    hourly: stats.hourly,
    diners: stats.diners,
    truncated: stats.truncated,
  }
}

/**
 * May this operator read the establishment's figures?
 *
 * BOTH of the server's gates, in the server's order, the same pair
 * `canRoleSeeNavHref` runs: the RBAC role check, then
 * `profileAllowsPermission`, which narrows the role to the modules the owner
 * ticked in the invite dialog. Asked in the browser so the query is never sent
 * — a Convex refusal rethrows out of `useQuery` during render and unwinds the
 * whole screen, which for a `kitchen` account would be a blank overview page
 * rather than an explained one.
 */
export function canReadDashboardAnalytics(
  role: string | null | undefined,
  modules: string[] = []
): boolean {
  if (!role) return false
  if (!hasPermission(role as Role, "analytics:read")) return false
  return profileAllowsPermission(
    { role: role as Role, permissions: modules },
    "analytics:read"
  )
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
  period: DashboardPeriod
  setPeriod: (period: DashboardPeriod) => void
  /** True when this operator's role carries no `analytics:read`. */
  analyticsDenied: boolean
} {
  const storeId = useAdminStoreId()
  const { api } = useAdminApiStore()
  const todayStart = useTodayStart()
  const [period, setPeriod] = useState<DashboardPeriod>(DASHBOARD_DEFAULT_PERIOD)

  const role = useAdminAuthStore((state) => state.role)
  const modules = useAdminAuthStore((state) => state.permissions)
  const mayRead = canReadDashboardAnalytics(role, modules)

  // Keyed on today's midnight and the chosen period rather than recomputed per
  // render: a boundary that moved on every render would resubscribe the query
  // on every render, and one fixed at mount would still call yesterday "today"
  // on a screen the kitchen leaves open through the night.
  const windows = useMemo(
    () => ({
      dayStarts: dashboardDayStarts(new Date(todayStart), period),
      todayEnd: dashboardTodayEnd(new Date(todayStart)),
      // The breakdown pies follow the picker too. They used to sit on their own
      // fixed thirty days, so the donuts and the chart above them answered
      // about different stretches of time with nothing saying so.
      breakdownSince: dashboardBreakdownSince(new Date(todayStart), period),
    }),
    [todayStart, period]
  )

  // `api` is injected by the admin layout, so both references are absent on the
  // first render and `"skip"` is what `useQuery` wants until they arrive.
  const statsRef =
    mayRead && storeId && api?.orders?.dashboardStats
      ? api.orders.dashboardStats
      : "skip"
  const recentRef = storeId && api?.orders?.recent ? api.orders.recent : "skip"

  const serverStats = useQuery(
    statsRef,
    mayRead && storeId ? { storeId, ...windows } : "skip"
  ) as ServerDashboardStats | undefined

  const recentOrders = useQuery(recentRef, storeId ? { storeId } : "skip") as
    | DashboardOrder[]
    | undefined

  const stats = useMemo(
    () => (serverStats ? labelDashboardStats(serverStats) : null),
    [serverStats]
  )

  return {
    storeId,
    stats,
    orders: recentOrders ?? [],
    period,
    setPeriod,
    analyticsDenied: !mayRead,
  }
}
