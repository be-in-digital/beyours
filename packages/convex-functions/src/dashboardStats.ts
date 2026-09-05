/**
 * The dashboard's aggregates, computed where the orders are.
 *
 * WHY THIS MODULE EXISTS. `/dashboard` had exactly one query behind it —
 * `orders.list`, unbounded — and the whole of this arithmetic ran in the
 * browser over every order the establishment had ever taken. Measured on a
 * seeded store: 5,000 orders returned, 3.07 MB on the wire, on a live
 * subscription that re-sent all of it to every open admin tab on every new
 * order. The numbers on the screen are five totals and a seven-bar chart; the
 * payload was the restaurant's entire trading history.
 *
 * WHY THE CALLER SUPPLIES THE DAY BOUNDARIES. "Today" is the restaurant's day,
 * not UTC's. A service that closes at 01:00 in Paris is still on yesterday's
 * takings, and a server that derived midnight itself would move the boundary by
 * one or two hours depending on the season. The browser knows the establishment's
 * timezone because it is sitting in it, so it computes the local midnights and
 * passes them; this module buckets against whatever it is given and invents no
 * boundary of its own.
 *
 * Pure on purpose: the query in `orders.ts` reads a bounded window and hands the
 * rows here, so every rule below is testable without a database.
 */

/** The fields of an order this module reads. Nothing else is needed. */
export interface DashboardOrderRow {
  status: string
  type: string
  source?: string
  createdAt: number
  total: number
}

/** The boundaries the caller wants its numbers bucketed against. */
export interface DashboardWindows {
  /**
   * Local-midnight timestamps, ascending, one per bar of the chart. The last
   * entry is today's midnight, and the one before it is yesterday's.
   */
  dayStarts: number[]
  /** Start of the wider window the type/source breakdowns cover. */
  breakdownSince: number
  /** The moment the answer is for. */
  now: number
}

export interface DashboardTotals {
  revenue: number
  orderCount: number
  averageBasket: number
}

export interface DashboardDay {
  /** The boundary this bar starts at — the caller owns the label. */
  dayStart: number
  revenue: number
  orders: number
}

export interface DashboardBreakdownEntry {
  name: string
  value: number
}

export interface DashboardStats {
  today: DashboardTotals & { activeOrders: number }
  yesterday: DashboardTotals
  /** One entry per boundary in `dayStarts`, in the same order. */
  last7Days: DashboardDay[]
  byType: DashboardBreakdownEntry[]
  bySource: DashboardBreakdownEntry[]
  /** True when the read hit its cap, so every number below is a floor. */
  truncated: boolean
}

/**
 * Orders that are still work: on the pass, on the road, or waiting to be taken.
 *
 * `cancelled`, `delivered` and `completed` are not here — the first is not an
 * order any more and the other two are finished.
 */
const ACTIVE_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
])

/**
 * How long an unfinished order still counts as "à traiter".
 *
 * Bounded to the last 24h: an order stuck in `pending` since last week is
 * abandoned data, not work to do, and an unbounded count reads absurd next to
 * the "today" cards.
 */
const ACTIVE_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000

/** The most day boundaries a caller may ask to be bucketed against. */
export const MAX_DAY_BUCKETS = 31

function totals(orders: DashboardOrderRow[]): DashboardTotals {
  const revenue = orders.reduce((sum, order) => sum + order.total, 0)
  const orderCount = orders.length
  return {
    revenue,
    orderCount,
    averageBasket: orderCount > 0 ? revenue / orderCount : 0,
  }
}

function tally(
  orders: DashboardOrderRow[],
  key: (order: DashboardOrderRow) => string
): DashboardBreakdownEntry[] {
  const counts = new Map<string, number>()
  for (const order of orders) {
    const name = key(order)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value }))
}

/**
 * The earliest timestamp any of these windows needs.
 *
 * The query reads from here, so the caller and the aggregation cannot disagree
 * about how far back the rows have to go.
 */
export function dashboardWindowStart(windows: {
  dayStarts: number[]
  breakdownSince: number
}): number {
  const boundaries = [windows.breakdownSince, ...windows.dayStarts]
  return Math.min(...boundaries)
}

/**
 * Reject a boundary list that cannot be bucketed against.
 *
 * A caller sending an unsorted or unbounded array would silently get wrong
 * bars rather than an error, and the dashboard is the screen nobody
 * cross-checks.
 */
export function assertDayStarts(dayStarts: number[]): void {
  if (dayStarts.length === 0) {
    throw new Error("dashboardStats: dayStarts must contain at least one boundary")
  }
  if (dayStarts.length > MAX_DAY_BUCKETS) {
    throw new Error(
      `dashboardStats: dayStarts holds ${dayStarts.length} boundaries, more than ${MAX_DAY_BUCKETS}`
    )
  }
  for (let i = 1; i < dayStarts.length; i++) {
    const previous = dayStarts[i - 1] as number
    const current = dayStarts[i] as number
    if (current <= previous) {
      throw new Error("dashboardStats: dayStarts must be strictly ascending")
    }
  }
}

/**
 * Bucket a window of orders into what the dashboard renders.
 *
 * `orders` must already be narrowed to `dashboardWindowStart(windows)` — this
 * function trusts the read and never widens it.
 */
export function computeDashboardStats(
  orders: DashboardOrderRow[],
  windows: DashboardWindows,
  truncated = false
): DashboardStats {
  assertDayStarts(windows.dayStarts)

  // `assertDayStarts` has already refused an empty list, so both indexes exist.
  const todayStart = windows.dayStarts[windows.dayStarts.length - 1] as number
  const yesterdayStart =
    windows.dayStarts.length > 1
      ? (windows.dayStarts[windows.dayStarts.length - 2] as number)
      : todayStart

  // A cancelled order is not takings. It still counts as an order that happened
  // for nobody, which is why it is excluded here and not filtered at the read.
  const valid = orders.filter((order) => order.status !== "cancelled")

  const activeSince = windows.now - ACTIVE_ORDER_WINDOW_MS
  const activeOrders = orders.filter(
    (order) => ACTIVE_STATUSES.has(order.status) && order.createdAt >= activeSince
  ).length

  const last7Days: DashboardDay[] = windows.dayStarts.map((dayStart, index) => {
    const dayEnd = windows.dayStarts[index + 1] ?? Number.POSITIVE_INFINITY
    const ofThatDay = valid.filter(
      (order) => order.createdAt >= dayStart && order.createdAt < dayEnd
    )
    return {
      dayStart,
      revenue: ofThatDay.reduce((sum, order) => sum + order.total, 0),
      orders: ofThatDay.length,
    }
  })

  const breakdown = valid.filter((order) => order.createdAt >= windows.breakdownSince)

  return {
    today: {
      ...totals(valid.filter((order) => order.createdAt >= todayStart)),
      activeOrders,
    },
    yesterday: totals(
      valid.filter(
        (order) => order.createdAt >= yesterdayStart && order.createdAt < todayStart
      )
    ),
    last7Days,
    byType: tally(breakdown, (order) => order.type),
    // An order written before `source` existed is a website order, which is
    // what it was.
    bySource: tally(breakdown, (order) => order.source ?? "website"),
    truncated,
  }
}
