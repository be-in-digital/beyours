/**
 * The read count of every admin query that used to grow with the restaurant.
 *
 * WHY THIS FILE EXISTS. Convex refuses a transaction that reads more than
 * 16,384 documents. Four queries behind the screens an owner opens most —
 * `/dashboard`, `/dashboard/orders`, `/dashboard/payments`, the two
 * gamification screens — read their whole table with no window, no limit and no
 * pagination, and the campaign sender read a subscriber's entire lifetime of
 * events to answer a question about one week. Each of them ends the same way:
 * the screen throws on every load, permanently, and no admin action clears it.
 *
 * WHY IT ASSERTS COUNTS RATHER THAN ANSWERS. A test that checks the answer
 * passes on ten rows and passes again on ten million; it cannot see the defect
 * at all. These cases seed far more rows than the query may read and assert the
 * number of documents the database was asked for. Put a `.collect()` back on
 * any of these paths and the number follows the table, which is what fails
 * here.
 *
 * The double is index-faithful (see `support/countingDb`): it reads the real
 * declared indexes out of `@be-in-digital/convex-schema` and enforces Convex's
 * own rule about equalities and range bounds, so "narrow it in JavaScript
 * instead" — the shape three of these defects actually had — cannot pass either.
 */

import { describe, it, expect } from "vitest"
import {
  list as ordersList,
  recent as ordersRecent,
  dashboardStats,
  DASHBOARD_ORDER_SCAN_LIMIT,
  RECENT_ORDERS_LIMIT,
} from "../orders"
import { getByStore as paymentsGetByStore } from "../payments"
import { getStats, GAME_STATS_SCAN_LIMIT, REDEMPTION_SCAN_LIMIT } from "../gamePlay"
import { stepsSentTo, record as recordRun } from "../emailAutomationRuns"
import { sentCountsSince } from "../emailEvents"
import { getByLanguage } from "../translations"
import { remove as removePromotion, purgeUsages, PROMOTION_USAGE_BATCH } from "../promotions"
import { MAX_PAGE_SIZE } from "../pagination"
import { createCountingDb } from "./support/countingDb"

const STORE = "stores:1"
const DAY = 24 * 60 * 60 * 1000
const PAGE = 15

/** More rows than any of these queries is allowed to read. */
const BUSY = 6_000

// ---------------------------------------------------------------------------
// P-1 — /dashboard and /dashboard/orders
// ---------------------------------------------------------------------------

function busyOrders(count: number, spacingMs = 60_000) {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    _id: `orders:${i}`,
    storeId: STORE,
    status: i % 7 === 0 ? "cancelled" : "completed",
    type: i % 3 === 0 ? "pickup" : "delivery",
    source: i % 5 === 0 ? "uber_eats" : "website",
    total: 1_000,
    createdAt: now - i * spacingMs,
  }))
}

describe("orders.list", () => {
  it("reads a page, whatever the establishment's history", async () => {
    for (const rows of [500, BUSY]) {
      const ctx = createCountingDb({ orders: busyOrders(rows) })
      const page = await ordersList.handler(ctx, {
        storeId: STORE,
        paginationOpts: { numItems: PAGE, cursor: null },
      })
      expect(page.page).toHaveLength(PAGE)
      expect(ctx.reads()).toBeLessThanOrEqual(PAGE)
    }
  })

  it("narrows a status tab through the index rather than in JavaScript", async () => {
    const ctx = createCountingDb({ orders: busyOrders(BUSY) })
    const page = await ordersList.handler(ctx, {
      storeId: STORE,
      status: "cancelled",
      paginationOpts: { numItems: PAGE, cursor: null },
    })
    expect(page.page.every((order: { status: string }) => order.status === "cancelled")).toBe(true)
    // The rejected rows are never read. Filtering after a `.collect()` would
    // cost all 6,000 to return these fifteen.
    expect(ctx.reads()).toBeLessThanOrEqual(PAGE)
  })

  it("walks the history a page at a time without repeating itself", async () => {
    const ctx = createCountingDb({ orders: busyOrders(BUSY) })
    const first = await ordersList.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: PAGE, cursor: null },
    })
    const second = await ordersList.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: PAGE, cursor: first.continueCursor },
    })
    const firstIds = new Set(first.page.map((order: { _id: string }) => order._id))
    expect(second.page.some((order: { _id: string }) => firstIds.has(order._id))).toBe(false)
    expect(first.isDone).toBe(false)
  })
})

