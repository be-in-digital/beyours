import { describe, it, expect, vi } from "vitest"
import {
  buildOrderConfirmationPayload,
  orderConfirmationRefusal,
  planOrderConfirmation,
  readSubscriberStanding,
  releaseOrderConfirmationClaim,
} from "../orderConfirmation"
import { markCashPaid, recordPaymentStatus } from "../orders"

/**
 * The diner is told their order is paid for.
 *
 * Before this, nobody was. Five SES senders shipped and not one was
 * transactional: a guest paid and received no confirmation, no receipt and no
 * note of where to collect their food. The `orderConfirmation` template had
 * been written, registered, unit-tested and exported, with zero production
 * callers, and the only order-triggered mail in the product was the *marketing*
 * `post_order` automation — which `syncSubscriberOrderMetadata` rightly refuses
 * to enrol a buyer into.
 *
 * The two things worth holding here are the two that break quietly: exactly one
 * confirmation per order however many times the payment settles, and no
 * confirmation at all for the orders that must not get one.
 */

const NOW = 1_700_000_000_000

type Doc = Record<string, any>

/** The in-memory ctx used across this package's defs-layer tests. */
function createCtx(docs: Record<string, Doc>) {
  const store: Record<string, Doc> = JSON.parse(JSON.stringify(docs))
  const inserted: Array<{ table: string; doc: Doc }> = []
  let counter = 0

  const rowsOf = (table: string) =>
    Object.values(store).filter((row) => String(row._id).startsWith(`${table}:`))

  const db = {
    store,
    get: vi.fn(async (id: string) => store[id] ?? null),
    insert: vi.fn(async (table: string, doc: Doc) => {
      const id = `${table}:${++counter}`
      store[id] = { _id: id, ...doc }
      inserted.push({ table, doc })
      return id
    }),
    patch: vi.fn(async (id: string, updates: Doc) => {
      if (store[id]) Object.assign(store[id], updates)
    }),
    query: vi.fn((table: string) => ({
      // `globalSettings` is a singleton read without an index.
      first: async () => rowsOf(table)[0] ?? null,
      collect: async () => rowsOf(table),
      withIndex: (_index: string, build: (q: any) => any) => {
        const equalities: Record<string, unknown> = {}
        const q: any = {
          eq: (field: string, value: unknown) => {
            equalities[field] = value
            return q
          },
        }
        build(q)
        const rows = rowsOf(table).filter((row) =>
          Object.entries(equalities).every(([f, val]) => row[f] === val)
        )
        return {
          first: async () => rows[0] ?? null,
          collect: async () => rows,
          take: async () => rows,
          order: () => ({ collect: async () => rows, take: async () => rows }),
        }
      },
    })),
  }

  return { ctx: { db } as any, inserted, store }
}

