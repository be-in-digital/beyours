/**
 * Order history reaching the marketing side.
 *
 * `updateMetadataIncremental` was written for this and had no caller anywhere:
 * three definitions across the package and both apps, zero call sites. So
 * `totalOrders`, `totalSpent` and `lastOrderAt` were never written — and a
 * segment built on order history matched nobody. An owner could save
 * "clients ayant dépensé plus de 100 €", attach it to a campaign and send to
 * zero people, with no error and nothing to explain it.
 */

import { describe, expect, it } from "vitest"
import {
  reverseMetadataIncremental,
  updateMetadataIncremental,
} from "../emailSubscribers"

const STORE = "stores:a"

const emptyMetadata = () => ({
  totalOrders: 0,
  totalSpent: 0,
  averageOrderValue: 0,
  favoriteProducts: [] as string[],
  orderTypes: [] as string[],
})

/** A ctx holding one subscriber, whose row the handlers patch in place. */
function ctxWith(subscriber: Record<string, unknown> | null) {
  const row = subscriber ? { ...subscriber } : null
  return {
    row,
    db: {
      query: () => ({
        withIndex: (_name: string, fn: (q: unknown) => unknown) => {
          const captured: Record<string, unknown> = {}
          const q = {
            eq: (field: string, value: unknown) => {
              captured[field] = value
              return q
            },
          }
          fn(q)
          const matches =
            row &&
            row.storeId === captured.storeId &&
            row.email === captured.email
          return { first: async () => (matches ? row : null) }
        },
      }),
      patch: async (_id: unknown, updates: Record<string, unknown>) => {
        if (row) Object.assign(row, updates)
      },
    },
  }
}

const subscriber = (over: Record<string, unknown> = {}) => ({
  _id: "subs:1",
  storeId: STORE,
  email: "yanis@resto.example",
  metadata: emptyMetadata(),
  ...over,
})

const meta = (ctx: ReturnType<typeof ctxWith>) =>
  (ctx.row as { metadata: ReturnType<typeof emptyMetadata> } | null)?.metadata

describe("updateMetadataIncremental", () => {
  it("records the order against the subscriber", async () => {
    const ctx = ctxWith(subscriber())
    await updateMetadataIncremental.handler(ctx, {
      storeId: STORE,
      email: "yanis@resto.example",
      orderAmount: 4_250,
      orderType: "delivery",
      productIds: ["p1", "p2"],
      orderedAt: 1_700_000_000_000,
    })

    expect(meta(ctx)).toMatchObject({
      totalOrders: 1,
      totalSpent: 4_250,
      averageOrderValue: 4_250,
      lastOrderAt: 1_700_000_000_000,
      orderTypes: ["delivery"],
    })
  })

  it("accumulates across orders and keeps the average honest", async () => {
    const ctx = ctxWith(subscriber())
    for (const amount of [4_000, 6_000]) {
      await updateMetadataIncremental.handler(ctx, {
        storeId: STORE,
        email: "yanis@resto.example",
        orderAmount: amount,
        orderType: "pickup",
        productIds: [],
        orderedAt: 1,
      })
    }
    expect(meta(ctx)).toMatchObject({
      totalOrders: 2,
      totalSpent: 10_000,
      averageOrderValue: 5_000,
      // Merged, not repeated.
      orderTypes: ["pickup"],
    })
  })

  it("matches the address however it was typed", async () => {
    const ctx = ctxWith(subscriber())
    await updateMetadataIncremental.handler(ctx, {
      storeId: STORE,
      email: "Yanis@Resto.Example",
      orderAmount: 1_000,
      orderType: "dine_in",
      productIds: [],
      orderedAt: 1,
    })
    expect(meta(ctx)?.totalOrders).toBe(1)
  })

  it("does nothing for someone who never subscribed", async () => {
    // An order is a purchase, not consent to be marketed to. This must never
    // create a subscriber; `source: "order"` exists for that decision and
    // taking it is not this function's to make.
    const ctx = ctxWith(null)
    await expect(
      updateMetadataIncremental.handler(ctx, {
        storeId: STORE,
        email: "stranger@example.test",
        orderAmount: 9_999,
        orderType: "delivery",
        productIds: [],
        orderedAt: 1,
      })
    ).resolves.toBeUndefined()
    expect(ctx.row).toBeNull()
  })

  it("does not reach across restaurants", async () => {
    const ctx = ctxWith(subscriber())
    await updateMetadataIncremental.handler(ctx, {
      storeId: "stores:b",
      email: "yanis@resto.example",
      orderAmount: 5_000,
      orderType: "delivery",
      productIds: [],
      orderedAt: 1,
    })
    expect(meta(ctx)?.totalOrders).toBe(0)
  })
})

describe("reverseMetadataIncremental", () => {
  it("gives back what a cancelled order added", async () => {
    // `confirmed -> cancelled` is allowed by the state machine, for the window
    // before the kitchen starts. Counting the money and never returning it
    // would put revenue in `totalSpent` the restaurant never took.
    const ctx = ctxWith(
      subscriber({
        metadata: {
          ...emptyMetadata(),
          totalOrders: 2,
          totalSpent: 10_000,
          averageOrderValue: 5_000,
        },
      })
    )
    await reverseMetadataIncremental.handler(ctx, {
      storeId: STORE,
      email: "yanis@resto.example",
      orderAmount: 6_000,
    })

    expect(meta(ctx)).toMatchObject({
      totalOrders: 1,
      totalSpent: 4_000,
      averageOrderValue: 4_000,
    })
  })

  it("never drives the totals below zero", async () => {
    // A cancellation whose confirmation predates this path being wired: there
    // is nothing recorded to take back.
    const ctx = ctxWith(subscriber())
    await reverseMetadataIncremental.handler(ctx, {
      storeId: STORE,
      email: "yanis@resto.example",
      orderAmount: 5_000,
    })
    expect(meta(ctx)).toMatchObject({
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    })
  })

  it("leaves the merged fields alone, as documented", async () => {
    const ctx = ctxWith(
      subscriber({
        metadata: {
          ...emptyMetadata(),
          totalOrders: 1,
          totalSpent: 4_000,
          averageOrderValue: 4_000,
          lastOrderAt: 1_700_000_000_000,
          favoriteProducts: ["p1"],
          orderTypes: ["delivery"],
        },
      })
    )
    await reverseMetadataIncremental.handler(ctx, {
      storeId: STORE,
      email: "yanis@resto.example",
      orderAmount: 4_000,
    })

    // No per-order history exists to un-merge these from. The money questions
    // are answered correctly; the taste questions keep a trace.
    expect(meta(ctx)).toMatchObject({
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: 1_700_000_000_000,
      favoriteProducts: ["p1"],
      orderTypes: ["delivery"],
    })
  })
})
