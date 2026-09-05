import { describe, it, expect, vi } from "vitest"
import {
  cancellationPaymentStatus,
  createFromWebhook,
  markCashPaid,
  updateFromWebhook,
  updateStatus,
} from "../orders"
import { planRefund } from "../refundPolicy"
import { OrderRefusedError } from "../orders"

/**
 * The refusal a call produced, as the browser would read it.
 *
 * These assertions used to match the thrown message. The messages are French
 * customer copy now, and copy is edited — the `code` is the contract, and it is
 * what `data` carries across the wire. See `refusal.ts`.
 */
async function refusalCode(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call
    return undefined
  } catch (error) {
    return error instanceof OrderRefusedError ? error.reason : undefined
  }
}

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
      // Faithful enough to be worth trusting: it applies the `eq()` constraints
      // the caller declared. It used to return null/[] unconditionally, which
      // meant any code that moved from `.filter()` to an index would appear to
      // find nothing — and an idempotency check that finds nothing looks
      // exactly like a working one right up until it duplicates every order.
      withIndex: (_name: string, builder?: (iq: unknown) => unknown) => {
        const constraints: Array<[string, unknown]> = []
        if (builder) {
          const iq = {
            eq: (field: string, value: unknown) => {
              constraints.push([field, value])
              return iq
            },
          }
          builder(iq)
        }
        const match = (doc: Doc) => constraints.every(([f, v]) => doc[f] === v)
        return {
          first: async () => orders.find(match) ?? null,
          collect: async () => orders.filter(match),
        }
      },
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

  it("prices modifiers per unit, like a storefront line, all in cents", async () => {
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
    // (1000 + 150) * 2 = 2300 cents.
    //
    // This assertion used to read 2150 — modifiers added once rather than per
    // unit — and so it held the defect in place: the same basket was cheaper
    // through a delivery platform than through the website. `verifyOrderLine`
    // (the storefront path) computes `(price + options) * quantity`, and the
    // Uber Eats mapper computes `(unitPrice + modifiers) * quantity`. Both
    // agree with each other; only this path disagreed with both.
    expect(item.subtotal).toBe(2300)
    expect(item.externalId).toBe("i1")
  })
})

// ---------------------------------------------------------------------------
// createWithTicket — the order feeds the kitchen (one seam, one test surface)
// ---------------------------------------------------------------------------

import { createWithTicket, recordPaymentStatus, toKitchenTicketItems } from "../orders"

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
      // `status` is not decoration: `create` refuses an establishment that is
      // not published, so a fixture without one is a store nobody can order
      // from.
      "stores:1": { _id: "stores:1", name: "Pizza Bobigny", status: "open" },
      // `isActive` is not decoration either: `create` refuses a dish the owner
      // switched off, so a fixture without one is a product nobody can order.
      "products:1": {
        _id: "products:1",
        storeId: "stores:1",
        name: "Pizza",
        price: 1200,
        isActive: true,
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
        // `releaseToKitchen` asks "does this order already have a ticket?"
        // before writing one, so the fake has to actually answer it — a stub
        // returning null would make the idempotency test pass without the
        // guard existing.
        query: vi.fn((table: string) => {
          const rows = () =>
            Object.values(docs).filter((doc) => String(doc._id).startsWith(`${table}:`))
          const chain = {
            withIndex: () => chain,
            order: () => chain,
            first: async () => rows()[0] ?? null,
            take: async () => rows(),
            collect: async () => rows(),
          }
          return chain
        }),
      },
    }
    return { ctx, inserted }
  }

  const checkoutArgs = {
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
    // Card, deliberately: these tests are about a payment that can be
    // ABANDONED at a provider. Cash has no provider and no redirect, so it
    // reaches the pass at checkout — that case is covered separately below.
    paymentMethod: "card",
  }

  /**
   * This test used to assert the opposite — that checkout created the ticket —
   * and so it stood on top of #136 and held it in place. A customer who reached
   * the payment provider and closed the tab left a slip on the pass, and the
   * kitchen cooked an order nobody had paid for.
   */
  it("creates the order and NO kitchen ticket while a CARD payment is pending", async () => {
    const { ctx, inserted } = createOrchestrationCtx()
    const orderId = await createWithTicket.handler(ctx, checkoutArgs as never)

    expect(orderId).toMatch(/^orders:/)
    expect(inserted.find((entry) => entry.table === "kitchenTickets")).toBeUndefined()
  })

  /**
   * The other half of the same rule, and the regression the first version of
   * this fix caused (NEW2-JOURNEY-4): gating cash on payment made order-ahead
   * cash invisible. The diner read "Commande confirmée !" — which the cash
   * branch of checkout shows without touching the server — while the pass
   * stayed empty until somebody opened the admin and recorded the money.
   */
  it("puts a CASH order on the pass at checkout, before the money is taken", async () => {
    const { ctx, inserted } = createOrchestrationCtx()
    await createWithTicket.handler(ctx, {
      ...checkoutArgs,
      paymentMethod: "cash",
    } as never)

    expect(inserted.find((entry) => entry.table === "kitchenTickets")).toBeDefined()
  })

  it("puts the ticket on the pass when the payment is confirmed", async () => {
    const { ctx, inserted } = createOrchestrationCtx()
    const orderId = await createWithTicket.handler(ctx, checkoutArgs as never)

    await recordPaymentStatus.handler(ctx, { id: orderId, paymentStatus: "paid" })

    const ticket = inserted.find((entry) => entry.table === "kitchenTickets")
    expect(ticket).toBeDefined()
    expect(ticket?.doc.orderId).toBe(orderId)
    expect(ticket?.doc.source).toBe("website")
    expect((ticket?.doc.items as Array<{ options: string[] }>)[0]?.options).toEqual([
      "Taille: L",
    ])
  })

  it("does not put a second ticket on the pass when the payment is confirmed twice", async () => {
    const { ctx, inserted } = createOrchestrationCtx()
    const orderId = await createWithTicket.handler(ctx, checkoutArgs as never)

    // The Stripe webhook and the success page both land, which is normal.
    await recordPaymentStatus.handler(ctx, { id: orderId, paymentStatus: "paid" })
    await recordPaymentStatus.handler(ctx, { id: orderId, paymentStatus: "paid" })

    expect(inserted.filter((entry) => entry.table === "kitchenTickets")).toHaveLength(1)
  })
})

