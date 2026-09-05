// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * What the weekly send cap costs to enforce.
 *
 * `maxEmailsPerWeek` is answered from the events table rather than from a
 * stored tally, so that it cannot disagree with the idempotency check about
 * what actually went out. That is the right source; reading it was the
 * problem. `sentCountsSince` asked `by_subscriberId` for a subscriber's events
 * and then picked out the `sent` ones inside the week in JavaScript, so the
 * read was the size of that subscriber's entire lifetime history — every sent,
 * delivered and opened event of every campaign and automation since the day
 * they subscribed — to count the two or three inside a one-week window.
 *
 * That is not a slow query, it is a wall. Convex refuses a transaction that
 * scans more than 16,384 documents, and a batch asks this for 40 subscribers at
 * once, so a store crossed it at roughly 410 lifetime events per subscriber —
 * and then every retry crossed it too, because the history only grows. The
 * stores to hit it first are the ones whose customers have been around longest.
 *
 * `withinWeeklyCap` and `resolveWeeklyCap` are pure and were tested throughout;
 * the suite stayed green because the tested parts were not the broken part.
 * These tests hold the part that was: the cost of the read. They are written as
 * growth tests — the same question asked of a small history and a large one,
 * under a document budget sized for the window — because "it is faster now" is
 * not the property that matters. What matters is that the answer costs the same
 * whatever the history holds.
 */

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import {
  CONVEX_DOCUMENTS_READ_LIMIT,
  MAX_EMAILS_PER_WEEK,
  resolveWeeklyCap,
  withinWeeklyCap,
} from "@be-in-digital/convex-functions/campaignDelivery"
import { internal } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

const NOW = 1_700_000_000_000
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const SINCE = NOW - ONE_WEEK_MS

/** `BATCH_SIZE` in `emailCampaignActions.ts`. */
const BATCH_SIZE = 40
/** `DEFAULT_MAX_EMAILS_PER_WEEK`. */
const CAP = 3

/**
 * The budget a windowed read has to fit inside.
 *
 * Sized from the question, not from the data: one batch, at most `cap`
 * documents per subscriber, plus slack for the index bookkeeping. Every test
 * below then seeds a history far larger than this, so a query that goes back to
 * reading history cannot pass by luck — it exceeds the budget by orders of
 * magnitude and Convex refuses it, exactly as it would in production.
 */
const WINDOW_BUDGET = BATCH_SIZE * CAP + 100

// `convex-test` defaults its own ceiling to 32,000, so every harness here names
// a budget explicitly: the ones testing the read's shape use `WINDOW_BUDGET`,
// and the worst-case test uses Convex's real `CONVEX_DOCUMENTS_READ_LIMIT`.
// Nothing relies on the default, which would be looser than production.

function harness(documentsRead: number) {
  return convexTest({ schema, modules, transactionLimits: { documentsRead } })
}