describe("orders.recent", () => {
  it("reads ten rows to show ten rows", async () => {
    const ctx = createCountingDb({ orders: busyOrders(BUSY) })
    const rows = await ordersRecent.handler(ctx, { storeId: STORE })
    expect(rows).toHaveLength(RECENT_ORDERS_LIMIT)
    expect(ctx.reads()).toBe(RECENT_ORDERS_LIMIT)
  })

  it("refuses to be turned into an unbounded read by its own argument", async () => {
    const ctx = createCountingDb({ orders: busyOrders(BUSY) })
    const rows = await ordersRecent.handler(ctx, { storeId: STORE, limit: 10_000 })
    expect(rows.length).toBeLessThanOrEqual(50)
    expect(ctx.reads()).toBeLessThanOrEqual(50)
  })
})

describe("orders.dashboardStats", () => {
  /** Seven local-midnight boundaries ending today, as the browser sends them. */
  function dayStarts(): number[] {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => midnight.getTime() - (6 - i) * DAY)
  }

  const windows = () => {
    const starts = dayStarts()
    const tomorrow = new Date(starts[starts.length - 1]!)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return {
      dayStarts: starts,
      todayEnd: tomorrow.getTime(),
      breakdownSince: Date.now() - 30 * DAY,
    }
  }

  it("reads the window, not the history", async () => {
    // Two years of trade at one order every three hours: ~5,800 rows, of which
    // roughly 240 fall inside the thirty-day breakdown window.
    const ctx = createCountingDb({ orders: busyOrders(BUSY, 3 * 60 * 60 * 1000) })
    await dashboardStats.handler(ctx, { storeId: STORE, ...windows() })
    expect(ctx.reads()).toBeLessThan(400)
  })

  it("stops at its cap when a month's trade is larger than one transaction", async () => {
    // Every row inside the window: the cap, not the window, is what bounds this.
    const ctx = createCountingDb({ orders: busyOrders(DASHBOARD_ORDER_SCAN_LIMIT + 500, 60_000) })
    const stats = await dashboardStats.handler(ctx, { storeId: STORE, ...windows() })
    expect(ctx.reads()).toBeLessThanOrEqual(DASHBOARD_ORDER_SCAN_LIMIT + 1)
    // And says so, rather than presenting a floor as a total.
    expect(stats.truncated).toBe(true)
  })

  it("answers with the aggregates rather than the orders", async () => {
    const now = Date.now()
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const todayStart = midnight.getTime()

    const ctx = createCountingDb({
      orders: [
        { _id: "orders:1", storeId: STORE, status: "completed", type: "delivery", source: "website", total: 2_000, createdAt: now - 60_000 },
        { _id: "orders:2", storeId: STORE, status: "pending", type: "pickup", source: "website", total: 1_000, createdAt: now - 120_000 },
        // Cancelled: an order that happened for nobody is not takings.
        { _id: "orders:3", storeId: STORE, status: "cancelled", type: "delivery", source: "website", total: 9_999, createdAt: now - 180_000 },
        // Yesterday.
        { _id: "orders:4", storeId: STORE, status: "completed", type: "dine_in", source: "pos", total: 3_000, createdAt: todayStart - 60_000 },
      ],
    })

    const stats = await dashboardStats.handler(ctx, { storeId: STORE, ...windows() })
    expect(stats.today.revenue).toBe(3_000)
    expect(stats.today.orderCount).toBe(2)
    expect(stats.today.averageBasket).toBe(1_500)
    expect(stats.today.activeOrders).toBe(1)
    expect(stats.yesterday.revenue).toBe(3_000)
    expect(stats.last7Days).toHaveLength(7)
    expect(stats.truncated).toBe(false)
  })

  it("refuses a boundary list it cannot bucket against", async () => {
    const ctx = createCountingDb({ orders: [] })
    await expect(
      dashboardStats.handler(ctx, {
        storeId: STORE,
        dayStarts: [],
        todayEnd: Date.now(),
        breakdownSince: Date.now() - 30 * DAY,
      })
    ).rejects.toThrow(/at least one boundary/)
  })
})

// ---------------------------------------------------------------------------
// P-2 — the gamification screens
// ---------------------------------------------------------------------------