// ============================================================================
// updateStatus — transition enforcement
// ============================================================================

describe("updateStatus", () => {
  function createOrderCtx(
    order: Record<string, unknown>,
    payments: Doc[] = [],
    kitchenTickets: Doc[] = []
  ) {
    const docs: Record<string, Record<string, unknown>> = {
      "orders:1": { _id: "orders:1", ...order },
    }
    for (const doc of [...payments, ...kitchenTickets]) {
      docs[doc._id as string] = doc
    }
    const patches: Array<{ id: string; updates: Record<string, unknown> }> = []

    // Routed by table name. One shared result set answered every `withIndex`
    // query, so the kitchen-ticket loop reached the payments rows and a test
    // could not tell "the cancellation wrote to a payment" from "the
    // cancellation closed a ticket".
    const tables: Record<string, Doc[]> = { payments, kitchenTickets }

    const ctx = {
      db: {
        get: async (id: string) => docs[id] ?? null,
        patch: async (id: string, updates: Record<string, unknown>) => {
          patches.push({ id, updates })
          Object.assign(docs[id] ?? {}, updates)
        },
        query: (table: string) => {
          // `updateStatus` reads two tables now: `payments` on a cancellation,
          // and `kitchenTickets` both when it closes them and when staff
          // confirm an order by hand — `releaseToKitchen` asks first whether a
          // slip is already on the pass.
          const rows = tables[table] ?? []
          const chain = {
            withIndex: () => chain,
            order: () => chain,
            first: async () => rows[0] ?? null,
            take: async () => rows,
            collect: async () => rows,
          }
          return chain
        },
      },
    }
    return { ctx, patches, docs }
  }

  // "unpaid" was not one of the values the schema allows — no order in the
  // database can ever look like this. "pending" is the real not-yet-paid state.
  const baseOrder = { status: "pending", paymentStatus: "pending" }

  it("applies a valid transition", async () => {
    const { ctx, patches } = createOrderCtx(baseOrder)

    await updateStatus.handler(ctx, { id: "orders:1", status: "confirmed" })

    expect(patches).toHaveLength(1)
    expect(patches[0]?.updates.status).toBe("confirmed")
  })

  it("rejects a transition the table forbids", async () => {
    const { ctx, patches } = createOrderCtx({ ...baseOrder, status: "preparing" })

    await expect(
      updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })
    ).rejects.toThrow(/preparing.*cancelled/)

    // Nothing must have been written before the guard fired.
    expect(patches).toHaveLength(0)
  })

  it("rejects skipping a step", async () => {
    const { ctx } = createOrderCtx(baseOrder)

    await expect(
      updateStatus.handler(ctx, { id: "orders:1", status: "completed" })
    ).rejects.toThrow(/Invalid order status transition/)
  })

  it("treats a repeated status as an idempotent no-op", async () => {
    // Webhook replays and double-clicked buttons land here; they must not blow up.
    const { ctx, patches } = createOrderCtx({ ...baseOrder, status: "confirmed" })

    await updateStatus.handler(ctx, { id: "orders:1", status: "confirmed" })

    expect(patches).toHaveLength(0)
  })

  it("lets a ready order be sent out for delivery", async () => {
    const { ctx, patches } = createOrderCtx({ ...baseOrder, status: "ready" })

    await updateStatus.handler(ctx, {
      id: "orders:1",
      status: "out_for_delivery",
    })

    expect(patches[0]?.updates.status).toBe("out_for_delivery")
  })

  // -------------------------------------------------------------------------
  // Cancelling a paid order does not refund it.
  //
  // The test that used to sit here asserted the opposite — that the handler
  // patched the order and its payments to "refunded" — and called that a
  // refund. It was a database write and nothing else: no provider was ever
  // called, so the customer's money stayed with the restaurant while the books
  // said it had been returned. The test froze that in place.
  //
  // It was worse than a wrong label. `planRefund` accepts only "succeeded" and
  // "partially_refunded", so the fake refund made the REAL one impossible:
  // `payments.refundPayment` threw `not_settled` from then on, for ever.
  // -------------------------------------------------------------------------

  it("does not touch the payments when a paid order is cancelled", async () => {
    const payments: Doc[] = [
      { _id: "payments:1", status: "succeeded", amount: 2500 },
    ]
    const { ctx, patches } = createOrderCtx(
      { status: "confirmed", paymentStatus: "paid" },
      payments
    )

    await updateStatus.handler(ctx, {
      id: "orders:1",
      status: "cancelled",
      cancellationReason: "out of stock",
    })

    expect(patches.some((p) => p.id === "payments:1")).toBe(false)
  })

  it("marks a cancelled paid order refund_pending, not refunded", async () => {
    const payments: Doc[] = [
      { _id: "payments:1", status: "succeeded", amount: 2500 },
    ]
    const { ctx, patches } = createOrderCtx(
      { status: "confirmed", paymentStatus: "paid" },
      payments
    )

    await updateStatus.handler(ctx, {
      id: "orders:1",
      status: "cancelled",
      cancellationReason: "out of stock",
    })

    const orderPatch = patches.find((p) => p.id === "orders:1")
    // "refund_pending" records that money is OWED back. "refunded" claimed it
    // had been sent.
    expect(orderPatch?.updates.paymentStatus).toBe("refund_pending")
    expect(orderPatch?.updates.cancellationReason).toBe("out of stock")
  })

  it("leaves the real refund possible after the cancellation", async () => {
    // The point of the whole change: the payment the handler left behind must
    // still pass `planRefund`, which is the gate `payments.refundPayment` runs
    // before it calls a provider. The old code left a row this threw on.
    const payments: Doc[] = [
      { _id: "payments:1", status: "succeeded", amount: 2500 },
    ]
    const { ctx, docs } = createOrderCtx(
      { status: "confirmed", paymentStatus: "paid" },
      payments
    )

    await updateStatus.handler(ctx, {
      id: "orders:1",
      status: "cancelled",
      cancellationReason: "out of stock",
    })

    const payment = payments[0] as {
      status: string
      amount: number
      refundedAmount?: number
    }
    expect(payment.status).toBe("succeeded")
    expect(payment.refundedAmount).toBeUndefined()

    const plan = planRefund({
      payment: {
        provider: "stripe",
        status: payment.status,
        amount: payment.amount,
        refundedAmount: payment.refundedAmount,
        externalId: "pi_123",
      },
      amount: 2500,
    })
    expect(plan.isFullRefund).toBe(true)
    expect(plan.refundedAmount).toBe(2500)

    // And the order really is the one carrying the flag.
    expect(docs["orders:1"]?.paymentStatus).toBe("refund_pending")
  })

  it("leaves an unpaid order's payment status alone", async () => {
    // Only a PAID order owes anything back. An unpaid one is just cancelled.
    const { ctx, patches } = createOrderCtx({
      status: "confirmed",
      paymentStatus: "pending",
    })

    await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })

    const orderPatch = patches.find((p) => p.id === "orders:1")
    expect(orderPatch?.updates.paymentStatus).toBeUndefined()
  })

  it("throws when the order does not exist", async () => {
    const { ctx } = createOrderCtx(baseOrder)

    await expect(
      updateStatus.handler(ctx, { id: "orders:missing", status: "confirmed" })
    ).rejects.toThrow(/Order not found/)
  })
})

