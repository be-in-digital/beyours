import { describe, expect, it } from "vitest"

import {
  FAVOURITE_PRODUCT_CAP,
  customerKey,
  recordOrder,
  reverseOrder,
} from "../customers"

/**
 * The establishment's book of the people who have ordered from it.
 *
 * WHAT WAS MISSING (#364, #98). The data was collected four times and grouped
 * nowhere — `orders.customerInfo` per order, `emailSubscribers.metadata` for
 * subscribers only, `gamePlays` for players, `userProfiles` for accounts — and
 * `/dashboard/customers` rendered a placeholder while three surfaces sold it.
 *
 * The two things worth pinning are the ones a reader cannot check by looking:
 * the identity (an e-mail folded the same way everywhere, or the book splits
 * one person in two) and the arithmetic across the confirm/cancel pair.
 */

const NOW = 1_700_000_000_000

type Row = Record<string, unknown>

function dbWith(rows: Row[]) {
  const inserted: Row[] = []
  const patched: Array<{ id: unknown; fields: Row }> = []
  return {
    inserted,
    patched,
    ctx: {
      db: {
        query: () => ({
          withIndex: (_name: string, build: (q: unknown) => unknown) => {
            // The seek's own arguments decide the match, the way the index
            // does — so a test cannot pass on a lookup that ignores them.
            const seek: Record<string, unknown> = {}
            build({
              eq: (field: string, value: unknown) => {
                seek[field] = value
                return { eq: (f: string, v: unknown) => ((seek[f] = v), seek) }
              },
            } as never)
            return {
              first: async () =>
                rows.find((row) =>
                  Object.entries(seek).every(([field, value]) => row[field] === value)
                ) ?? null,
            }
          },
        }),
        insert: async (_table: string, doc: Row) => {
          inserted.push(doc)
          return "customer_new"
        },
        patch: async (id: unknown, fields: Row) => {
          patched.push({ id, fields })
        },
      },
    },
  }
}

const existing = (over: Row = {}): Row => ({
  _id: "customer_1",
  storeId: "store_1",
  email: "alice@example.com",
  name: "Alice",
  totalOrders: 2,
  totalSpent: 5_000,
  averageOrderValue: 2_500,
  firstOrderAt: NOW - 86_400_000,
  lastOrderAt: NOW - 3_600_000,
  orderTypes: ["pickup"],
  favoriteProducts: ["p1"],
  ...over,
})

describe("customerKey", () => {
  it("folds case and whitespace, because one person is one person", () => {
    // `emailSubscribers`, `gamePlays` and the promotion per-customer cap all
    // key on the folded address already. A cap that did not fold was bypassable
    // by changing the case, which is the same defect in a costlier place.
    expect(customerKey("  Alice@Example.COM ")).toBe("alice@example.com")
  })

  it("is null for an order that carries no address", () => {
    // A cash walk-in who gave a first name has no contact, and an address-book
    // entry that cannot be addressed is worse than an honest count.
    expect(customerKey(undefined)).toBeNull()
    expect(customerKey("")).toBeNull()
    expect(customerKey("   ")).toBeNull()
    expect(customerKey(42)).toBeNull()
  })
})

