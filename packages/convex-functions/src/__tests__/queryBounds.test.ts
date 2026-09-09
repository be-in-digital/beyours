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
 *
 * B4 added four more of the same shape, on the screens a restaurant reaches by
 * succeeding rather than by ageing: the mailing list (#316 made every signup,
 * order and game play add a row), and the storefront homepage, whose trending
 * carousel read a month of orders per open tab.
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
import { alreadySentTo, sentCountsSince } from "../emailEvents"
import { getByLanguage } from "../translations"
import { remove as removePromotion, purgeUsages, PROMOTION_USAGE_BATCH } from "../promotions"
import {
  list as subscribersList,
  countByStatus,
  SUBSCRIBER_COUNT_SCAN_LIMIT,
} from "../emailSubscribers"
import {
  countMatchingSubscribers,
  SEGMENT_PREVIEW_SCAN_LIMIT,
} from "../emailSegments"
import { dueForSending } from "../emailCampaigns"
import {
  getTrending,
  TRENDING_ORDER_SCAN_LIMIT,
  TRENDING_PRODUCT_LOOKUP_LIMIT,
  MAX_TRENDING_PRODUCTS,
} from "../products"
import { MAX_PAGE_SIZE } from "../pagination"
import { getBySiteId, getByBrandId } from "../storeIntegrations"
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
        { _id: "orders:1", storeId: STORE, status: "completed", paymentStatus: "paid", type: "delivery", source: "website", total: 2_000, createdAt: now - 60_000 },
        // On the pass and paid for — the card cleared before the kitchen saw it.
        { _id: "orders:2", storeId: STORE, status: "pending", paymentStatus: "paid", type: "pickup", source: "website", total: 1_000, createdAt: now - 120_000 },
        // Cancelled: an order that happened for nobody is not takings.
        { _id: "orders:3", storeId: STORE, status: "cancelled", paymentStatus: "pending", type: "delivery", source: "website", total: 9_999, createdAt: now - 180_000 },
        // Placed and never paid for. It is an order that happened, so it counts
        // on the "Commandes" card; it is not money, so it is not revenue.
        { _id: "orders:5", storeId: STORE, status: "completed", paymentStatus: "failed", type: "pickup", source: "website", total: 4_500, createdAt: now - 200_000 },
        // Yesterday.
        { _id: "orders:4", storeId: STORE, status: "completed", paymentStatus: "paid", type: "dine_in", source: "pos", total: 3_000, createdAt: todayStart - 60_000 },
      ],
    })

    const stats = await dashboardStats.handler(ctx, { storeId: STORE, ...windows() })
    expect(stats.today.revenue).toBe(3_000)
    expect(stats.today.orderCount).toBe(3)
    expect(stats.today.collectedOrderCount).toBe(2)
    expect(stats.today.uncollected).toBe(4_500)
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
// The idempotency check on the send path
// ---------------------------------------------------------------------------

/**
 * "Has this campaign already reached this subscriber?"
 *
 * The other send-path query, and the one that was missing from this file. It
 * collected every event on the (campaign, subscriber) pair and looked for a
 * `sent` among them in JavaScript. That pair holds one `sent` and one
 * `delivered` — and one `opened` for every time the subscriber reopened the
 * newsletter, without limit. So the cost of the idempotency check grew with
 * how much the audience LIKED the campaign, and it is asked once per
 * subscriber in every batch: measured abort at about 410 events per subscriber
 * per campaign.
 */