// ============================================================================
// markCashPaid — a refund still owed must not be paid over
// ============================================================================

describe("markCashPaid", () => {
  function createCashCtx(order: Record<string, unknown>) {
    const docs: Record<string, Record<string, unknown>> = {
      // A whole order, not just a payment status: `markCashPaid` hands the
      // order to `releaseToKitchen` once the notes are in the till, and that
      // reads the lines, the type and the establishment.
      "orders:1": {
        _id: "orders:1",
        storeId: "stores:1",
        orderNumber: "A-1",
        type: "dine_in",
        status: "pending",
        total: 2500,
        items: [{ productId: "products:1", productName: "Pizza", quantity: 1 }],
        ...order,
      },
      // No `orderConfirmation`, which is every establishment on the product
      // today and reads as "auto" — so the cash release is not waived by a
      // setting nobody has set.
      "stores:1": { _id: "stores:1", name: "Pizza Bobigny" },
    }
    const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
    let counter = 0

    const ctx = {
      db: {
        get: async (id: string) => docs[id] ?? null,
        patch: async (id: string, updates: Record<string, unknown>) => {
          Object.assign(docs[id] ?? {}, updates)
        },
        insert: async (table: string, doc: Record<string, unknown>) => {
          const id = `${table}:${++counter}`
          docs[id] = { _id: id, ...doc }
          inserted.push({ table, doc })
          return id
        },
        // Answers from the documents rather than with a stub. `markCashPaid`
        // reads `globalSettings` for the currency and `releaseToKitchen` asks
        // whether a slip is already on the pass; a `query` that returned null
        // to everything could not tell a refusal apart from a release.
        query: (table: string) => {
          const rows = () =>
            Object.values(docs).filter((doc) =>
              String(doc._id).startsWith(`${table}:`)
            )
          const chain = {
            withIndex: () => chain,
            order: () => chain,
            first: async () => rows()[0] ?? null,
            take: async () => rows(),
            collect: async () => rows(),
          }
          return chain
        },
      },
    }
    return { ctx, docs, inserted }
  }

  it("refuses an order that is cancelled and awaiting its refund", async () => {
    // `refund_pending` means: paid, then cancelled, money still owed back.
    // Taking cash again would write a second payment and reset the order to
    // "paid" — erasing the refund the customer is still waiting for.
    const { ctx, inserted } = createCashCtx({
      paymentStatus: "refund_pending",
      status: "cancelled",
    })

    await expect(
      markCashPaid.handler(ctx, { orderId: "orders:1" })
    ).rejects.toThrow(/attente de remboursement/)

    // Neither a payment nor a slip. The refusal is decided before the kitchen
    // release, so an order this mutation is about to reject never reaches the
    // pass — the kitchen must not cook a cancelled dinner because the till
    // was reopened on it.
    expect(inserted).toHaveLength(0)
  })

  it("still records cash on an order that has not been paid", async () => {
    const { ctx, docs, inserted } = createCashCtx({ paymentStatus: "pending" })

    await markCashPaid.handler(ctx, { orderId: "orders:1" })

    const payments = inserted.filter((entry) => entry.table === "payments")
    expect(payments).toHaveLength(1)
    expect(payments[0]?.doc.provider).toBe("cash")
    expect(payments[0]?.doc.status).toBe("succeeded")
    expect(docs["orders:1"]?.paymentStatus).toBe("paid")
  })

  it("puts the order on the pass, because cash is a payment like any other", async () => {
    // The cash branch is the one that used to reach the till and stop there:
    // every card path confirms through `recordPaymentStatus`, and cash has
    // only this mutation. Nothing else in the suite crosses that seam, so
    // deleting the `releaseToKitchen` call in `markCashPaid` has to turn a
    // test red here or nowhere.
    const { ctx, inserted } = createCashCtx({ paymentStatus: "pending" })

    await markCashPaid.handler(ctx, { orderId: "orders:1" })

    const tickets = inserted.filter((entry) => entry.table === "kitchenTickets")
    expect(tickets).toHaveLength(1)
    expect(tickets[0]?.doc.orderId).toBe("orders:1")
  })
})

