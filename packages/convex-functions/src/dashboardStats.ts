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
 * WHAT "REVENUE" MEANS HERE, AND WHAT IT USED TO MEAN. It is money that
 * arrived. The only filter this module applied was `status !== "cancelled"`,
 * which removes orders that were unmade and keeps every order that was merely
 * placed — an abandoned checkout, a declined card, a table whose cash has not
 * been rung up. `DashboardOrderRow` did not even carry `paymentStatus`, so the
 * distinction was not available to be got wrong; it was absent. On a probe
 * store the card read 1 720,00 € against 20,00 € collected. Order COUNTS still
 * mean orders that happened — that is what an owner is asking when they look
 * at « Commandes » — and the gap between the two is reported as `uncollected`
 * rather than left to be inferred.
 *
 * Pure on purpose: the query in `orders.ts` reads a bounded window and hands the
 * rows here, so every rule below is testable without a database.
 */

/** The fields of an order this module reads. Nothing else is needed. */
export interface DashboardOrderRow {
  status: string
  /**
   * A member of the `orders.paymentStatus` union — whether the money arrived.
   *
   * WHY IT IS HERE: it was not, and the interface being silent about it made
   * the defect impossible to see. `revenue` summed every order that was not
   * `cancelled`, which is every order that was PLACED, not every order that
   * was PAID: an abandoned checkout, a card that was declined and a cash order
   * nobody has rung up yet all counted in full. Measured on a probe store, the
   * dashboard reported 1 720,00 € against 20,00 € actually collected.
   *
   * Optional so a caller that genuinely has no payment state — a test fixture,
   * a future summary row — is not forced to invent one; absent reads as
   * uncollected, which is the safe direction. Every real caller reads whole
   * `orders` documents, where the field is required.
   */
  paymentStatus?: string
  type: string
  source?: string
  createdAt: number
  total: number
}

/**
 * The payment states in which the establishment is holding the money.
 *
 * `paid` is the plain case. `refund_pending` is money that is OWED back but
 * has not moved — the till still holds it, and the day it is actually sent the
 * row becomes `refunded` and drops out of takings by itself.
 * `partially_refunded` is here because part of the charge is still held; the
 * order row cannot say how much came back — that lives on the payment rows —
 * so the full total is counted and this is the one place these figures round
 * in the establishment's favour.
 *
 * `pending` and `failed` are money that never arrived. `refunded` is money
 * that arrived and went back. None of the three is revenue.
 */
export const COLLECTED_PAYMENT_STATUSES = new Set([
  "paid",
  "refund_pending",
  "partially_refunded",
])

/** Has the money for this order actually arrived? */
function isCollected(order: DashboardOrderRow): boolean {
  return COLLECTED_PAYMENT_STATUSES.has(order.paymentStatus ?? "pending")
}

/** The boundaries the caller wants its numbers bucketed against. */
export interface DashboardWindows {
  /**
   * Local-midnight timestamps, ascending, one per bar of the chart. The last
   * entry is today's midnight, and the one before it is yesterday's.
   */
  dayStarts: number[]
  /**
   * Tomorrow's local midnight — the exclusive end of today.
   *
   * Without it the last bar and the "today" card have no upper bound at all,
   * and an order stamped in the future is counted in today's takings. The
   * browser code this replaced closed the last bucket at tomorrow's midnight;
   * this is that bound, carried across rather than re-derived from a `+ 24h`
   * that a DST change makes wrong.
   */
  todayEnd: number
  /** Start of the wider window the type/source breakdowns cover. */
  breakdownSince: number
  /** The moment the answer is for. */
  now: number
}