describe("gamePlay.getStats", () => {
  function seedGamification(plays: number, redemptions: number, spacingMs = 60_000) {
    const now = Date.now()
    return createCountingDb({
      gamePlays: Array.from({ length: plays }, (_, i) => ({
        _id: `gamePlays:${i}`,
        storeId: STORE,
        didWin: i % 2 === 0,
        playedAt: now - i * spacingMs,
      })),
      prizeRedemptions: Array.from({ length: redemptions }, (_, i) => {
        const createdAt = now - i * spacingMs
        return {
          _id: `prizeRedemptions:${i}`,
          storeId: STORE,
          status: i % 3 === 0 ? "redeemed" : "pending",
          // A prize is valid for a month and then it is not. A fixture where
          // every prize ever won is still claimable is not a restaurant.
          expiresAt: createdAt + 30 * DAY,
          // `redeemByCode` writes the timestamp in the same patch as the
          // status; a row carrying only the status is not one this product can
          // produce.
          ...(i % 3 === 0 ? { redeemedAt: createdAt } : {}),
          createdAt,
        }
      }),
    })
  }

  it("reads the window rather than every scan the QR codes ever took", async () => {
    // A year of plays, three hours apart; the screens ask about thirty days.
    const ctx = seedGamification(BUSY, BUSY, 3 * 60 * 60 * 1000)
    await getStats.handler(ctx, { storeId: STORE })
    // Everything is narrowed by an index: the plays by the window, the
    // redemptions by `redeemedAt` and `expiresAt`. Nothing is read to be
    // discarded.
    expect(ctx.reads()).toBeLessThan(1_000)
  })

  it("never reads more than its cap, however busy the establishment", async () => {
    const ctx = seedGamification(GAME_STATS_SCAN_LIMIT * 3, REDEMPTION_SCAN_LIMIT * 6)
    const stats = await getStats.handler(ctx, { storeId: STORE })
    // Four slices: plays, redeemed-in-window, pending, claimed.
    expect(ctx.reads()).toBeLessThanOrEqual(
      GAME_STATS_SCAN_LIMIT + 1 + 3 * (REDEMPTION_SCAN_LIMIT + 1)
    )
    expect(stats.truncated).toBe(true)
  })

  it("counts what it read, and says when the count is a floor", async () => {
    const now = Date.now()
    const ctx = createCountingDb({
      gamePlays: [
        { _id: "gamePlays:1", storeId: STORE, didWin: true, playedAt: now - 1_000 },
        { _id: "gamePlays:2", storeId: STORE, didWin: false, playedAt: now - 2_000 },
        // Outside the window: the counters describe thirty days.
        { _id: "gamePlays:3", storeId: STORE, didWin: true, playedAt: now - 60 * DAY },
      ],
      prizeRedemptions: [
        { _id: "prizeRedemptions:1", storeId: STORE, status: "redeemed", redeemedAt: now - 1_000, expiresAt: now + DAY, createdAt: now - 1_000 },
        { _id: "prizeRedemptions:2", storeId: STORE, status: "pending", expiresAt: now + DAY, createdAt: now - 2_000 },
        // Awaiting redemption but out of date: not a prize anybody can claim.
        { _id: "prizeRedemptions:3", storeId: STORE, status: "pending", expiresAt: now - DAY, createdAt: now - 40 * DAY },
        // Handed over, but two months ago: outside the window the card reports.
        { _id: "prizeRedemptions:4", storeId: STORE, status: "redeemed", redeemedAt: now - 60 * DAY, expiresAt: now - 30 * DAY, createdAt: now - 65 * DAY },
      ],
    })

    const stats = await getStats.handler(ctx, { storeId: STORE })
    expect(stats.totalPlays).toBe(2)
    expect(stats.totalWins).toBe(1)
    expect(stats.winRate).toBe(50)
    expect(stats.totalRedeemed).toBe(1)
    expect(stats.pendingRedemptions).toBe(1)
    expect(stats.truncated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// P-3 — /dashboard/payments
// ---------------------------------------------------------------------------

describe("payments.getByStore", () => {
  const PROVIDERS = ["stripe", "sumup", "paypal", "cash"] as const
  const STATUSES = ["succeeded", "pending", "refunded", "failed"] as const

  function busyPayments(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      _id: `payments:${i}`,
      storeId: STORE,
      orderId: `orders:${i}`,
      amount: 1_000,
      currency: "EUR",
      provider: PROVIDERS[i % PROVIDERS.length],
      status: STATUSES[i % STATUSES.length],
      createdAt: Date.now() - i * 60_000,
    }))
  }

  it("reads a page of the ledger, not the ledger", async () => {
    const ctx = createCountingDb({ payments: busyPayments(BUSY) })
    const page = await paymentsGetByStore.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: PAGE, cursor: null },
    })
    expect(page.page).toHaveLength(PAGE)
    expect(ctx.reads()).toBeLessThanOrEqual(PAGE)
  })

  it.each([
    ["status only", { status: "refunded" as const }],
    ["provider only", { provider: "cash" as const }],
    ["both", { status: "succeeded" as const, provider: "stripe" as const }],
  ])("resolves the %s filter through an index", async (_name, filter) => {
    const ctx = createCountingDb({ payments: busyPayments(BUSY) })
    const page = await paymentsGetByStore.handler(ctx, {
      storeId: STORE,
      ...filter,
      paginationOpts: { numItems: PAGE, cursor: null },
    })
    for (const payment of page.page) {
      if (filter.status) expect(payment.status).toBe(filter.status)
      if (filter.provider) expect(payment.provider).toBe(filter.provider)
    }
    // The rows the filter rejects are never read.
    expect(ctx.reads()).toBeLessThanOrEqual(PAGE)
  })
})