describe("emailEvents.alreadySentTo", () => {
  const CAMPAIGN = "emailCampaigns:1"
  const BATCH = 40

  /** Everyone was mailed once and has been opening it ever since. */
  function engagedAudience(opensEach: number) {
    const rows = []
    for (let s = 0; s < BATCH; s++) {
      rows.push({
        _id: `emailEvents:${s}-sent`,
        storeId: STORE,
        campaignId: CAMPAIGN,
        subscriberId: `emailSubscribers:${s}`,
        type: "sent",
        occurredAt: 1,
      })
      for (let e = 0; e < opensEach; e++) {
        rows.push({
          _id: `emailEvents:${s}-open-${e}`,
          storeId: STORE,
          campaignId: CAMPAIGN,
          subscriberId: `emailSubscribers:${s}`,
          type: "opened",
          occurredAt: 2 + e,
        })
      }
    }
    return rows
  }

  const subscriberIds = Array.from({ length: BATCH }, (_, s) => `emailSubscribers:${s}`)

  it("reads one document per subscriber, however engaged they are", async () => {
    // 40 × 500 opens is 20,000 documents, past Convex's 16,384-document
    // ceiling: the old shape did not merely run slowly here, it made the
    // campaign impossible to resume at all.
    const ctx = createCountingDb({ emailEvents: engagedAudience(500) })
    const reached = await alreadySentTo.handler(ctx, {
      campaignId: CAMPAIGN,
      subscriberIds,
    })

    expect(reached).toHaveLength(BATCH)
    expect(ctx.reads()).toBe(BATCH)
  })

  it("still answers correctly for someone the campaign has not reached", async () => {
    const ctx = createCountingDb({
      emailEvents: [
        {
          _id: "emailEvents:opened-only",
          storeId: STORE,
          campaignId: CAMPAIGN,
          subscriberId: "emailSubscribers:0",
          // An event on the pair that is NOT a send. The old JavaScript filter
          // is what this replaces, so the narrowing has to be at least as
          // precise.
          type: "opened",
          occurredAt: 1,
        },
      ],
    })

    expect(
      await alreadySentTo.handler(ctx, {
        campaignId: CAMPAIGN,
        subscriberIds: ["emailSubscribers:0"],
      })
    ).toEqual([])
  })

  it("does not confuse one campaign's sends with another's", async () => {
    const ctx = createCountingDb({
      emailEvents: [
        {
          _id: "emailEvents:other-campaign",
          storeId: STORE,
          campaignId: "emailCampaigns:2",
          subscriberId: "emailSubscribers:0",
          type: "sent",
          occurredAt: 1,
        },
      ],
    })

    expect(
      await alreadySentTo.handler(ctx, {
        campaignId: CAMPAIGN,
        subscriberIds: ["emailSubscribers:0"],
      })
    ).toEqual([])
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

/**
 * REWRITTEN for #412 P3-F4. Three cases here asserted that deleting a coupon
 * with 6,000 redemptions removed the promotion in the first transaction and
 * drained its ledger afterwards — "the offer stops working immediately even
 * though its record is still going". They were green, and they were blessing
 * the defect: the same delete left every order that coupon had discounted
 * naming a row that no longer resolved, with the discount still on the order
 * and on its invoice. `promotions.remove` refuses a redeemed promotion now, so
 * the batching it needed is unreachable from there; `purgeUsages` stays for the
 * drains a client deployment may already have scheduled, and is still held to
 * its budget below.
 */
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

  it("refuses a popular coupon without reading its whole history", async () => {
    const ctx = usedPromotion(BUSY)
    await expect(removePromotion.handler(ctx, { id: "promotions:1" })).rejects.toThrow()
    // One `get` for the promotion, one `.first()` for the ledger. A refusal must
    // not cost more the longer the coupon has been working.
    expect(ctx.reads()).toBeLessThanOrEqual(2)
    expect(ctx.store.promotions).toHaveLength(1)
    expect(ctx.store.promotionUsages).toHaveLength(BUSY)
  })

  it("drains a ledger left behind by an older delete, a batch at a time", async () => {
    // `purgeUsages` is reached only by a job scheduled before this guard
    // shipped. Its budget is what keeps that drain inside one transaction.
    const ctx = usedPromotion(PROMOTION_USAGE_BATCH + 10)
    const first = await purgeUsages.handler(ctx, { promotionId: "promotions:1" })
    expect(first.hasMore).toBe(true)
    expect(ctx.reads()).toBeLessThanOrEqual(PROMOTION_USAGE_BATCH + 1)

    let passes = 1
    let hasMore = true
    while (hasMore && passes < 10) {
      const result = await purgeUsages.handler(ctx, { promotionId: "promotions:1" })
      hasMore = result.hasMore
      passes++
    }
    expect(hasMore).toBe(false)
    expect(ctx.store.promotionUsages).toHaveLength(0)
  })

  it("deletes a coupon nobody ever redeemed", async () => {
    const ctx = usedPromotion(0)
    const result = await removePromotion.handler(ctx, { id: "promotions:1" })
    expect(result).toEqual({ deleted: 0, hasMore: false })
    expect(ctx.store.promotions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// B4 — the mailing list, and the homepage that reads the order book
// ---------------------------------------------------------------------------

/**
 * A list that has succeeded: past the transaction ceiling, and still growing.
 *
 * 20,000 is deliberately more than Convex will read in one transaction. Every
 * query below used to `.collect()` this, so at this size they did not run
 * slowly — they threw, on every load, for ever, with no admin action that
 * clears it. #316 made every storefront signup, order and game play add a row,
 * so a restaurant arrives here by doing well.
 */
const HUGE_LIST = 20_000

const SUBSCRIBER_STATUSES = [
  "active",
  "pending",
  "unsubscribed",
  "bounced",
  "complained",
] as const

function busySubscribers(count: number, spread = true) {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    _id: `emailSubscribers:${i}`,
    storeId: STORE,
    email: `diner${i}@example.fr`,
    status: spread ? SUBSCRIBER_STATUSES[i % SUBSCRIBER_STATUSES.length]! : "active",
    source: i % 3 === 0 ? "import" : "storefront_form",
    tags: i % 4 === 0 ? ["vip"] : [],
    consentAt: now,
    consentSource: "checkout",
    bounceCount: 0,
    metadata: {
      totalOrders: i % 10,
      totalSpent: (i % 10) * 1_000,
      averageOrderValue: 1_000,
      favoriteProducts: [],
      orderTypes: [],
      city: i % 2 === 0 ? "Paris" : "Lyon",
    },
    createdAt: now - i * 1_000,
    updatedAt: now,
  }))
}

describe("emailSubscribers.list", () => {
  it("reads a page, whatever the list has grown to", async () => {
    for (const rows of [500, HUGE_LIST]) {
      const ctx = createCountingDb({ emailSubscribers: busySubscribers(rows) })
      const page = await subscribersList.handler(ctx, {
        storeId: STORE,
        paginationOpts: { numItems: PAGE, cursor: null },
      })
      expect(page.page).toHaveLength(PAGE)
      expect(ctx.reads()).toBeLessThanOrEqual(PAGE)
    }
  })

  it("narrows a status tab through the index rather than in JavaScript", async () => {
    const ctx = createCountingDb({ emailSubscribers: busySubscribers(HUGE_LIST) })
    const page = await subscribersList.handler(ctx, {
      storeId: STORE,
      status: "bounced",
      paginationOpts: { numItems: PAGE, cursor: null },
    })
    expect(page.page.every((s: { status: string }) => s.status === "bounced")).toBe(true)
    // The 16,000 rows the tab rejects are never read.
    expect(ctx.reads()).toBeLessThanOrEqual(PAGE)
  })

  it("walks the list a page at a time without repeating itself", async () => {
    const ctx = createCountingDb({ emailSubscribers: busySubscribers(HUGE_LIST) })
    const first = await subscribersList.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: PAGE, cursor: null },
    })
    const second = await subscribersList.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: PAGE, cursor: first.continueCursor },
    })
    const firstIds = new Set(first.page.map((s: { _id: string }) => s._id))
    expect(second.page.some((s: { _id: string }) => firstIds.has(s._id))).toBe(false)
    expect(first.isDone).toBe(false)
  })

  it("refuses to serve a page the size of the list because a caller asked", async () => {
    const ctx = createCountingDb({ emailSubscribers: busySubscribers(HUGE_LIST) })
    const page = await subscribersList.handler(ctx, {
      storeId: STORE,
      paginationOpts: { numItems: 1_000_000, cursor: null },
    })
    expect(page.page.length).toBeLessThanOrEqual(MAX_PAGE_SIZE)
    expect(ctx.reads()).toBeLessThanOrEqual(MAX_PAGE_SIZE)
  })
})

