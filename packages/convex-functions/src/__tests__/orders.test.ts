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

// ---------------------------------------------------------------------------
// createWithTicket — the order feeds the kitchen (one seam, one test surface)
// ---------------------------------------------------------------------------

import { createWithTicket, toKitchenTicketItems } from "../orders"

describe("toKitchenTicketItems", () => {
  it("maps options to 'Option: Choice' labels and keeps notes", () => {
    const items = toKitchenTicketItems([
      {
        productName: "Burger",
        quantity: 2,
        unitPrice: 1000,
        subtotal: 2000,
        notes: "sans oignon",
        selectedOptions: [
          { optionName: "Cuisson", choiceName: "Saignant", priceModifier: 0 },
          { optionName: "Extra", choiceName: undefined, priceModifier: 100 },
        ],
      },
    ])
    expect(items).toEqual([
      {
        productName: "Burger",
        quantity: 2,
        options: ["Cuisson: Saignant", "Extra: "],
        notes: "sans oignon",
      },
    ])
  })

  it("returns an empty options list when none are selected", () => {
    const items = toKitchenTicketItems([
      { productName: "Coca", quantity: 1, unitPrice: 300, subtotal: 300, selectedOptions: [] },
    ])
    expect(items[0]?.options).toEqual([])
  })
})

describe("createWithTicket", () => {
  function createOrchestrationCtx() {
    const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
    let counter = 0
    const docs: Record<string, Record<string, unknown>> = {
      "stores:1": { _id: "stores:1", name: "Pizza Bobigny" },
      "products:1": {
        _id: "products:1",
        storeId: "stores:1",
        name: "Pizza",
        price: 1200,
        options: [
          {
            id: "opt1",
            name: "Taille",
            choices: [{ id: "ch1", name: "L", priceModifier: 200 }],
          },
        ],
      },
    }
    const ctx = {
      db: {
        insert: vi.fn(async (table: string, doc: Record<string, unknown>) => {
          const id = `${table}:${++counter}`
          docs[id] = { _id: id, ...doc }
          inserted.push({ table, doc })
          return id
        }),
        get: vi.fn(async (id: string) => docs[id] ?? null),
        patch: vi.fn(async (id: string, updates: Record<string, unknown>) => {
          Object.assign(docs[id] ?? {}, updates)
        }),
        query: vi.fn(() => {
          const chain = {
            withIndex: () => chain,
            order: () => chain,
            first: async () => null,
            take: async () => [],
            collect: async () => [],
          }
          return chain
        }),
      },
    }
    return { ctx, inserted }
  }

  it("creates the order AND its kitchen ticket with mapped items", async () => {
    const { ctx, inserted } = createOrchestrationCtx()
    const orderId = await createWithTicket.handler(ctx, {
      storeId: "stores:1",
      customerInfo: { name: "Nadia", phone: "0600000000" },
      items: [
        {
          productId: "products:1",
          productName: "Pizza",
          quantity: 1,
          unitPrice: 1200,
          subtotal: 1200,
          selectedOptions: [{ optionName: "Taille", choiceName: "L", priceModifier: 200 }],
        },
      ],
      type: "dine_in",
      subtotal: 1200,
      total: 1200,
      paymentMethod: "cash",
    } as never)

    expect(orderId).toMatch(/^orders:/)
    const ticket = inserted.find((entry) => entry.table === "kitchenTickets")
    expect(ticket).toBeDefined()
    expect(ticket?.doc.orderId).toBe(orderId)
    expect(ticket?.doc.source).toBe("website")
    expect((ticket?.doc.items as Array<{ options: string[] }>)[0]?.options).toEqual([
      "Taille: L",
    ])
  })
})