// ============================================================================
// create — the discount is server-side, end to end
//
// The pure arithmetic lives in promotionDiscount.test.ts. These tests cover the
// wiring: that `create` reads the stored promotion and ignores the client.
// ============================================================================

import { create } from "../orders"

describe("create — promotion handling", () => {
  const NOW_ISH = Date.now()

  function createPricingCtx(
    promotion?: Record<string, unknown>,
    storeStatus: string | undefined = "open"
  ) {
    const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
    const patched: Array<{ id: string; updates: Record<string, unknown> }> = []
    let counter = 0

    const docs: Record<string, Record<string, unknown>> = {
      "stores:1": { _id: "stores:1", name: "Pizza Bobigny", status: storeStatus },
      "products:1": {
        _id: "products:1",
        storeId: "stores:1",
        name: "Pizza",
        price: 10_000,
        isActive: true,
        // The product's own rate, deliberately different from the global 10 %
        // below: the order path reads the product's, and read neither before.
        taxRate: 20,
        options: [],
      },
      // Copied, not referenced: `patch` mutates in place, and a shared literal
      // would carry usageCount from one test into the next.
      ...(promotion ? { "promotions:1": { ...promotion } } : {}),
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
          patched.push({ id, updates })
        }),
        // The tax rate is read from `globalSettings`, the row the settings
        // page writes. It used to be read from `store.settings.taxRate` — a
        // legacy column no mutation declares, so the only value it could ever
        // have held came from the create payload Convex rejected (#125).
        query: vi.fn((table: string) => {
          const chain = {
            withIndex: () => chain,
            order: () => chain,
            first: async () =>
              table === "globalSettings" ? { taxRate: 10 } : null,
            take: async () => [],
            collect: async () => [],
          }
          return chain
        }),
      },
    }
    return { ctx, inserted, patched }
  }

  const baseArgs = {
    storeId: "stores:1",
    customerInfo: { name: "Nadia", email: "nadia@example.com" },
    items: [
      {
        productId: "products:1",
        productName: "Pizza",
        quantity: 1,
        unitPrice: 10_000,
        subtotal: 10_000,
        selectedOptions: [],
      },
    ],
    type: "pickup" as const,
    paymentMethod: "card",
  }

  function orderFrom(inserted: Array<{ table: string; doc: Record<string, unknown> }>) {
    return inserted.find((entry) => entry.table === "orders")?.doc
  }

  const validPromo = {
    _id: "promotions:1",
    storeId: "stores:1",
    isActive: true,
    startDate: NOW_ISH - 86_400_000,
    endDate: NOW_ISH + 86_400_000,
    discountType: "percentage",
    discountValue: 10,
    usageCount: 0,
  }

  it("charges the price on the menu, with the tax taken out of it", async () => {
    const { ctx, inserted } = createPricingCtx()
    await create.handler(ctx, baseArgs as never)

    const order = orderFrom(inserted)
    // 100,00 € on the menu is 100,00 € charged. The VAT is the share of it
    // owed at the product's own 20 %, not 20 % added on top.
    expect(order?.total).toBe(10_000)
    expect(order?.taxAmount).toBe(1_667)
    expect(order?.discountAmount).toBeUndefined()
  })

  it("IGNORES a forged discountAmount smuggled by the client", async () => {
    // This is the exact exploit the audit found: `discountAmount: 99999999`
    // used to produce a 0 € order that still sent a ticket to the kitchen.
    const { ctx, inserted } = createPricingCtx()
    await create.handler(
      ctx,
      { ...baseArgs, discountAmount: 99_999_999 } as never
    )

    const order = orderFrom(inserted)
    expect(order?.total).toBe(10_000)
    expect(order?.discountAmount).toBeUndefined()
  })

  it("applies the discount computed from the stored promotion", async () => {
    const { ctx, inserted } = createPricingCtx(validPromo)
    await create.handler(
      ctx,
      { ...baseArgs, promotionId: "promotions:1" } as never
    )

    const order = orderFrom(inserted)
    // 10 % of the 10 000 subtotal = 1 000 off the 10 000 charged
    expect(order?.discountAmount).toBe(1_000)
    expect(order?.total).toBe(9_000)
  })

  it("uses the stored promotion even when the client forges a bigger one", async () => {
    const { ctx, inserted } = createPricingCtx(validPromo)
    await create.handler(
      ctx,
      {
        ...baseArgs,
        promotionId: "promotions:1",
        discountAmount: 99_999_999,
      } as never
    )

    const order = orderFrom(inserted)
    expect(order?.discountAmount).toBe(1_000)
    expect(order?.total).toBe(9_000)
  })

  it("rejects a promotion belonging to another store", async () => {
    const { ctx } = createPricingCtx({ ...validPromo, storeId: "stores:999" })

    await expect(
      create.handler(ctx, { ...baseArgs, promotionId: "promotions:1" } as never)
    ).rejects.toThrow(/n'appartient pas à ce restaurant/)
  })

  it("rejects an expired promotion instead of burning a usage slot", async () => {
    const { ctx, inserted } = createPricingCtx({
      ...validPromo,
      endDate: NOW_ISH - 1,
    })

    await expect(
      create.handler(ctx, { ...baseArgs, promotionId: "promotions:1" } as never)
    ).rejects.toThrow(/expiré/)

    expect(inserted.find((entry) => entry.table === "orders")).toBeUndefined()
    expect(inserted.find((entry) => entry.table === "promotionUsages")).toBeUndefined()
  })

  it("rejects a promotion that reached its global usage cap", async () => {
    const { ctx } = createPricingCtx({
      ...validPromo,
      maxTotalUsage: 3,
      usageCount: 3,
    })

    await expect(
      create.handler(ctx, { ...baseArgs, promotionId: "promotions:1" } as never)
    ).rejects.toThrow(/limite d'utilisation/)
  })

  it("refuses a per-customer-capped promotion on an anonymous order", async () => {
    const { ctx } = createPricingCtx({ ...validPromo, maxUsagePerCustomer: 1 })

    await expect(
      create.handler(
        ctx,
        {
          ...baseArgs,
          customerInfo: { name: "Anonyme" }, // no email
          promotionId: "promotions:1",
        } as never
      )
    ).rejects.toThrow(/renseignez votre email/)
  })

  it("throws when the referenced promotion does not exist", async () => {
    const { ctx } = createPricingCtx()

    await expect(
      create.handler(ctx, { ...baseArgs, promotionId: "promotions:1" } as never)
    ).rejects.toThrow(/Ce code promo n'existe pas/)
  })

  it("records the usage once the order is accepted", async () => {
    const { ctx, inserted, patched } = createPricingCtx(validPromo)
    await create.handler(
      ctx,
      { ...baseArgs, promotionId: "promotions:1" } as never
    )

    expect(patched.find((p) => p.id === "promotions:1")?.updates.usageCount).toBe(1)
    const usage = inserted.find((entry) => entry.table === "promotionUsages")
    expect(usage?.doc.customerEmail).toBe("nadia@example.com")
  })

  // -------------------------------------------------------------------------
  // Caller-controlled string bounds (#323, adversarial round)
  // -------------------------------------------------------------------------
  //
  // The first round capped `customerInfo.*` and the top-level `notes` and
  // stopped there, so the megabyte it set out to refuse simply arrived through
  // one of the fields it had not reached: a 1 MB `deliveryAddress.street` and a
  // 1 MB `items[].notes` both landed in a stored row, and `items` itself was an
  // unbounded array — 500 lines built one 50 MB document.

  const MB = "x".repeat(1_000_000)

  it("refuses a megabyte hidden in the delivery address", async () => {
    const { ctx, inserted } = createPricingCtx()
    await expect(
      create.handler(ctx as never, {
        ...baseArgs,
        type: "delivery" as const,
        deliveryAddress: {
          street: MB,
          city: "Paris",
          postalCode: "75011",
          country: "France",
        },
      } as never)
    ).rejects.toThrow(/street/)
    expect(orderFrom(inserted)).toBeUndefined()
  })

  it("refuses a megabyte hidden in an order line's note", async () => {
    const { ctx, inserted } = createPricingCtx()
    await expect(
      create.handler(ctx as never, {
        ...baseArgs,
        items: [{ ...baseArgs.items[0], notes: MB }],
      } as never)
    ).rejects.toThrow()
    expect(orderFrom(inserted)).toBeUndefined()
  })

  it("refuses an order built from hundreds of lines", async () => {
    const { ctx, inserted } = createPricingCtx()
    await expect(
      create.handler(ctx as never, {
        ...baseArgs,
        items: Array.from({ length: 500 }, () => ({ ...baseArgs.items[0] })),
      } as never)
    ).rejects.toThrow(/lignes/)
    expect(orderFrom(inserted)).toBeUndefined()
  })

  it("still takes an ordinary order with an address and a note", async () => {
    const { ctx, inserted } = createPricingCtx()
    await create.handler(ctx as never, {
      ...baseArgs,
      type: "delivery" as const,
      deliveryAddress: {
        street: "12 rue Oberkampf",
        city: "Paris",
        postalCode: "75011",
        country: "France",
        instructions: "Code 1234, deuxième étage",
      },
      items: [{ ...baseArgs.items[0], notes: "Sans oignons" }],
    } as never)
    expect(orderFrom(inserted)).toBeDefined()
  })

})

// ============================================================================
// create — the establishment has to be published
// ============================================================================

/**
 * A draft establishment must not take an order.
 *
 * `stores.create` opens every new establishment in `draft`, and the storefront
 * listed those beside the real ones with an active "Commander ici" button.
 * Keeping drafts out of `stores.list` is what stops one being *reached*; this
 * is what stops one being *ordered from*. A list is only a list: a tab left
 * open from before the owner unpublished the place, a store id sitting in
 * localStorage, or a direct call all arrive here without reading it.
 */
describe("create — the establishment has to be published", () => {
  function ctxForStore(store: Record<string, unknown> | null) {
    const docs: Record<string, Record<string, unknown>> = {
      "products:1": {
        _id: "products:1",
        storeId: "stores:1",
        name: "Pizza",
        price: 1200,
        isActive: true,
        options: [],
      },
      ...(store ? { "stores:1": { _id: "stores:1", ...store } } : {}),
    }
    const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
    let counter = 0
    return {
      inserted,
      ctx: {
        db: {
          insert: vi.fn(async (table: string, doc: Record<string, unknown>) => {
            const id = `${table}:${++counter}`
            docs[id] = { _id: id, ...doc }
            inserted.push({ table, doc })
            return id
          }),
          get: vi.fn(async (id: string) => docs[id] ?? null),
          patch: vi.fn(async () => undefined),
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
      },
    }
  }

  const args = {
    storeId: "stores:1",
    customerInfo: { name: "Nadia" },
    items: [
      {
        productId: "products:1",
        productName: "Pizza",
        quantity: 1,
        unitPrice: 1200,
        subtotal: 1200,
        selectedOptions: [],
      },
    ],
    type: "pickup" as const,
  }

  it("refuses a draft establishment", async () => {
    const { ctx } = ctxForStore({ name: "Pizza Chantier", status: "draft" })

    await expect(refusalCode(create.handler(ctx, args as never))).resolves.toBe(
      "store_not_published"
    )
  })

  it("writes nothing when it refuses", async () => {
    // A half-written order is worse than no order: the kitchen ticket is
    // created in the same transaction, and a ticket for a restaurant nobody
    // opened is a ticket nobody reads.
    const { ctx, inserted } = ctxForStore({ status: "draft" })

    await expect(create.handler(ctx, args as never)).rejects.toThrow()
    expect(inserted).toEqual([])
  })

  it("accepts an open establishment", async () => {
    const { ctx } = ctxForStore({ status: "open" })

    await expect(create.handler(ctx, args as never)).resolves.toMatch(/^orders:/)
  })

  it.each(["closed", "temporarily_unavailable"])(
    "refuses a %s establishment",
    async (status) => {
      // These two used to be accepted, on the reading that whether to offer
      // ordering while closed is the storefront's call. It is not: they are the
      // two ways an owner says "not tonight" from the dashboard, the storefront
      // already greys out every button on them, and only the browser did (#224).
      // They stay *published* — listed, with a readable menu — which is the
      // wider rule `isPublishedStore` still carries.
      const { ctx, inserted } = ctxForStore({ status })

      await expect(
        refusalCode(create.handler(ctx, args as never))
      ).resolves.toBe("store_not_accepting")
      expect(inserted).toEqual([])
    }
  )

  it("refuses an establishment whose status it does not recognise", async () => {
    // Legacy or corrupt data must keep a location out of the storefront, not
    // wave it through. The rule is an allow-list for exactly this reason.
    const { ctx } = ctxForStore({ name: "Pizza Legacy" })

    await expect(refusalCode(create.handler(ctx, args as never))).resolves.toBe(
      "store_not_published"
    )
  })

  it("still reports a missing establishment as missing", async () => {
    const { ctx } = ctxForStore(null)

    await expect(refusalCode(create.handler(ctx, args as never))).resolves.toBe(
      "store_not_found"
    )
  })
})

// ============================================================================
// A cancellation only owes a refund where the restaurant took the money
//
// Since #128, cancelling a paid order flags it `refund_pending` — money owed
// back, an amber banner and a refund button in the admin. Uber Eats and
// Deliveroo orders are created `paid` and never get a `payments` row, because
// the customer paid the platform: `payments.provider` has no value for one, and
// Deliveroo refunds the customer itself on a rejection. Cancelling one of those
// therefore asked a restaurant to send back money it never held and has no way
// to send.
//
// `source` is the discriminator, not the absence of a payment row. A direct
// card order is marked paid and settled in two separate mutations, so between
// them a real Stripe order looks exactly like a marketplace one — and absence
// is also the shape of a genuine data bug, which must stay visible.
// ============================================================================

describe("cancellationPaymentStatus", () => {
  it("owes a refund on a paid website order", () => {
    expect(
      cancellationPaymentStatus({ source: "website", paymentStatus: "paid" })
    ).toBe("refund_pending")
  })

  it("owes a refund on a paid counter order", () => {
    // "pos" is the till: the restaurant is holding those notes.
    expect(
      cancellationPaymentStatus({ source: "pos", paymentStatus: "paid" })
    ).toBe("refund_pending")
  })

  it.each(["uber_eats", "deliveroo"])(
    "owes nothing on a %s order",
    (source) => {
      expect(cancellationPaymentStatus({ source, paymentStatus: "paid" })).toBeUndefined()
    }
  )

  it("owes nothing on an order that was never paid", () => {
    expect(
      cancellationPaymentStatus({ source: "website", paymentStatus: "pending" })
    ).toBeUndefined()
  })

  it("treats an unclassified source as direct", () => {
    // The default has to fall this way. A false "refund owed" is visible and an
    // operator can dismiss it; a missing one silently keeps a customer's money,
    // which is the defect #128 closed. A new marketplace must be added to the
    // list — a new direct channel needs nothing.
    expect(
      cancellationPaymentStatus({ source: "kiosk", paymentStatus: "paid" })
    ).toBe("refund_pending")
    expect(cancellationPaymentStatus({ paymentStatus: "paid" })).toBe(
      "refund_pending"
    )
  })
})

describe("cancelling a marketplace order", () => {
  function createCancelCtx(order: Record<string, unknown>) {
    const docs: Record<string, Record<string, unknown>> = {
      "orders:1": { _id: "orders:1", ...order },
    }
    const patches: Array<{ id: string; updates: Record<string, unknown> }> = []

    const ctx = {
      db: {
        get: async (id: string) => docs[id] ?? null,
        patch: async (id: string, updates: Record<string, unknown>) => {
          patches.push({ id, updates })
          Object.assign(docs[id] ?? {}, updates)
        },
        query: () => ({
          withIndex: () => ({ collect: async () => [], first: async () => null }),
        }),
      },
    }
    return { ctx, patches, docs }
  }

  it.each(["uber_eats", "deliveroo"])(
    "leaves a %s order's payment status alone",
    async (source) => {
      const { ctx, patches } = createCancelCtx({
        status: "pending",
        paymentStatus: "paid",
        source,
      })

      await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })

      const orderPatch = patches.find((p) => p.id === "orders:1")
      expect(orderPatch?.updates.status).toBe("cancelled")
      // The platform refunds its own customer. Asking the restaurant for money
      // it never received is not a refund, it is a bill.
      expect(orderPatch?.updates.paymentStatus).toBeUndefined()
    }
  )

  it("still owes the refund on a paid website order", async () => {
    // The regression guard for #128: the fix above must not reach this one.
    const { ctx, patches } = createCancelCtx({
      status: "confirmed",
      paymentStatus: "paid",
      source: "website",
    })

    await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })

    const orderPatch = patches.find((p) => p.id === "orders:1")
    expect(orderPatch?.updates.paymentStatus).toBe("refund_pending")
  })

  it("still owes the refund when the payment row has not landed yet", async () => {
    // A card order is marked paid by `internalUpdatePaymentStatus` and settled
    // by `payments.internalSettle` — two mutations, two transactions. A
    // cancellation in between sees a paid order with no `payments` row, which
    // is exactly what a marketplace order looks like. `source` tells them
    // apart; counting payment rows would not, and would drop the flag on real
    // money.
    const { ctx, patches } = createCancelCtx({
      status: "confirmed",
      paymentStatus: "paid",
      source: "website",
      paymentMethod: "card",
    })

    await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })

    const orderPatch = patches.find((p) => p.id === "orders:1")
    expect(orderPatch?.updates.paymentStatus).toBe("refund_pending")
  })
})