describe("emailSubscribers.countByStatus", () => {
  it("counts through the index instead of downloading the list to measure it", async () => {
    const ctx = createCountingDb({ emailSubscribers: busySubscribers(HUGE_LIST) })
    const counts = await countByStatus.handler(ctx, { storeId: STORE })

    // Five index ranges, each stopped one past its cap — not 20,000 rows.
    expect(ctx.reads()).toBeLessThanOrEqual(
      SUBSCRIBER_STATUSES.length * (SUBSCRIBER_COUNT_SCAN_LIMIT + 1)
    )
    expect(ctx.reads()).toBeLessThan(16_384)
    // Every status holds 4,000 of the seed, so every one of them is a floor.
    expect(counts.active).toBe(SUBSCRIBER_COUNT_SCAN_LIMIT)
    expect(counts.truncated).toBe(true)
  })

  it("stays flat as the list grows", async () => {
    const small = createCountingDb({ emailSubscribers: busySubscribers(12_000) })
    await countByStatus.handler(small, { storeId: STORE })
    const large = createCountingDb({ emailSubscribers: busySubscribers(HUGE_LIST) })
    await countByStatus.handler(large, { storeId: STORE })
    expect(large.reads()).toBe(small.reads())
  })

  it("is exact, and says so, on a list smaller than the cap", async () => {
    const ctx = createCountingDb({
      emailSubscribers: [
        { _id: "emailSubscribers:1", storeId: STORE, status: "active" },
        { _id: "emailSubscribers:2", storeId: STORE, status: "active" },
        { _id: "emailSubscribers:3", storeId: STORE, status: "pending" },
        { _id: "emailSubscribers:4", storeId: STORE, status: "bounced" },
        // Another restaurant's list is not this one's count.
        { _id: "emailSubscribers:5", storeId: "stores:2", status: "active" },
      ],
    })
    const counts = await countByStatus.handler(ctx, { storeId: STORE })
    expect(counts).toEqual({
      total: 4,
      active: 2,
      pending: 1,
      unsubscribed: 0,
      bounced: 1,
      complained: 0,
      truncated: false,
    })
  })
})