describe("recordOrder", () => {
  it("creates the person on their first confirmed order", async () => {
    const { ctx, inserted } = dbWith([])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "Alice@Example.com",
      name: "Alice",
      phone: "+33600000000",
      orderAmount: 2_400,
      orderType: "delivery",
      productIds: ["p1", "p2"],
      orderedAt: NOW,
    })
    expect(inserted[0]).toMatchObject({
      email: "alice@example.com",
      name: "Alice",
      totalOrders: 1,
      totalSpent: 2_400,
      averageOrderValue: 2_400,
      firstOrderAt: NOW,
      lastOrderAt: NOW,
      orderTypes: ["delivery"],
      favoriteProducts: ["p1", "p2"],
    })
  })

  it("names an unnamed diner rather than leaving a blank row", async () => {
    // The screen is a list of people, and an empty cell reads as a broken query.
    const { ctx, inserted } = dbWith([])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "a@b.com",
      orderAmount: 100,
      orderedAt: NOW,
    })
    expect(inserted[0]!.name).toBe("Client")
  })

  it("does nothing at all without an address", async () => {
    const { ctx, inserted, patched } = dbWith([existing()])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "  ",
      orderAmount: 2_400,
      orderedAt: NOW,
    })
    expect(inserted).toEqual([])
    expect(patched).toEqual([])
  })

  it("adds to the person already there, recomputing the average", async () => {
    const { ctx, patched } = dbWith([existing()])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 1_000,
      orderedAt: NOW,
    })
    expect(patched[0]!.fields).toMatchObject({
      totalOrders: 3,
      totalSpent: 6_000,
      averageOrderValue: 2_000,
    })
  })

  it("never moves the first order", async () => {
    // The only field here that answers "how long have they been coming".
    const { ctx, patched } = dbWith([existing()])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 1_000,
      orderedAt: NOW,
    })
    expect(patched[0]!.fields).not.toHaveProperty("firstOrderAt")
  })

  it("takes the newest name, because a diner may correct a typo", async () => {
    const { ctx, patched } = dbWith([existing({ name: "Alcie" })])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      name: "Alice",
      orderAmount: 1_000,
      orderedAt: NOW,
    })
    expect(patched[0]!.fields.name).toBe("Alice")
  })

  it("keeps the old name when the new order carries none", async () => {
    const { ctx, patched } = dbWith([existing()])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 1_000,
      orderedAt: NOW,
    })
    expect(patched[0]!.fields.name).toBe("Alice")
  })

  it("caps the favourite products", async () => {
    // Unbounded, a regular's row grows without limit.
    const { ctx, patched } = dbWith([
      existing({
        favoriteProducts: Array.from({ length: FAVOURITE_PRODUCT_CAP }, (_, i) => `old${i}`),
      }),
    ])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 1_000,
      productIds: ["fresh"],
      orderedAt: NOW,
    })
    const favourites = patched[0]!.fields.favoriteProducts as string[]
    expect(favourites).toHaveLength(FAVOURITE_PRODUCT_CAP)
    expect(favourites[0]).toBe("fresh")
  })

  it("does not repeat an order type it already has", async () => {
    const { ctx, patched } = dbWith([existing()])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 1_000,
      orderType: "pickup",
      orderedAt: NOW,
    })
    expect(patched[0]!.fields.orderTypes).toEqual(["pickup"])
  })

  it("does not take one establishment's customer for another's", async () => {
    // The book is per store, and a deployment may hold several.
    const { ctx, inserted } = dbWith([existing({ storeId: "store_other" })])
    await recordOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 1_000,
      orderedAt: NOW,
    })
    expect(inserted).toHaveLength(1)
  })
})

describe("reverseOrder", () => {
  it("gives back what a cancelled order added", async () => {
    const { ctx, patched } = dbWith([existing()])
    await reverseOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 2_500,
    })
    expect(patched[0]!.fields).toMatchObject({
      totalOrders: 1,
      totalSpent: 2_500,
      averageOrderValue: 2_500,
    })
  })

  it("never drives a total negative", async () => {
    // A cancellation whose confirmation was never counted — an order from
    // before this table existed — must not make the book owe money.
    const { ctx, patched } = dbWith([
      existing({ totalOrders: 0, totalSpent: 0, averageOrderValue: 0 }),
    ])
    await reverseOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 5_000,
    })
    expect(patched[0]!.fields).toMatchObject({
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    })
  })

  it("does not delete the person", async () => {
    // Someone who ordered and cancelled is still someone the establishment
    // dealt with, and removing them would make the book disagree with the
    // orders it is derived from.
    const { ctx, patched } = dbWith([existing({ totalOrders: 1, totalSpent: 2_500 })])
    await reverseOrder.handler(ctx, {
      storeId: "store_1",
      email: "alice@example.com",
      orderAmount: 2_500,
    })
    expect(patched).toHaveLength(1)
    expect(patched[0]!.fields).toMatchObject({ totalOrders: 0 })
  })

  it("is silent for somebody the book does not hold", async () => {
    const { ctx, patched } = dbWith([])
    await reverseOrder.handler(ctx, {
      storeId: "store_1",
      email: "ghost@example.com",
      orderAmount: 100,
    })
    expect(patched).toEqual([])
  })
})