export interface DashboardTotals {
  /**
   * Money that actually arrived, over the orders in this window.
   *
   * NOT the sum of what was ordered. See `COLLECTED_PAYMENT_STATUSES` — an
   * order that was placed and never paid for is a real order and no revenue,
   * and it is counted in `orderCount` and in `uncollected` instead.
   */
  revenue: number
  /** Orders that happened. Cancelled ones are not orders any more. */
  orderCount: number
  /**
   * Average basket over the orders `revenue` is drawn from — that is,
   * `revenue / collectedOrderCount`, not `revenue / orderCount`.
   *
   * Dividing collected money by every order placed would answer a question
   * nobody asked and would fall as a service filled up with unpaid orders.
   * Both halves of the division are on this object so the reader can check it.
   */
  averageBasket: number
  /** How many of `orderCount` have actually been collected. */
  collectedOrderCount: number
  /**
   * Money on orders that happened and has not arrived: what was ordered,
   * minus what was taken.
   *
   * Surfaced rather than merely subtracted, because the gap is the number an
   * owner needs when the two disagree — an abandoned checkout and a table
   * whose cash has not been rung up look identical from the takings alone.
   */
  uncollected: number
}

export interface DashboardDay {
  /** The boundary this bar starts at — the caller owns the label. */
  dayStart: number
  /** Collected money only, on the same rule as `DashboardTotals.revenue`. */
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

/**
 * The five figures for one window, over the orders that happened in it.
 *
 * `orders` are the non-cancelled ones; this function splits them by whether
 * the money arrived rather than being handed two pre-filtered lists, so the
 * two counts cannot be computed over different sets by accident.
 */
function totals(orders: DashboardOrderRow[]): DashboardTotals {
  let revenue = 0
  let uncollected = 0
  let collectedOrderCount = 0

  for (const order of orders) {
    if (isCollected(order)) {
      revenue += order.total
      collectedOrderCount += 1
    } else {
      uncollected += order.total
    }
  }

  return {
    revenue,
    orderCount: orders.length,
    averageBasket: collectedOrderCount > 0 ? revenue / collectedOrderCount : 0,
    collectedOrderCount,
    uncollected,
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
export function assertDayStarts(dayStarts: number[], todayEnd?: number): void {
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
  if (todayEnd !== undefined && todayEnd <= (dayStarts[dayStarts.length - 1] as number)) {
    throw new Error("dashboardStats: todayEnd must be after the last boundary")
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
  assertDayStarts(windows.dayStarts, windows.todayEnd)

  // `assertDayStarts` has already refused an empty list, so both indexes exist.
  const todayStart = windows.dayStarts[windows.dayStarts.length - 1] as number
  const yesterdayStart =
    windows.dayStarts.length > 1
      ? (windows.dayStarts[windows.dayStarts.length - 2] as number)
      : todayStart

  // A cancelled order is not takings. It still counts as an order that happened
  // for nobody, which is why it is excluded here and not filtered at the read.
  //
  // This is the only filter that used to exist, and on its own it answered the
  // wrong question: it removes orders that were UNMADE, and says nothing about
  // orders that were never PAID. `totals` and the chart split what survives by
  // `paymentStatus`; see `COLLECTED_PAYMENT_STATUSES`.
  const valid = orders.filter((order) => order.status !== "cancelled")

  const activeSince = windows.now - ACTIVE_ORDER_WINDOW_MS
  const activeOrders = orders.filter(
    (order) => ACTIVE_STATUSES.has(order.status) && order.createdAt >= activeSince
  ).length

  const last7Days: DashboardDay[] = windows.dayStarts.map((dayStart, index) => {
    const dayEnd = windows.dayStarts[index + 1] ?? windows.todayEnd
    const ofThatDay = valid.filter(
      (order) => order.createdAt >= dayStart && order.createdAt < dayEnd
    )
    return {
      dayStart,
      revenue: ofThatDay
        .filter(isCollected)
        .reduce((sum, order) => sum + order.total, 0),
      orders: ofThatDay.length,
    }
  })

  const breakdown = valid.filter((order) => order.createdAt >= windows.breakdownSince)

  return {
    today: {
      ...totals(
        valid.filter(
          (order) => order.createdAt >= todayStart && order.createdAt < windows.todayEnd
        )
      ),
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