describe("emailSegments.countMatchingSubscribers", () => {
  it("previews over a bounded sample rather than the whole active list", async () => {
    const ctx = createCountingDb({ emailSubscribers: busySubscribers(HUGE_LIST, false) })
    const preview = await countMatchingSubscribers.handler(ctx, {
      storeId: STORE,
      rules: [{ id: "r1", field: "metadata.totalSpent", operator: "gte", value: "5000" }],
      ruleOperator: "and",
    })
    expect(ctx.reads()).toBeLessThanOrEqual(SEGMENT_PREVIEW_SCAN_LIMIT + 1)
    expect(preview.scanned).toBe(SEGMENT_PREVIEW_SCAN_LIMIT)
    // The count describes the sample, and the answer says which.
    expect(preview.truncated).toBe(true)
    expect(preview.count).toBeLessThanOrEqual(SEGMENT_PREVIEW_SCAN_LIMIT)
  })

  it("still answers the question the dialog asks, on a list it can read whole", async () => {
    const ctx = createCountingDb({
      emailSubscribers: [
        { _id: "emailSubscribers:1", storeId: STORE, status: "active", tags: ["vip"], metadata: { totalSpent: 9_000 } },
        { _id: "emailSubscribers:2", storeId: STORE, status: "active", tags: [], metadata: { totalSpent: 100 } },
        // Not active: a segment is an audience, and this one is unmailable.
        { _id: "emailSubscribers:3", storeId: STORE, status: "unsubscribed", tags: ["vip"], metadata: { totalSpent: 9_000 } },
      ],
    })
    const preview = await countMatchingSubscribers.handler(ctx, {
      storeId: STORE,
      rules: [{ id: "r1", field: "tags", operator: "contains", value: "vip" }],
      ruleOperator: "and",
    })
    expect(preview).toEqual({ count: 1, scanned: 2, truncated: false })
  })
})