// ---------------------------------------------------------------------------
// P-4 — the automation dispatcher
// ---------------------------------------------------------------------------

describe("emailAutomationRuns.stepsSentTo", () => {
  const AUTOMATION = "emailAutomations:1"
  const STEPS = ["welcome", "reminder", "offer", "goodbye"]

  function busyRuns(subscribers: number) {
    const rows = []
    for (let s = 0; s < subscribers; s++) {
      for (const stepId of STEPS) {
        rows.push({
          _id: `emailAutomationRuns:${s}-${stepId}`,
          automationId: AUTOMATION,
          subscriberId: `emailSubscribers:${s}`,
          storeId: STORE,
          stepId,
          occurrenceKey: "orders:1",
          sentAt: 0,
        })
      }
    }
    return rows
  }

  it("reads one subscriber's firing, not the automation's whole history", async () => {
    const ctx = createCountingDb({ emailAutomationRuns: busyRuns(2_000) })
    const steps = await stepsSentTo.handler(ctx, {
      automationId: AUTOMATION,
      subscriberId: "emailSubscribers:7",
      occurrenceKey: "orders:1",
    })
    expect([...steps].sort()).toEqual([...STEPS].sort())
    // Four steps, four documents — not 8,000.
    expect(ctx.reads()).toBe(STEPS.length)
  })

  it("keeps one firing separate from the next", async () => {
    const ctx = createCountingDb({
      emailAutomationRuns: [
        { _id: "emailAutomationRuns:1", automationId: AUTOMATION, subscriberId: "emailSubscribers:1", storeId: STORE, stepId: "welcome", occurrenceKey: "orders:1", sentAt: 0 },
        { _id: "emailAutomationRuns:2", automationId: AUTOMATION, subscriberId: "emailSubscribers:1", storeId: STORE, stepId: "welcome", occurrenceKey: "orders:2", sentAt: 0 },
      ],
    })
    // A second order must not be met with a sequence that considers itself done.
    expect(
      await stepsSentTo.handler(ctx, {
        automationId: AUTOMATION,
        subscriberId: "emailSubscribers:1",
        occurrenceKey: "orders:2",
      })
    ).toEqual(["welcome"])
  })

  it("still answers the idempotency question the write path asks", async () => {
    const ctx = createCountingDb({ emailAutomationRuns: busyRuns(500) })
    const existing = await recordRun.handler(ctx, {
      automationId: AUTOMATION,
      subscriberId: "emailSubscribers:3",
      storeId: STORE,
      stepId: "offer",
      occurrenceKey: "orders:1",
    })
    // The row already exists, so no second one is written.
    expect(existing).toBe("emailAutomationRuns:3-offer")
    expect(ctx.store.emailAutomationRuns).toHaveLength(500 * STEPS.length)
  })
})

// ---------------------------------------------------------------------------
// J-1 — the weekly cap on campaign sends
// ---------------------------------------------------------------------------

