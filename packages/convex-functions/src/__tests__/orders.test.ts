import { describe, it, expect, vi } from "vitest"
import { createFromWebhook, updateStatus } from "../orders"

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
    paymentMethod: "cash",
  }

  /**
   * This test used to assert the opposite — that checkout created the ticket —
   * and so it stood on top of #136 and held it in place. A customer who reached
   * the payment provider and closed the tab left a slip on the pass, and the
   * kitchen cooked an order nobody had paid for.
   */
  it("creates the order and NO kitchen ticket while the payment is pending", async () => {
    const { ctx, inserted } = createOrchestrationCtx()
    const orderId = await createWithTicket.handler(ctx, checkoutArgs as never)

    expect(orderId).toMatch(/^orders:/)
    expect(inserted.find((entry) => entry.table === "kitchenTickets")).toBeUndefined()
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
  function createOrderCtx(order: Record<string, unknown>, payments: Doc[] = []) {
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
        query: (table: string) => {
          // `updateStatus` reads two tables now: `payments` on a refund, and
          // `kitchenTickets` when staff confirm an order by hand.
          const rows = table === "payments" ? payments : []
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

  const baseOrder = { status: "pending", paymentStatus: "unpaid" }

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

  it("still refunds a paid order when the cancellation is legal", async () => {
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
    expect(orderPatch?.updates.paymentStatus).toBe("refunded")
    expect(orderPatch?.updates.cancellationReason).toBe("out of stock")
    expect(patches.some((p) => p.id === "payments:1")).toBe(true)
  })

  it("throws when the order does not exist", async () => {
    const { ctx } = createOrderCtx(baseOrder)

    await expect(
      updateStatus.handler(ctx, { id: "orders:missing", status: "confirmed" })
    ).rejects.toThrow(/Order not found/)
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
    ).rejects.toThrow(/Promotion not found/)
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

    await expect(create.handler(ctx, args as never)).rejects.toThrow(
      /not open for orders/
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

      await expect(create.handler(ctx, args as never)).rejects.toThrow(
        /not accepting orders/
      )
      expect(inserted).toEqual([])
    }
  )

  it("refuses an establishment whose status it does not recognise", async () => {
    // Legacy or corrupt data must keep a location out of the storefront, not
    // wave it through. The rule is an allow-list for exactly this reason.
    const { ctx } = ctxForStore({ name: "Pizza Legacy" })

    await expect(create.handler(ctx, args as never)).rejects.toThrow(
      /not open for orders/
    )
  })

  it("still reports a missing establishment as missing", async () => {
    const { ctx } = ctxForStore(null)

    await expect(create.handler(ctx, args as never)).rejects.toThrow(
      /Store not found/
    )
  })
})