describe("products.getTrending", () => {
  /** A month of trade, every order carrying two lines. */
  function busySoldOrders(count: number, distinctProducts = 40) {
    const now = Date.now()
    return Array.from({ length: count }, (_, i) => ({
      _id: `orders:${i}`,
      storeId: STORE,
      status: i % 9 === 0 ? "cancelled" : "completed",
      createdAt: now - i * 60_000,
      items: [
        { productId: `products:${i % distinctProducts}`, quantity: 1 },
        { productId: `products:${(i * 7) % distinctProducts}`, quantity: 2 },
      ],
    }))
  }

  function catalogue(count: number, activeEvery = 1) {
    return Array.from({ length: count }, (_, i) => ({
      _id: `products:${i}`,
      storeId: STORE,
      name: `Plat ${i}`,
      price: 1_200,
      isActive: i % activeEvery === 0,
    }))
  }

  it("ranks from a window of recent orders, not from every order of the month", async () => {
    const ctx = createCountingDb({
      orders: busySoldOrders(HUGE_LIST),
      products: catalogue(40),
    })
    const trending = await getTrending.handler(ctx, { storeId: STORE })

    expect(trending).toHaveLength(8)
    // The 20,000 orders in the window are not the bound; the scan limit is.
    expect(ctx.reads()).toBeLessThanOrEqual(
      TRENDING_ORDER_SCAN_LIMIT + MAX_TRENDING_PRODUCTS
    )
    expect(ctx.reads()).toBeLessThan(16_384)
  })

  it("stays flat as the restaurant gets busier", async () => {
    const quiet = createCountingDb({ orders: busySoldOrders(6_000), products: catalogue(40) })
    await getTrending.handler(quiet, { storeId: STORE })
    const busy = createCountingDb({ orders: busySoldOrders(HUGE_LIST), products: catalogue(40) })
    await getTrending.handler(busy, { storeId: STORE })
    expect(busy.reads()).toBe(quiet.reads())
  })

  it("reads the newest orders, so what the cap drops is the far end of the month", async () => {
    const now = Date.now()
    const ctx = createCountingDb({
      orders: [
        // This week fills the scan window on its own.
        ...Array.from({ length: TRENDING_ORDER_SCAN_LIMIT }, (_, i) => ({
          _id: `orders:new-${i}`,
          storeId: STORE,
          status: "completed",
          createdAt: now - i * 60_000,
          items: [{ productId: "products:fresh", quantity: 1 }],
        })),
        // Three weeks ago, and by volume the runaway best-seller of the month.
        // Reading newest-first is what keeps a dish nobody has ordered since
        // out of a carousel headed "en ce moment".
        ...Array.from({ length: TRENDING_ORDER_SCAN_LIMIT }, (_, i) => ({
          _id: `orders:old-${i}`,
          storeId: STORE,
          status: "completed",
          createdAt: now - 20 * DAY - i * 60_000,
          items: [{ productId: "products:stale", quantity: 50 }],
        })),
      ],
      products: [
        { _id: "products:stale", storeId: STORE, name: "Plat d'antan", isActive: true },
        { _id: "products:fresh", storeId: STORE, name: "Plat du jour", isActive: true },
      ],
    })

    const trending = await getTrending.handler(ctx, { storeId: STORE })
    expect(trending.map((p: { _id: string }) => p._id)).toEqual(["products:fresh"])
  })

  it("gives up looking rather than walking a reworked catalogue to the end", async () => {
    // Every ranked product de-listed: the ranking is long, and nothing in it
    // can fill the carousel. The lookup budget is what stops the walk.
    const ctx = createCountingDb({
      orders: busySoldOrders(2_000, 400),
      products: catalogue(400, 100_000), // only products:0 is active
    })
    const trending = await getTrending.handler(ctx, { storeId: STORE })
    expect(trending.length).toBeLessThanOrEqual(MAX_TRENDING_PRODUCTS)
    expect(ctx.reads()).toBeLessThanOrEqual(
      TRENDING_ORDER_SCAN_LIMIT + TRENDING_PRODUCT_LOOKUP_LIMIT
    )
  })

  it("refuses a carousel the size of the catalogue because a visitor asked", async () => {
    // Public storefront query: `v.number()` takes 1,000,000 and NaN alike.
    const ctx = createCountingDb({
      orders: busySoldOrders(2_000, 400),
      products: catalogue(400),
    })
    const trending = await getTrending.handler(ctx, { storeId: STORE, limit: 1_000_000 })
    expect(trending.length).toBeLessThanOrEqual(MAX_TRENDING_PRODUCTS)

    const nan = createCountingDb({ orders: busySoldOrders(100), products: catalogue(40) })
    expect(await getTrending.handler(nan, { storeId: STORE, limit: Number.NaN })).toHaveLength(8)
  })
})