describe("the two webhook cancellation paths agree", () => {
  // `deliverooWebhook`'s auto-reject cancels through `updateStatus`; its
  // `order.status_update` — and Uber's `orders.failure` — cancel through
  // `updateFromWebhook`. One platform, one cancellation, and the two used to
  // write different payment statuses depending on which webhook carried it.
  function marketplaceOrder(overrides: Record<string, unknown> = {}) {
    return {
      _id: "orders:1",
      status: "pending",
      paymentStatus: "paid",
      source: "deliveroo",
      externalOrderId: "gb:1",
      ...overrides,
    }
  }

  function ctxFor(order: Record<string, unknown>) {
    const docs: Record<string, Record<string, unknown>> = {
      [order._id as string]: { ...order },
    }
    const ctx = {
      db: {
        get: async (id: string) => docs[id] ?? null,
        patch: async (id: string, updates: Record<string, unknown>) => {
          Object.assign(docs[id] ?? {}, updates)
        },
        // Routed by table, and answering through `withIndex` as well as
        // `filter`: #315 moved the order lookup onto `by_external_order`, and a
        // fake that served only `filter` reported "Order not found". Only the
        // orders table is populated, so the payments and kitchenTickets loops
        // still read empty rather than mistaking the order for one of their own.
        query: (table: string) => {
          const rows = () => (table === "orders" ? Object.values(docs) : [])
          const result = {
            first: async () => rows()[0] ?? null,
            collect: async () => rows(),
          }
          return { filter: () => result, withIndex: () => result }
        },
      },
    }
    return { ctx, docs }
  }

  it("both leave a cancelled marketplace order where it was", async () => {
    const viaStatus = ctxFor(marketplaceOrder())
    const viaWebhook = ctxFor(marketplaceOrder())

    await updateStatus.handler(viaStatus.ctx, {
      id: "orders:1",
      status: "cancelled",
    })
    await updateFromWebhook.handler(viaWebhook.ctx, {
      externalOrderId: "gb:1",
      platform: "deliveroo",
      status: "cancelled",
      updatedAt: 1_700_000_000_000,
    })

    expect(viaStatus.docs["orders:1"]?.paymentStatus).toBe("paid")
    expect(viaWebhook.docs["orders:1"]?.paymentStatus).toBe(
      viaStatus.docs["orders:1"]?.paymentStatus
    )
  })

  it("keeps a direct paid order away from the platform path entirely", async () => {
    // This asserted that both paths apply the same rule to a direct order.
    // #315 made that unreachable rather than untrue: `updateFromWebhook` now
    // collects on `by_external_order` and then matches `o.source` against the
    // platform, so a website order is not merely filtered out of the update —
    // it is never found. The divergence this guarded is now structurally
    // impossible, and that is what is asserted here.
    const viaStatus = ctxFor(
      marketplaceOrder({ source: "website", status: "confirmed" })
    )
    const viaWebhook = ctxFor(marketplaceOrder({ source: "website" }))

    await updateStatus.handler(viaStatus.ctx, {
      id: "orders:1",
      status: "cancelled",
    })

    await expect(
      updateFromWebhook.handler(viaWebhook.ctx, {
        externalOrderId: "gb:1",
        platform: "deliveroo",
        status: "cancelled",
        updatedAt: 1_700_000_000_000,
      })
    ).rejects.toThrow(/Order not found/)

    // The direct order still owes its refund, and the platform path left the
    // other one untouched rather than writing a different answer to it.
    expect(viaStatus.docs["orders:1"]?.paymentStatus).toBe("refund_pending")
    expect(viaWebhook.docs["orders:1"]?.paymentStatus).toBe("paid")
  })
})