describe("emailEvents.sentCountsSince", () => {
  const BATCH = 40
  const ONE_WEEK = 7 * DAY

  /** A mailing list where everyone is loyal and nobody was mailed this week. */
  function lifetimeHistory(perSubscriber: number, insideWindow = 0) {
    const now = Date.now()
    const rows = []
    for (let s = 0; s < BATCH; s++) {
      for (let e = 0; e < perSubscriber; e++) {
        rows.push({
          _id: `emailEvents:${s}-old-${e}`,
          storeId: STORE,
          subscriberId: `emailSubscribers:${s}`,
          type: e % 2 === 0 ? "sent" : "opened",
          occurredAt: now - ONE_WEEK - e * 1_000,
        })
      }
      for (let e = 0; e < insideWindow; e++) {
        rows.push({
          _id: `emailEvents:${s}-new-${e}`,
          storeId: STORE,
          subscriberId: `emailSubscribers:${s}`,
          type: "sent",
          occurredAt: now - e * 1_000,
        })
      }
    }
    return rows
  }

  const subscriberIds = Array.from({ length: BATCH }, (_, s) => `emailSubscribers:${s}`)

  it("does not read a subscriber's lifetime to answer about a week", async () => {
    // 40 × 450 = 18,000 events, past Convex's 16,384-document ceiling: the old
    // shape did not merely run slowly here, it made every campaign for this
    // store impossible to finish.
    const ctx = createCountingDb({ emailEvents: lifetimeHistory(450) })
    const counts = await sentCountsSince.handler(ctx, {
      subscriberIds,
      since: Date.now() - ONE_WEEK,
      countLimit: 3,
    })
    expect(counts.every((c) => c.count === 0)).toBe(true)
    expect(ctx.reads()).toBe(0)
  })

  it("counts what went out this week, and stops at the cap", async () => {
    const ctx = createCountingDb({ emailEvents: lifetimeHistory(200, 5) })
    const counts = await sentCountsSince.handler(ctx, {
      subscriberIds,
      since: Date.now() - ONE_WEEK,
      countLimit: 3,
    })
    // Five went out; the cap is three, and `withinWeeklyCap` only asks whether
    // the count is below it, so three and "three or more" are the same answer.
    expect(counts.every((c) => c.count === 3)).toBe(true)
    expect(ctx.reads()).toBe(BATCH * 3)
  })

  it("is exact below the cap", async () => {
    const ctx = createCountingDb({ emailEvents: lifetimeHistory(200, 2) })
    const counts = await sentCountsSince.handler(ctx, {
      subscriberIds: ["emailSubscribers:0"],
      since: Date.now() - ONE_WEEK,
      countLimit: 3,
    })
    expect(counts[0]?.count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// The sweep: the other reads on these screens that grew with trade
// ---------------------------------------------------------------------------

describe("translations.getByLanguage", () => {
  it("pages the dictionary instead of collecting it", async () => {
    const ctx = createCountingDb({
      translations: Array.from({ length: BUSY }, (_, i) => ({
        _id: `translations:${i}`,
        storeId: STORE,
        entityType: "product",
        entityId: `products:${i}`,
        field: "name",
        languageCode: "en",
        value: `Dish ${i}`,
      })),
    })
    const page = await getByLanguage.handler(ctx, {
      storeId: STORE,
      languageCode: "en",
      paginationOpts: { numItems: 100, cursor: null },
    })
    expect(page.page).toHaveLength(100)
    expect(ctx.reads()).toBeLessThanOrEqual(100)
  })
})

describe("promotions.remove", () => {
  function usedPromotion(uses: number) {
    return createCountingDb({
      promotions: [{ _id: "promotions:1", storeId: STORE, code: "BIENVENUE" }],
      promotionUsages: Array.from({ length: uses }, (_, i) => ({
        _id: `promotionUsages:${i}`,
        promotionId: "promotions:1",
        storeId: STORE,
        customerEmail: `diner${i}@example.fr`,
      })),
    })
  }

  it("does not try to delete a popular coupon's whole history in one transaction", async () => {
    const ctx = usedPromotion(BUSY)
    const result = await removePromotion.handler(ctx, { id: "promotions:1" })
    expect(result.hasMore).toBe(true)
    expect(ctx.reads()).toBeLessThanOrEqual(PROMOTION_USAGE_BATCH + 1)
    // The offer stops working immediately even though its record is still going.
    expect(ctx.store.promotions).toHaveLength(0)
  })

  it("clears the rest a batch at a time until nothing is left", async () => {
    const ctx = usedPromotion(PROMOTION_USAGE_BATCH + 10)
    await removePromotion.handler(ctx, { id: "promotions:1" })

    let passes = 0
    let hasMore = true
    while (hasMore && passes < 10) {
      const result = await purgeUsages.handler(ctx, { promotionId: "promotions:1" })
      hasMore = result.hasMore
      passes++
    }
    expect(hasMore).toBe(false)
    expect(ctx.store.promotionUsages).toHaveLength(0)
  })

  it("finishes in one transaction when the coupon was barely used", async () => {
    const ctx = usedPromotion(3)
    const result = await removePromotion.handler(ctx, { id: "promotions:1" })
    expect(result).toEqual({ deleted: 3, hasMore: false })
  })
})

// ---------------------------------------------------------------------------
// The guard's own guard
// ---------------------------------------------------------------------------

/**
 * A double that accepts anything proves nothing.
 *
 * The hand-rolled `db` mocks elsewhere in this suite apply whatever equalities
 * a query hands them, whatever index it names — so a query can narrow on an
 * index that does not exist, or place a range bound where Convex would refuse
 * one, and still be green here. These cases hold `countingDb` to the real
 * schema, because every assertion above is worth exactly what it is worth.
 */
describe("countingDb", () => {
  it("refuses an index the table does not declare", () => {
    const ctx = createCountingDb({ orders: [] })
    expect(() =>
      ctx.db.query("orders").withIndex("by_wishful_thinking", (q: { eq: (f: string, v: unknown) => unknown }) =>
        q.eq("storeId", STORE)
      )
    ).toThrow(/has no index "by_wishful_thinking"/)
  })

  it("refuses an equality that is not on the index prefix", () => {
    const ctx = createCountingDb({ emailEvents: [] })
    expect(() =>
      ctx.db
        .query("emailEvents")
        // `by_subscriberId` carries one field. Narrowing on `type` here is the
        // JavaScript filter that made `sentCountsSince` quadratic, dressed up.
        .withIndex("by_subscriberId", (q: { eq: (f: string, v: unknown) => unknown }) =>
          q.eq("subscriberId", "emailSubscribers:1").eq("type", "sent")
        )
    ).toThrow(/Equalities must cover a prefix/)
  })

  it("refuses a range bound before the equalities that precede it", () => {
    const ctx = createCountingDb({ orders: [] })
    expect(() =>
      ctx.db
        .query("orders")
        .withIndex(
          "by_storeId_createdAt",
          (q: { gte: (f: string, v: unknown) => unknown }) => q.gte("createdAt", 0)
        )
    ).toThrow(/may only be/)
  })

  it("refuses a table the schema does not declare", () => {
    const ctx = createCountingDb({})
    // Deliberately not a plausible table name. This case used to name
    // `invoices`, which was a fair example right up to the commit that added
    // an `invoices` table — at which point the schema declared it, nothing
    // threw, and the test failed for a reason that had nothing to do with
    // query bounds. A name no feature will ever want cannot be overtaken.
    expect(() => ctx.db.query("thisTableWillNeverExist")).toThrow(
      /not declared in/
    )
  })
})

// ---------------------------------------------------------------------------
// What the adversarial pass on this change found
// ---------------------------------------------------------------------------

/**
 * Six defects that the bounding itself introduced.
 *
 * A verifier briefed to break the fix found them; each one is held here so the
 * next attempt at this code does not reintroduce it. They are grouped rather
 * than filed under the query they belong to, because what they have in common
 * is the shape: a bound that is correct about read counts and wrong about
 * something else.
 */
describe("regressions the bounding introduced", () => {
  it("orders a status tab by when the order was placed, not when the row was written", async () => {
    const now = Date.now()
    // A platform webhook arrives late: written last, placed first. Ordering on
    // `_creationTime` — which is what `by_storeId_status` alone gives you —
    // puts it at the top of the tab and makes the Date column non-monotonic.
    const ctx = createCountingDb({
      orders: [
        { _id: "orders:1", storeId: STORE, status: "pending", type: "delivery", total: 100, createdAt: now - 60_000 },
        { _id: "orders:2", storeId: STORE, status: "pending", type: "delivery", total: 100, createdAt: now - 30_000 },
        { _id: "orders:3", storeId: STORE, status: "pending", type: "delivery", total: 100, createdAt: now - 3_600_000 },
      ],
    })

    const page = await ordersList.handler(ctx, {
      storeId: STORE,
      status: "pending",
      paginationOpts: { numItems: 10, cursor: null },
    })
    const dates = page.page.map((order: { createdAt: number }) => order.createdAt)
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
    expect(page.page[0]!._id).toBe("orders:2")
    expect(page.page[2]!._id).toBe("orders:3")
  })

  it("refuses to serve a page the size of the table because a caller asked for one", async () => {
    const ctx = createCountingDb({ orders: busyOrders(BUSY) })
    const page = await ordersList.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: 1_000_000, cursor: null },
    })
    // `paginationOptsValidator` accepts any size Convex will take, and Convex
    // only refuses a negative one — so an unclamped query is bounded by its
    // caller, which is the transaction the pagination exists to prevent.
    expect(page.page.length).toBeLessThanOrEqual(MAX_PAGE_SIZE)
    expect(ctx.reads()).toBeLessThanOrEqual(MAX_PAGE_SIZE)
  })

  it("clamps the payments ledger the same way", async () => {
    const ctx = createCountingDb({
      payments: Array.from({ length: BUSY }, (_, i) => ({
        _id: `payments:${i}`,
        storeId: STORE,
        orderId: `orders:${i}`,
        amount: 1_000,
        currency: "EUR",
        provider: "stripe",
        status: "succeeded",
        createdAt: Date.now() - i * 60_000,
      })),
    })
    const page = await paymentsGetByStore.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: 1_000_000, cursor: null },
    })
    expect(page.page.length).toBeLessThanOrEqual(MAX_PAGE_SIZE)
  })

  it("survives a NaN limit rather than failing inside Convex", async () => {
    // `v.number()` accepts NaN over the wire, and NaN survives both
    // `Math.floor` and `Math.min(Math.max(...))` to reach `.take()`, which
    // refuses it with an error naming an argument the caller never sent.
    const ctx = createCountingDb({ orders: busyOrders(100) })
    const rows = await ordersRecent.handler(ctx, { storeId: STORE, limit: Number.NaN })
    expect(rows).toHaveLength(RECENT_ORDERS_LIMIT)

    const counts = await sentCountsSince.handler(
      createCountingDb({ emailEvents: [] }),
      { subscriberIds: ["emailSubscribers:1"], since: 0, countLimit: Number.NaN }
    )
    expect(counts[0]?.count).toBe(0)
  })

  it("closes today at midnight rather than leaving it open-ended", async () => {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const starts = Array.from({ length: 7 }, (_, i) => midnight.getTime() - (6 - i) * DAY)
    const tomorrow = new Date(midnight)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // An order stamped three days out — a browser clock running ahead, or a
    // fixture. The browser code this replaced closed today's bucket at
    // tomorrow's midnight; an unbounded last bucket booked it as takings.
    const ctx = createCountingDb({
      orders: [
        { _id: "orders:1", storeId: STORE, status: "completed", type: "delivery", source: "website", total: 5_000, createdAt: Date.now() + 3 * DAY },
      ],
    })
    const stats = await dashboardStats.handler(ctx, {
      storeId: STORE,
      dayStarts: starts,
      todayEnd: tomorrow.getTime(),
      breakdownSince: midnight.getTime() - 30 * DAY,
    })
    expect(stats.today.orderCount).toBe(0)
    expect(stats.last7Days[6]!.orders).toBe(0)
  })

  it("refuses a todayEnd that does not come after the last boundary", async () => {
    const ctx = createCountingDb({ orders: [] })
    const starts = dayStartsFrom(new Date())
    await expect(
      dashboardStats.handler(ctx, {
        storeId: STORE,
        dayStarts: starts,
        todayEnd: starts[starts.length - 1]!,
        breakdownSince: Date.now() - 30 * DAY,
      })
    ).rejects.toThrow(/todayEnd must be after/)
  })
})

/** Seven local midnights ending on the day of `now`. */
function dayStartsFrom(now: Date): number[] {
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => midnight.getTime() - (6 - i) * DAY)
}