describe("emailCampaigns.dueForSending", () => {
  it("seeks the scheduled campaigns instead of scanning the archive every minute", async () => {
    const now = Date.now()
    const ctx = createCountingDb({
      stores: [{ _id: STORE, name: "Chez Luigi" }],
      emailCampaigns: [
        ...Array.from({ length: BUSY }, (_, i) => ({
          _id: `emailCampaigns:${i}`,
          storeId: STORE,
          status: i % 2 === 0 ? "sent" : "draft",
          scheduledAt: now - DAY,
        })),
        { _id: "emailCampaigns:due", storeId: STORE, status: "scheduled", scheduledAt: now - 60_000 },
        { _id: "emailCampaigns:later", storeId: STORE, status: "scheduled", scheduledAt: now + DAY },
      ],
    })

    expect(await dueForSending.handler(ctx, { now })).toEqual(["emailCampaigns:due"])
    // One store plus its two scheduled rows. The 6,000 sent and draft campaigns
    // are never read — this runs once a minute, for ever.
    expect(ctx.reads()).toBe(3)
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

  /**
   * WHAT IT COUNTS (#412 P3-F6).
   *
   * The four cases above hold the double to the schema. None of them held it
   * to the one number it exists to report, and on that number it was wrong in
   * the single shape every assertion in this file is aimed at.
   *
   * `.filter()` in Convex is a POST-SCAN predicate: the stream still reads
   * every document of the scanned range and charges each one against the
   * 16,384-document transaction limit, and the predicate only decides what
   * comes back. The double narrowed its candidate array inside `filter` and
   * then counted what survived — so `.filter().collect()` over 6,000 rows
   * scored the handful it returned, and `.filter().first()` over a table where
   * nothing matched scored ZERO for the most expensive query Convex will run.
   * That is `dueForSending`'s own defect (#327), and it is the failure the
   * hand-rolled double this one replaced was thrown out for: "it answered
   * `.filter().collect()` with the rows the test wanted".
   *
   * It was masked, not hidden: `filter` took a plain JavaScript predicate while
   * every real handler passes Convex's `FilterBuilder`, so a reintroduced
   * `.filter()` threw `TypeError` instead of under-counting — and the obvious
   * repair, teaching it the builder, would have turned that crash into a
   * silently green full-table scan.
   */
  describe("counts what Convex scans, not what the query returns", () => {
    const SCANNED = 6_000

    /** One `scheduled` campaign hiding at the end of a table of `sent` ones. */
    const haystack = () =>
      createCountingDb({
        emailCampaigns: Array.from({ length: SCANNED }, (_, i) => ({
          _id: `emailCampaigns:${i}`,
          storeId: STORE,
          status: i === SCANNED - 1 ? "scheduled" : "sent",
          scheduledAt: 1,
        })),
      })

    it("speaks Convex's filter syntax rather than a JavaScript predicate", async () => {
      const ctx = haystack()
      const rows = await ctx.db
        .query("emailCampaigns")
        .filter((q: any) => q.eq(q.field("status"), "scheduled"))
        .collect()
      expect(rows).toHaveLength(1)
    })

    it("charges the whole table for a .filter().collect()", async () => {
      const ctx = haystack()
      await ctx.db
        .query("emailCampaigns")
        .filter((q: any) => q.eq(q.field("status"), "scheduled"))
        .collect()
      expect(ctx.reads()).toBe(SCANNED)
    })

    it("charges the whole table for a .filter().first() that matches nothing", async () => {
      // The worst shape there is, and the one the old counter scored zero.
      const ctx = haystack()
      const found = await ctx.db
        .query("emailCampaigns")
        .filter((q: any) => q.eq(q.field("status"), "paused"))
        .first()
      expect(found).toBeNull()
      expect(ctx.reads()).toBe(SCANNED)
    })

    it("charges as far as the match for a .filter().first() that finds one", async () => {
      const ctx = haystack()
      await ctx.db
        .query("emailCampaigns")
        .filter((q: any) => q.eq(q.field("status"), "scheduled"))
        .first()
      expect(ctx.reads()).toBe(SCANNED)
    })

    it("charges only the index range when the narrowing is an index seek", async () => {
      // The point of the distinction: the fix for every query in this file is
      // to move the narrowing into `withIndex`, and that must still score low.
      const ctx = createCountingDb({
        emailCampaigns: Array.from({ length: SCANNED }, (_, i) => ({
          _id: `emailCampaigns:${i}`,
          storeId: i === 0 ? STORE : "stores:other",
          status: "scheduled",
          scheduledAt: 1,
        })),
      })
      await ctx.db
        .query("emailCampaigns")
        .withIndex("by_storeId_status", (q: { eq: (f: string, v: unknown) => unknown }) =>
          q.eq("storeId", STORE).eq("status", "scheduled")
        )
        .collect()
      expect(ctx.reads()).toBe(1)
    })

    it("stops a .filter().take(n) at the n-th match, and charges what it walked", async () => {
      const ctx = createCountingDb({
        emailCampaigns: Array.from({ length: 100 }, (_, i) => ({
          _id: `emailCampaigns:${i}`,
          storeId: STORE,
          // Every tenth one matches: two matches are 11 documents in.
          status: i % 10 === 0 ? "scheduled" : "sent",
          scheduledAt: 1,
        })),
      })
      const rows = await ctx.db
        .query("emailCampaigns")
        .filter((q: any) => q.eq(q.field("status"), "scheduled"))
        .take(2)
      expect(rows).toHaveLength(2)
      expect(ctx.reads()).toBe(11)
    })

    it("builds and/or/neq the way Convex does", async () => {
      const ctx = createCountingDb({
        emailCampaigns: [
          { _id: "emailCampaigns:1", storeId: STORE, status: "sent", scheduledAt: 10 },
          { _id: "emailCampaigns:2", storeId: STORE, status: "draft", scheduledAt: 20 },
          { _id: "emailCampaigns:3", storeId: "stores:other", status: "sent", scheduledAt: 30 },
        ],
      })
      const rows = await ctx.db
        .query("emailCampaigns")
        .filter((q: any) =>
          q.and(
            q.eq(q.field("storeId"), STORE),
            q.or(q.eq(q.field("status"), "sent"), q.gte(q.field("scheduledAt"), 20)),
            q.neq(q.field("_id"), "emailCampaigns:404")
          )
        )
        .collect()
      expect(rows.map((row: { _id: string }) => row._id)).toEqual([
        "emailCampaigns:1",
        "emailCampaigns:2",
      ])
      // Three documents scanned to return two.
      expect(ctx.reads()).toBe(3)
    })

    /**
     * The instrument, pointed at a live handler.
     *
     * Both platform webhooks resolve their store through these two on every
     * delivery, and both were a bare `.query().filter().first()` — the shape
     * above, on a path that runs whenever Uber Eats or Deliveroo says anything.
     * Nothing could see it: the old counter scored a miss at zero reads.
     *
     * The narrowing is in `withIndex` now, on `by_platform_enabled`, whose
     * first field is `platform`. Put the bare filter back and these fail.
     */
    describe("storeIntegrations, the first live path this caught", () => {
      const integrations = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
          _id: `storeIntegrations:${i}`,
          storeId: `stores:${i}`,
          platform: i % 2 === 0 ? "uberEats" : "deliveroo",
          platformStoreId: `site-${i}`,
          brandId: `brand-${i}`,
          enabled: true,
        }))

      it("getBySiteId reads one platform's rows, not the table", async () => {
        const ctx = createCountingDb({ storeIntegrations: integrations(400) })
        const found = await getBySiteId.handler(ctx, {
          platform: "deliveroo",
          platformStoreId: "site-399",
        })
        expect(found?._id).toBe("storeIntegrations:399")
        // 200 deliveroo rows, not 400.
        expect(ctx.reads()).toBeLessThanOrEqual(200)
      })

      it("getBySiteId does not read the table to answer a miss", async () => {
        // The expensive case: `.first()` pulls until something matches, so a
        // miss costs the whole scanned range.
        const ctx = createCountingDb({ storeIntegrations: integrations(400) })
        expect(
          await getBySiteId.handler(ctx, { platform: "deliveroo", platformStoreId: "nope" })
        ).toBeNull()
        expect(ctx.reads()).toBeLessThanOrEqual(200)
      })

      it("getByBrandId is the same shape and the same bound", async () => {
        const ctx = createCountingDb({ storeIntegrations: integrations(400) })
        expect(
          await getByBrandId.handler(ctx, { platform: "uberEats", brandId: "nope" })
        ).toBeNull()
        expect(ctx.reads()).toBeLessThanOrEqual(200)
      })
    })

    it("refuses a filter that is not a FilterBuilder expression", () => {
      // A plain JavaScript predicate is what the double used to take. Accepting
      // it silently would let a test narrow rows the counter never charged for.
      const ctx = createCountingDb({ emailCampaigns: [] })
      expect(() =>
        ctx.db
          .query("emailCampaigns")
          .filter((doc: unknown) => (doc as { status?: string }).status === "sent")
      ).toThrow(/FilterBuilder expression/)
    })
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