async function seedStore(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.db.insert("stores", {
      name: "Chez Luigi",
      slug: "luigi",
      address: {
        street: "1 rue de la Paix",
        city: "Paris",
        postalCode: "75002",
        country: "France",
      },
      hours: [],
      status: "open" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

async function seedSubscriber(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  n: number
) {
  return t.run((ctx) =>
    ctx.db.insert("emailSubscribers", {
      storeId,
      email: `sub${n}@resto.example`,
      status: "active" as const,
      source: "storefront_form" as const,
      tags: [],
      consentAt: NOW,
      consentSource: "test",
      bounceCount: 0,
      metadata: {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        favoriteProducts: [],
        orderTypes: [],
      },
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

/**
 * A subscriber's past, as the product actually accumulates it.
 *
 * Every send produces a `sent`, and SES answers with `delivered` and often
 * `opened`, so the history is roughly three rows per email and belongs to
 * campaigns and automations alike. All of it is placed a year back — outside
 * the week the cap asks about — so any document this read touches is a document
 * it had no reason to.
 */
async function seedLifetimeHistory(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  subscriberId: Id<"emailSubscribers">,
  count: number
) {
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
  const CHUNK = 2_000 // Convex refuses more than 16,000 writes in a transaction.
  for (let start = 0; start < count; start += CHUNK) {
    await t.run(async (ctx) => {
      for (let i = start; i < Math.min(start + CHUNK, count); i++) {
        await ctx.db.insert("emailEvents", {
          storeId,
          subscriberId,
          type: (["sent", "delivered", "opened"] as const)[i % 3],
          occurredAt: NOW - ONE_YEAR_MS - i,
        })
      }
    })
  }
}

/** Sends inside the window — what the cap is actually counting. */
async function seedThisWeek(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  subscriberId: Id<"emailSubscribers">,
  count: number,
  type: "sent" | "delivered" | "opened" = "sent"
) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("emailEvents", {
        storeId,
        subscriberId,
        type,
        occurredAt: NOW - i * 60_000,
      })
    }
  })
}

const askCap = (
  t: ReturnType<typeof convexTest>,
  subscriberIds: Id<"emailSubscribers">[],
  cap = CAP
) => t.query(internal.emailEvents.sentCountsSince, { subscriberIds, since: SINCE, cap })

const countFor = (
  counts: Array<{ subscriberId: string; count: number }>,
  id: string
) => counts.find((c) => c.subscriberId === id)?.count

// ---------------------------------------------------------------------------
// The cost of the answer
// ---------------------------------------------------------------------------

describe("sentCountsSince — read cost", () => {
  test("costs the same against a long history as against a short one", async () => {
    // The property, stated directly. Two subscribers differing only in how much
    // past they have, asked the same question under the same budget. Before the
    // index, the second one alone read 10,000 documents.
    for (const history of [50, 10_000]) {
      const t = harness(WINDOW_BUDGET)
      const storeId = await seedStore(t)
      const id = await seedSubscriber(t, storeId, 0)
      await seedLifetimeHistory(t, storeId, id, history)
      await seedThisWeek(t, storeId, id, 2)

      expect(countFor(await askCap(t, [id]), id)).toBe(2)
    }
  }, 120_000)

  test("a subscriber with 10,000 lifetime events does not stop a batch", async () => {
    // The failure as a restaurant meets it: one loyal customer, in a page of 40,
    // and the campaign stops for everybody. 40 x 10,000 lifetime events is
    // 400,000 documents against a ceiling of 16,384, so this used to throw and
    // go on throwing however many times the owner pressed "Relancer".
    const t = harness(WINDOW_BUDGET)
    const storeId = await seedStore(t)

    const ids: Id<"emailSubscribers">[] = []
    for (let n = 0; n < BATCH_SIZE; n++) {
      const id = await seedSubscriber(t, storeId, n)
      ids.push(id)
      await seedLifetimeHistory(t, storeId, id, n === 0 ? 10_000 : 25)
    }
    await seedThisWeek(t, storeId, ids[0], 1)

    const counts = await askCap(t, ids)

    expect(counts).toHaveLength(BATCH_SIZE)
    expect(countFor(counts, ids[0])).toBe(1)
    // And the loyal one is still allowed through — a long history is not a
    // reason to withhold mail, which is what a thrown batch amounted to.
    expect(withinWeeklyCap(countFor(counts, ids[0]) ?? 0, CAP)).toBe(true)
    for (const id of ids.slice(1)) expect(countFor(counts, id)).toBe(0)
  }, 300_000)

  test("fits under the real ceiling at the largest cap a store can configure", async () => {
    // The cap bounds the read, so the read is only as bounded as the cap is.
    // `emailConfig.upsert` takes a bare `v.number()` — the settings screen's
    // `max(100)` is client-side — so `resolveWeeklyCap` is what holds it, and
    // this is the arithmetic that has to come out under 16,384: one batch of 40
    // at the largest cap the product offers. Run against Convex's own ceiling
    // rather than a budget of this test's choosing.
    const t = harness(CONVEX_DOCUMENTS_READ_LIMIT)
    const storeId = await seedStore(t)
    const cap = resolveWeeklyCap(1_000_000)
    expect(cap).toBe(MAX_EMAILS_PER_WEEK)

    const ids: Id<"emailSubscribers">[] = []
    for (let n = 0; n < BATCH_SIZE; n++) {
      const id = await seedSubscriber(t, storeId, n)
      ids.push(id)
      await seedThisWeek(t, storeId, id, cap + 20)
    }

    const counts = await askCap(t, ids, cap)

    expect(counts).toHaveLength(BATCH_SIZE)
    for (const id of ids) {
      expect(countFor(counts, id)).toBe(cap)
      expect(withinWeeklyCap(countFor(counts, id) ?? 0, cap)).toBe(false)
    }
  }, 300_000)

  test("stops counting at the cap however many were sent this week", async () => {
    // The window on its own still leaves the read at the mercy of how much mail
    // went out this week, and a store whose sending has run away is exactly when
    // the cap matters. Counting no further than the cap bounds it by a constant.
    const t = harness(WINDOW_BUDGET)
    const storeId = await seedStore(t)
    const id = await seedSubscriber(t, storeId, 0)
    await seedThisWeek(t, storeId, id, 5_000)

    const counts = await askCap(t, [id])

    expect(countFor(counts, id)).toBe(CAP)
    // Saturated or exact, the only question asked of the number is the same one.
    expect(withinWeeklyCap(countFor(counts, id) ?? 0, CAP)).toBe(false)
  }, 120_000)
})

// ---------------------------------------------------------------------------
// The answer itself — the index must not have changed what is counted
// ---------------------------------------------------------------------------

describe("sentCountsSince — what it counts", () => {
  test("counts sends inside the window and ignores the ones before it", async () => {
    const t = harness(WINDOW_BUDGET)
    const storeId = await seedStore(t)
    const id = await seedSubscriber(t, storeId, 0)
    await seedLifetimeHistory(t, storeId, id, 300) // a year ago
    await seedThisWeek(t, storeId, id, 2)

    expect(countFor(await askCap(t, [id]), id)).toBe(2)
  }, 120_000)

  test("does not mistake a delivery or an open for a send", async () => {
    // The events table holds the whole lifecycle and SES writes two or three
    // rows for every message. Only `sent` means an email left, and only that may
    // count against the cap — counting the rest would silence a restaurant at a
    // third of the volume it agreed to.
    const t = harness(WINDOW_BUDGET)
    const storeId = await seedStore(t)
    const id = await seedSubscriber(t, storeId, 0)
    await seedThisWeek(t, storeId, id, 1, "sent")
    await seedThisWeek(t, storeId, id, 5, "delivered")
    await seedThisWeek(t, storeId, id, 5, "opened")

    expect(countFor(await askCap(t, [id]), id)).toBe(1)
  }, 120_000)

  test("keeps each subscriber's count to their own events", async () => {
    const t = harness(WINDOW_BUDGET)
    const storeId = await seedStore(t)
    const quiet = await seedSubscriber(t, storeId, 0)
    const busy = await seedSubscriber(t, storeId, 1)
    await seedThisWeek(t, storeId, busy, 3)

    const counts = await askCap(t, [quiet, busy])

    expect(countFor(counts, quiet)).toBe(0)
    expect(countFor(counts, busy)).toBe(3)
  }, 120_000)

  test("answers for an empty page without asking anything", async () => {
    const t = harness(WINDOW_BUDGET)
    await seedStore(t)
    expect(await askCap(t, [])).toEqual([])
  }, 120_000)

  test("a cap of zero does not wave everyone through", async () => {
    // `resolveWeeklyCap` never returns one, but `.take(0)` reads nothing and
    // reports zero, which reads as "under the cap". A future caller that passes
    // one must not silently switch the guard off.
    const t = harness(WINDOW_BUDGET)
    const storeId = await seedStore(t)
    const id = await seedSubscriber(t, storeId, 0)
    await seedThisWeek(t, storeId, id, 4)

    const counts = await askCap(t, [id], 0)

    expect(countFor(counts, id)).toBeGreaterThan(0)
    expect(withinWeeklyCap(countFor(counts, id) ?? 0, 0)).toBe(false)
  }, 120_000)
})