function orderDoc(overrides: Doc = {}): Doc {
  return {
    _id: "orders:1",
    storeId: "stores:1",
    orderNumber: "ORD-2026-00001",
    type: "delivery",
    status: "pending",
    paymentStatus: "paid",
    paymentMethod: "card",
    source: "website",
    customerInfo: { name: "Camille", email: "Camille@Example.com" },
    items: [
      {
        productName: "Margherita",
        quantity: 2,
        unitPrice: 1200,
        subtotal: 2400,
        selectedOptions: [
          { optionName: "Taille", choiceName: "Grande", priceModifier: 0 },
        ],
        notes: "bien cuite",
      },
    ],
    subtotal: 2400,
    taxAmount: 218,
    taxBreakdown: [{ ratePercent: 10, grossAmount: 2400, taxAmount: 218 }],
    deliveryFee: 490,
    total: 2890,
    deliveryAddress: {
      street: "5 avenue de la Gare",
      city: "Lyon",
      postalCode: "69002",
      country: "FR",
    },
    viewToken: "vt-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function docs(orderOverrides: Doc = {}, extra: Record<string, Doc> = {}) {
  const order = orderDoc(orderOverrides)
  return {
    "stores:1": {
      _id: "stores:1",
      name: "Chez Luigi",
      address: {
        street: "12 rue des Lilas",
        city: "Lyon",
        postalCode: "69003",
        country: "FR",
      },
      phone: "04 78 00 00 00",
    },
    "globalSettings:1": {
      _id: "globalSettings:1",
      currency: "EUR",
      timezone: "Europe/Paris",
      taxRate: 10,
    },
    [order._id]: order,
    ...extra,
  }
}

// ============================================================================
// Who qualifies
// ============================================================================

describe("orderConfirmationRefusal", () => {
  it("confirms a paid website order to a diner who gave an address", () => {
    expect(orderConfirmationRefusal(orderDoc())).toBeNull()
  })

  it("says nothing before the money has arrived", () => {
    expect(orderConfirmationRefusal(orderDoc({ paymentStatus: "pending" }))).toBe(
      "not_paid"
    )
    expect(orderConfirmationRefusal(orderDoc({ paymentStatus: "failed" }))).toBe(
      "not_paid"
    )
  })

  it("does not confirm an order that has been cancelled", () => {
    expect(orderConfirmationRefusal(orderDoc({ status: "cancelled" }))).toBe(
      "cancelled"
    )
  })

  it("has nowhere to write for a guest who gave no email", () => {
    expect(
      orderConfirmationRefusal(orderDoc({ customerInfo: { name: "Camille" } }))
    ).toBe("no_email")
    expect(
      orderConfirmationRefusal(
        orderDoc({ customerInfo: { name: "Camille", email: "   " } })
      )
    ).toBe("no_email")
  })

  it("leaves a marketplace diner to the marketplace that took their money", () => {
    // Uber Eats and Deliveroo confirm their own orders, and write
    // `taxAmount: 0` because they account for the tax themselves — a receipt
    // built from those figures would not balance.
    expect(orderConfirmationRefusal(orderDoc({ source: "uber_eats" }))).toBe(
      "marketplace"
    )
    expect(orderConfirmationRefusal(orderDoc({ source: "deliveroo" }))).toBe(
      "marketplace"
    )
  })

  it("refuses a second time once one has been dispatched", () => {
    expect(
      orderConfirmationRefusal(orderDoc({ confirmationEmailAt: NOW }))
    ).toBe("already_dispatched")
  })

  it("does not write to an address SES has told us about", () => {
    expect(orderConfirmationRefusal(orderDoc(), "bounced")).toBe(
      "address_suppressed"
    )
    expect(orderConfirmationRefusal(orderDoc(), "complained")).toBe(
      "address_suppressed"
    )
  })

  it("confirms a cash order-ahead before the money changes hands", () => {
    // Cash has no provider and no redirect, so `releaseToKitchen` sends it to
    // the pass at checkout and its comment notes that in auto mode nobody ever
    // opens the admin to record the money. `markCashPaid` being the only other
    // seam, refusing here would leave a click-and-collect diner with nothing,
    // possibly for ever.
    expect(
      orderConfirmationRefusal(
        orderDoc({ paymentStatus: "pending", paymentMethod: "cash" })
      )
    ).toBeNull()
  })

  it("still says nothing for a CARD order that has not settled", () => {
    // A card order can be abandoned at the provider — #136 in email form.
    expect(
      orderConfirmationRefusal(
        orderDoc({ paymentStatus: "pending", paymentMethod: "card" })
      )
    ).toBe("not_paid")
  })

  it("says nothing for a cash order whose payment failed or was refunded", () => {
    expect(
      orderConfirmationRefusal(
        orderDoc({ paymentStatus: "failed", paymentMethod: "cash" })
      )
    ).toBe("not_paid")
    expect(
      orderConfirmationRefusal(
        orderDoc({ paymentStatus: "refunded", paymentMethod: "cash" })
      )
    ).toBe("not_paid")
  })

  it("still sends a receipt to someone who unsubscribed from marketing", () => {
    // Unsubscribing withdraws consent to be marketed to. It does not cancel the
    // confirmation for something the person paid for — the same distinction
    // `orders.ts` draws when it declines to turn a buyer into a subscriber.
    expect(orderConfirmationRefusal(orderDoc(), "other")).toBeNull()
  })
})

describe("readSubscriberStanding", () => {
  it("finds a suppressed address whatever case the order recorded", () => {
    const { ctx } = createCtx(
      docs({}, {
        "emailSubscribers:1": {
          _id: "emailSubscribers:1",
          storeId: "stores:1",
          email: "camille@example.com",
          status: "bounced",
        },
      })
    )

    return expect(
      readSubscriberStanding(ctx, "stores:1", "Camille@Example.COM")
    ).resolves.toBe("bounced")
  })

  it("answers unknown for an address nobody has subscribed", () => {
    const { ctx } = createCtx(docs())

    return expect(
      readSubscriberStanding(ctx, "stores:1", "camille@example.com")
    ).resolves.toBe("unknown")
  })
})

// ============================================================================
// Exactly one confirmation per order
// ============================================================================

describe("planOrderConfirmation", () => {
  it("claims the send on the order so a second call finds it taken", async () => {
    const { ctx, store } = createCtx(docs())

    const first = await planOrderConfirmation(ctx, "orders:1")
    const second = await planOrderConfirmation(ctx, "orders:1")

    expect(first).toEqual({ orderId: "orders:1" })
    expect(second).toBeNull()
    expect(typeof store["orders:1"]!.confirmationEmailAt).toBe("number")
  })

  it("claims nothing for an order that does not qualify", async () => {
    const { ctx, store } = createCtx(docs({ customerInfo: { name: "Camille" } }))

    expect(await planOrderConfirmation(ctx, "orders:1")).toBeNull()
    // No marker either — the order stays eligible if an email is added later.
    expect(store["orders:1"]!.confirmationEmailAt).toBeUndefined()
  })

  it("answers null rather than throwing for an order that is gone", async () => {
    const { ctx } = createCtx(docs())

    expect(await planOrderConfirmation(ctx, "orders:missing")).toBeNull()
  })

  it("gives the claim back when nothing could be sent", async () => {
    // The claim is written before the sender runs. That is right for a send
    // that was ATTEMPTED and failed — retrying a provider that has already
    // refused is how a diner gets three receipts. It is wrong when nothing was
    // attempted: an establishment with no sender address configured would have
    // its first paid order marked confirmed for ever, and the email would never
    // go out even after the address was set.
    const { ctx, store } = createCtx(docs())

    expect(await planOrderConfirmation(ctx, "orders:1")).not.toBeNull()
    await releaseOrderConfirmationClaim(ctx, "orders:1")

    expect(store["orders:1"]!.confirmationEmailAt).toBeUndefined()
    expect(await planOrderConfirmation(ctx, "orders:1")).toEqual({
      orderId: "orders:1",
    })
  })

  it("releases nothing for an order that never claimed", async () => {
    const { ctx, store } = createCtx(docs())

    await releaseOrderConfirmationClaim(ctx, "orders:1")
    await releaseOrderConfirmationClaim(ctx, "orders:missing")

    expect(store["orders:1"]!.confirmationEmailAt).toBeUndefined()
  })
})

// ============================================================================
// The paid seams dispatch it
// ============================================================================

describe("the order-paid seams", () => {
  it("a settled card payment asks for one confirmation", async () => {
    const { ctx } = createCtx(docs({ paymentStatus: "pending" }))

    const dispatch = await recordPaymentStatus.handler(ctx, {
      id: "orders:1",
      paymentStatus: "paid",
    })

    expect(dispatch).toEqual({ orderId: "orders:1" })
  })

  it("a replayed webhook asks for no second one", async () => {
    // `recordPaymentStatus` has no "was it already paid" guard, deliberately:
    // a replayed Stripe webhook and the success page settle the same order.
    // The kitchen release is idempotent through the ticket it looks for; the
    // email has no such artefact, which is what `confirmationEmailAt` is for.
    const { ctx } = createCtx(docs({ paymentStatus: "pending" }))

    const first = await recordPaymentStatus.handler(ctx, {
      id: "orders:1",
      paymentStatus: "paid",
    })
    const second = await recordPaymentStatus.handler(ctx, {
      id: "orders:1",
      paymentStatus: "paid",
    })

    expect(first).toEqual({ orderId: "orders:1" })
    expect(second).toBeNull()
  })

  it("a payment that failed asks for nothing", async () => {
    const { ctx } = createCtx(docs({ paymentStatus: "pending" }))

    expect(
      await recordPaymentStatus.handler(ctx, {
        id: "orders:1",
        paymentStatus: "failed",
      })
    ).toBeNull()
  })

  it("cash taken at the counter asks for one confirmation", async () => {
    const { ctx } = createCtx(
      docs({ paymentStatus: "pending", paymentMethod: "cash", type: "pickup" })
    )

    const result = await markCashPaid.handler(ctx, { orderId: "orders:1" })

    expect(result.confirmation).toEqual({ orderId: "orders:1" })
    expect(result.paymentId).toBeTruthy()
  })

  it("a second member of staff pressing the same button asks for nothing", async () => {
    const { ctx } = createCtx(
      docs({ paymentStatus: "pending", paymentMethod: "cash", type: "pickup" })
    )

    await markCashPaid.handler(ctx, { orderId: "orders:1" })
    const again = await markCashPaid.handler(ctx, { orderId: "orders:1" })

    expect(again).toEqual({ paymentId: null, confirmation: null })
  })
})

// ============================================================================
// What the email is built from
// ============================================================================

describe("buildOrderConfirmationPayload", () => {
  it("reads the order as it was recorded", async () => {
    const { ctx } = createCtx(docs())

    const payload = await buildOrderConfirmationPayload(ctx, "orders:1")

    expect(payload).not.toBeNull()
    expect(payload!.toEmail).toBe("Camille@Example.com")
    expect(payload!.storeId).toBe("stores:1")
    expect(payload!.viewToken).toBe("vt-1")
    expect(payload!.timeZone).toBe("Europe/Paris")

    expect(payload!.email.orderNumber).toBe("ORD-2026-00001")
    expect(payload!.email.customerName).toBe("Camille")
    expect(payload!.email.store.name).toBe("Chez Luigi")
    expect(payload!.email.total).toBe(2890)
    expect(payload!.email.deliveryFee).toBe(490)
    expect(payload!.email.taxBreakdown).toEqual([
      { ratePercent: 10, taxAmount: 218 },
    ])
  })

  it("renders the options the diner chose", async () => {
    const { ctx } = createCtx(docs())

    const payload = await buildOrderConfirmationPayload(ctx, "orders:1")

    expect(payload!.email.items[0]!.options).toEqual(["Taille : Grande"])
    expect(payload!.email.items[0]!.notes).toBe("bien cuite")
    expect(payload!.email.items[0]!.subtotal).toBe(2400)
  })

  it("carries no delivery address on a pickup order", async () => {
    const { ctx } = createCtx(
      docs({ type: "pickup", deliveryAddress: undefined, deliveryFee: undefined })
    )

    const payload = await buildOrderConfirmationPayload(ctx, "orders:1")

    expect(payload!.email.type).toBe("pickup")
    expect(payload!.email.deliveryAddress).toBeUndefined()
    expect(payload!.email.deliveryFee).toBeUndefined()
  })

  it("survives an order carrying nothing optional at all", async () => {
    const { ctx } = createCtx(
      docs({
        type: "dine_in",
        taxBreakdown: undefined,
        deliveryFee: undefined,
        deliveryAddress: undefined,
        viewToken: undefined,
        paymentMethod: undefined,
        items: [{ productName: "Café", quantity: 1, subtotal: 200 }],
      })
    )

    const payload = await buildOrderConfirmationPayload(ctx, "orders:1")

    expect(payload!.email.type).toBe("dine_in")
    expect(payload!.email.items).toEqual([
      { name: "Café", quantity: 1, subtotal: 200, options: [], notes: undefined },
    ])
    expect(payload!.viewToken).toBeUndefined()
  })

  it("refuses an order cancelled between the claim and the send", async () => {
    // The action runs after the mutation that claimed the send. An order
    // cancelled and refunded in between would otherwise be told, in writing,
    // that it is confirmed.
    const { ctx, store } = createCtx(docs())

    await planOrderConfirmation(ctx, "orders:1")
    store["orders:1"]!.status = "cancelled"
    store["orders:1"]!.paymentStatus = "refunded"

    expect(await buildOrderConfirmationPayload(ctx, "orders:1")).toBeNull()
  })

  it("does not treat its own claim as a reason to refuse", async () => {
    // `already_dispatched` is the claim this very send is acting on.
    const { ctx } = createCtx(docs())

    await planOrderConfirmation(ctx, "orders:1")

    expect(await buildOrderConfirmationPayload(ctx, "orders:1")).not.toBeNull()
  })

  it("marks an unpaid cash order as still to be settled", async () => {
    const { ctx } = createCtx(
      docs({ paymentStatus: "pending", paymentMethod: "cash", type: "pickup" })
    )

    const payload = await buildOrderConfirmationPayload(ctx, "orders:1")

    expect(payload!.email.paymentPending).toBe(true)
  })

  it("marks a settled order as paid", async () => {
    const { ctx } = createCtx(docs())

    const payload = await buildOrderConfirmationPayload(ctx, "orders:1")

    expect(payload!.email.paymentPending).toBeUndefined()
  })

  it("answers null when the establishment is gone", async () => {
    const { ctx, store } = createCtx(docs())
    delete store["stores:1"]

    expect(await buildOrderConfirmationPayload(ctx, "orders:1")).toBeNull()
  })
})
