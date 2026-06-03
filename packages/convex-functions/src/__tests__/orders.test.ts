import { describe, it, expect } from "vitest"
import { createFromWebhook } from "../orders"

// ---------------------------------------------------------------------------
// Minimal in-memory Convex DB mock supporting query().filter().first() + insert.
// The handler's ctx is typed `any`, so the mock can be passed directly.
// ---------------------------------------------------------------------------

type Doc = Record<string, unknown>

function createOrdersDb(seed: Doc[] = []) {
  const orders: Doc[] = [...seed]
  let counter = 1

  // Predicate builder mirroring Convex's q.field / q.eq / q.and
  const q = {
    field: (name: string) => (doc: Doc) => doc[name],
    eq:
      (a: unknown, b: unknown) =>
      (doc: Doc) => {
        const av = typeof a === "function" ? (a as (d: Doc) => unknown)(doc) : a
        const bv = typeof b === "function" ? (b as (d: Doc) => unknown)(doc) : b
        return av === bv
      },
    and:
      (...preds: Array<(doc: Doc) => boolean>) =>
      (doc: Doc) =>
        preds.every((p) => p(doc)),
  }

  return {
    _orders: orders,
    query: () => ({
      filter: (builder: (qq: typeof q) => (doc: Doc) => boolean) => {
        const pred = builder(q)
        return {
          first: async () => orders.find(pred) ?? null,
          collect: async () => orders.filter(pred),
        }
      },
      withIndex: () => ({ first: async () => null, collect: async () => [] }),
    }),
    insert: async (table: string, doc: Doc) => {
      const _id = `${table}:${counter++}`
      orders.push({ _id, ...doc })
      return _id
    },
    get: async (id: string) => orders.find((o) => o._id === id) ?? null,
  }
}

function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "stores:1",
    externalOrderId: "ext-1",
    platform: "uberEats" as const,
    status: "pending" as const,
    type: "delivery" as const,
    customerName: "John Doe",
    items: [{ externalId: "i1", name: "Item", quantity: 1, price: 2400 }],
    subtotal: 2400,
    total: 2400,
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe("createFromWebhook", () => {
  it("inserts a new order and returns created:true (amounts kept in cents)", async () => {
    const db = createOrdersDb()
    const res = await createFromWebhook.handler({ db }, baseArgs())

    expect(res.created).toBe(true)
    expect(res.orderId).toBeTruthy()
    expect(db._orders).toHaveLength(1)
    const order = db._orders[0]
    expect(order.source).toBe("uber_eats")
    expect(order.subtotal).toBe(2400) // integer cents, not 24.0
    expect(order.total).toBe(2400)
    expect(order.paymentStatus).toBe("paid")
  })

  it("is idempotent: duplicate webhook returns created:false and does not insert again", async () => {
    const db = createOrdersDb()
    const first = await createFromWebhook.handler({ db }, baseArgs())
    const second = await createFromWebhook.handler({ db }, baseArgs())

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.orderId).toBe(first.orderId)
    expect(db._orders).toHaveLength(1)
  })

  it("dedupes per (externalOrderId, source): same id on a different platform is distinct", async () => {
    const db = createOrdersDb()
    await createFromWebhook.handler({ db }, baseArgs({ platform: "uberEats" }))
    const res = await createFromWebhook.handler({ db }, baseArgs({ platform: "deliveroo" }))

    expect(res.created).toBe(true)
    expect(db._orders).toHaveLength(2)
  })

  it("computes item subtotal as price*qty + modifiers, all in cents", async () => {
    const db = createOrdersDb()
    await createFromWebhook.handler(
      { db },
      baseArgs({
        items: [
          {
            externalId: "i1",
            name: "Burger",
            quantity: 2,
            price: 1000,
            modifiers: [{ externalId: "m1", name: "Cheese", price: 150 }],
          },
        ],
      })
    )

    const item = (db._orders[0] as { items: Record<string, unknown>[] }).items[0]
    expect(item.unitPrice).toBe(1000)
    // (1000 * 2) + 150 = 2150 cents
    expect(item.subtotal).toBe(2150)
    expect(item.externalId).toBe("i1")
  })
})
