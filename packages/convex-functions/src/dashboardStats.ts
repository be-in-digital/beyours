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
  /**
   * The lines of the order, for « Plats populaires ».
   *
   * Optional because a caller that only needs the money — a test fixture, a
   * summary row — should not have to invent lines. An order with no lines
   * contributes nothing to the dish rollup rather than counting as a sale of
   * nothing.
   */
  items?: DashboardOrderLine[]
  /**
   * The diner this order is attributed to: `customers.email`, already folded.
   *
   * Written on the order at the confirmation transition (#364). Absent on an
   * order placed before that table existed and on a walk-in who gave no
   * address — both of which are real, and neither of which is a diner this
   * module can count.
   */
  customerEmailKey?: string
}

/** One line of an order, as the dish rollup reads it. */
export interface DashboardOrderLine {
  /**
   * The catalogue product, when the line still points at one.
   *
   * Rolling up by id rather than by name is what makes « Pizza Margherita »
   * renamed to « Margherita » one dish instead of two. A line whose product
   * has been deleted keeps its name and no id, and falls back to the name —
   * which is the only thing left that identifies what was sold.
   */
  productId?: string
  productName: string
  quantity: number
  subtotal: number
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

/** One dish in « Plats populaires ». */
export interface DashboardProduct {
  /** The catalogue id when the line still has one; absent for a deleted product. */
  productId?: string
  /** The name as the most recent order of it recorded — see `topProducts`. */
  name: string
  /** Units sold over the period. This is what the list is ranked on. */
  quantity: number
  /** What those units came to, on the same collected-money rule as `revenue`. */
  revenue: number
  /** How many separate orders included it. */
  orderCount: number
}

/** One hour of the trading day in « Heures de pointe ». */
export interface DashboardHour {
  /** Local hour, 0-23, in the establishment's own day. */
  hour: number
  orders: number
  revenue: number
}

/**
 * Who ordered over the period, and how many of them had been here before.
 *
 * THE DEFINITION, because « taux de retour » has several and they disagree. A
 * returning diner is one whose FIRST EVER order predates this period — not one
 * who ordered twice inside it. The second reading makes the figure a function
 * of the window length: the same restaurant with the same regulars scores 8% on
 * a week and 34% on a month, which is not a rate of anything.
 *
 * Counted over diners, not orders. A regular who came four times is one
 * returning customer, not four.
 *
 * `anonymous` is the honest remainder: an order with no address belongs to a
 * person this establishment cannot recognise on their next visit, so it is
 * neither new nor returning. Reported rather than folded into either, because
 * a cash-heavy establishment would otherwise read a rate computed over a
 * minority of its trade with nothing saying so.
 */
export interface DashboardDiners {
  /** Diners with at least one order in the period, identified by address. */
  identified: number
  /** Of those, the ones whose first ever order predates the period. */
  returning: number
  /** Of those, the ones ordering here for the first time. */
  newcomers: number
  /** `returning / identified`, or 0 when nobody identifiable ordered. */
  returningRate: number
  /** Orders in the period that carry no address, so belong to no diner here. */
  anonymousOrders: number
  /**
   * True when the customer read hit its own cap, so every number here is a
   * floor over an arbitrary slice of the book (#531).
   *
   * Separate from `DashboardStats.truncated`, which is the ORDERS read. They
   * are two reads with two caps and a period can exhaust either one alone: a
   * busy month of small orders fills the order cap, a mailing-list-heavy year
   * fills this one.
   */
  truncated: boolean
}

export interface DashboardStats {
  today: DashboardTotals & { activeOrders: number }
  yesterday: DashboardTotals
  /**
   * One entry per boundary in `dayStarts`, in the same order.
   *
   * This was `last7Days` while seven was the only window there was. The period
   * is now the caller's to choose, and a field called `last7Days` holding
   * thirty entries is the kind of name that survives into a chart axis.
   */
  days: DashboardDay[]
  byType: DashboardBreakdownEntry[]
  bySource: DashboardBreakdownEntry[]
  /** Dishes over the period, most units first. */
  topProducts: DashboardProduct[]
  /** The trading day hour by hour, 24 entries, always all of them. */
  hourly: DashboardHour[]
  /** Who ordered over the period. `null` when the caller supplied no diners. */
  diners: DashboardDiners | null
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

/** How many dishes « Plats populaires » lists. */
export const TOP_PRODUCT_LIMIT = 8

/**
 * The dishes that sold, most units first.
 *
 * RANKED ON UNITS, NOT MONEY. « Plats populaires » is a question about what the
 * kitchen is making, and ranking on revenue answers a different one — the
 * 38 € plateau outranks the 9 € burger the establishment sells forty of. Both
 * figures are returned so the reader can see the other ordering; only one can
 * be the sort.
 *
 * KEYED ON `productId` WHERE THERE IS ONE. A dish renamed mid-period is one
 * dish, and two dishes that happen to share a name are two. A line whose
 * product was deleted has no id left and falls back to the name, which is all
 * that still identifies what was sold — so a deleted product does not vanish
 * from the history of a period it sold in.
 *
 * THE NAME COMES FROM THE MOST RECENT ORDER of that dish. `orders` are passed
 * newest first (the query reads `.order("desc")`), so the first line seen for a
 * key wins and a rename shows up under the new name.
 *
 * Money is COLLECTED money, the same rule as everywhere else here: a line on an
 * unpaid order counts as a dish the kitchen made and as no revenue. `quantity`
 * counts it either way, because the kitchen made it either way.
 */
export function topProducts(
  orders: DashboardOrderRow[],
  limit: number = TOP_PRODUCT_LIMIT
): DashboardProduct[] {
  const byKey = new Map<string, DashboardProduct>()

  for (const order of orders) {
    const collected = isCollected(order)
    for (const line of order.items ?? []) {
      const key = line.productId ?? `name:${line.productName}`
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity += line.quantity
        existing.orderCount += 1
        if (collected) existing.revenue += line.subtotal
      } else {
        byKey.set(key, {
          ...(line.productId ? { productId: line.productId } : {}),
          name: line.productName,
          quantity: line.quantity,
          revenue: collected ? line.subtotal : 0,
          orderCount: 1,
        })
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, Math.max(0, limit))
}

/** Hours in a day. All of them are always reported, including the empty ones. */
const HOURS_IN_DAY = 24

/**
 * The trading day hour by hour, in the establishment's own local hours.
 *
 * NO TIMEZONE PARAMETER, AND THAT IS THE POINT. `dayStarts` are local midnights
 * the browser computed — see this module's header — so `createdAt - dayStart`
 * is elapsed local time, and dividing it by an hour gives the local hour
 * directly. A `timezoneOffsetMinutes` argument would be wrong twice a year: a
 * thirty-day period straddling the last Sunday in October contains days that
 * are 23 and 25 hours long, and one offset cannot describe both.
 *
 * ALL 24 BUCKETS, ALWAYS. A restaurant closed between 15:00 and 18:00 has a
 * real trough there, and a chart that omitted the empty hours would draw the
 * afternoon as a continuation of lunch. Empty is a measurement.
 *
 * An order outside every day of the period is dropped rather than forced into
 * the nearest bucket: it is outside the window the caller asked about.
 */
export function hourlyLoad(
  orders: DashboardOrderRow[],
  windows: { dayStarts: number[]; todayEnd: number }
): DashboardHour[] {
  const buckets: DashboardHour[] = Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({
    hour,
    orders: 0,
    revenue: 0,
  }))

  for (const order of orders) {
    // Which day of the period the order falls in. Walked from the end, because
    // the newest orders arrive first and land in the last days.
    let dayStart: number | null = null
    for (let i = windows.dayStarts.length - 1; i >= 0; i--) {
      const start = windows.dayStarts[i] as number
      const end = windows.dayStarts[i + 1] ?? windows.todayEnd
      if (order.createdAt >= start && order.createdAt < end) {
        dayStart = start
        break
      }
    }
    if (dayStart === null) continue

    const hour = Math.floor((order.createdAt - dayStart) / 3_600_000)
    // A 25-hour DST day puts one order at hour 24. It happened at the hour the
    // clock read 23 for the second time, which is the bucket a reader means.
    const bucket = buckets[Math.min(hour, HOURS_IN_DAY - 1)]
    if (!bucket) continue
    bucket.orders += 1
    if (isCollected(order)) bucket.revenue += order.total
  }

  return buckets
}

/** What `diners` needs to know about one customer of the establishment. */
export interface DashboardCustomerRow {
  firstOrderAt: number
  lastOrderAt: number
}

/**
 * Who ordered over the period, and how many had been here before.
 *
 * `customers` are the establishment's whole book, narrowed by the caller to
 * those whose `lastOrderAt` falls inside the period — which is exactly the set
 * of diners who ordered in it. `firstOrderAt < periodStart` is then the whole
 * of the question: a diner whose first ever order predates the period came
 * back.
 *
 * See `DashboardDiners` for why that definition and not "ordered twice inside
 * the window".
 */
export function diners(
  customers: DashboardCustomerRow[],
  periodStart: number,
  anonymousOrders: number,
  /**
   * Whether the caller's customer read hit its cap.
   *
   * Passed in rather than derived: this function is pure and has no idea what
   * limit the read used, which is the same reason `computeDashboardStats` takes
   * the orders' flag rather than inferring it from the array's length.
   */
  truncated = false
): DashboardDiners {
  let returning = 0
  for (const customer of customers) {
    if (customer.firstOrderAt < periodStart) returning += 1
  }
  const identified = customers.length
  return {
    identified,
    returning,
    newcomers: identified - returning,
    returningRate: identified > 0 ? returning / identified : 0,
    anonymousOrders,
    truncated,
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
  truncated = false,
  /**
   * The establishment's customer rows for the period, when the caller has them.
   *
   * Optional, and `diners` comes back `null` without it, because this module is
   * pure and a caller that only has orders — a fixture, a legacy path — must
   * not be made to fabricate a customer book. `null` is a screen that says it
   * does not know; a zero would be a screen claiming nobody came back.
   */
  customerRows?: DashboardCustomerRow[],
  /** Whether `customerRows` was cut short by its read's cap. See `DashboardDiners.truncated`. */
  customersTruncated = false
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

  const days: DashboardDay[] = windows.dayStarts.map((dayStart, index) => {
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

  // The period the three new metrics are about: the whole of the chart, which
  // is what the picker sets. `assertDayStarts` has refused an empty list.
  const periodStart = windows.dayStarts[0] as number
  const ofPeriod = valid.filter(
    (order) => order.createdAt >= periodStart && order.createdAt < windows.todayEnd
  )

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
    days,
    byType: tally(breakdown, (order) => order.type),
    // An order written before `source` existed is a website order, which is
    // what it was.
    bySource: tally(breakdown, (order) => order.source ?? "website"),
    topProducts: topProducts(ofPeriod),
    hourly: hourlyLoad(ofPeriod, windows),
    diners: customerRows
      ? diners(
          customerRows,
          periodStart,
          // Orders in the period that belong to no diner this establishment can
          // recognise. Counted here rather than in `diners` because it is a
          // fact about the ORDERS, and `diners` only ever sees the customers.
          ofPeriod.filter((order) => !order.customerEmailKey).length,
          customersTruncated
        )
      : null,
    truncated,
  }
}
