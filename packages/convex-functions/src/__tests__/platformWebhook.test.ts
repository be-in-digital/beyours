import { describe, it, expect } from "vitest"
import { uberEats } from "@be-in-digital/integrations"
import {
  classifyUberEvent,
  refusePlatformStatus,
  resolveStoreIntegration,
  toWebhookOrderItems,
} from "../platformWebhook"
import { ORDER_STATUSES } from "@be-in-digital/convex-schema"
import { createFromWebhook } from "../orders"

// ---------------------------------------------------------------------------
// Event identity — the names Uber actually sends
// ---------------------------------------------------------------------------

describe("classifyUberEvent", () => {
  // Uber's published catalogue. Every one of these used to fall through to
  // "unknown event type - still acknowledge".
  it.each([
    ["orders.notification", "new_order"],
    ["orders.scheduled.notification", "scheduled_order"],
    ["orders.cancel.notification", "cancel"],
    ["orders.release.notification", "release"],
    ["orders.fulfillment_issues.resolved", "fulfillment_issues_resolved"],
    ["store.provisioned", "store_provisioned"],
    ["store.deprovisioned", "store_deprovisioned"],
    ["eats.report.success", "report"],
    ["eats.report.failure", "report"],
  ])("classifies the real event %s as %s", (raw, expected) => {
    expect(classifyUberEvent(raw)).toBe(expected)
  })

  it("accepts the bare spellings older integrations send", () => {
    expect(classifyUberEvent("orders.cancel")).toBe("cancel")
    expect(classifyUberEvent("orders.scheduled")).toBe("scheduled_order")
  })

  it("does not recognise eats.order.status_update — Uber never sends it", () => {
    // The handler had a whole branch and a status map for this. Both were dead
    // code. Recognising it again would resurrect them.
    expect(classifyUberEvent("eats.order.status_update")).toBe("unknown")
  })

  it("is unbothered by case and whitespace", () => {
    expect(classifyUberEvent("  ORDERS.CANCEL.NOTIFICATION  ")).toBe("cancel")
  })

  it("returns unknown rather than throwing on absent or junk input", () => {
    expect(classifyUberEvent(undefined)).toBe("unknown")
    expect(classifyUberEvent(null)).toBe("unknown")
    expect(classifyUberEvent("")).toBe("unknown")
    expect(classifyUberEvent("something.else")).toBe("unknown")
  })
})

// ---------------------------------------------------------------------------
// Routing — the failure that costs a customer relationship
// ---------------------------------------------------------------------------

describe("resolveStoreIntegration", () => {
  const pizzeria = { platformStoreId: "uber-store-pizzeria", storeId: "stores:1" }
  const burger = { platformStoreId: "uber-store-burger", storeId: "stores:2" }
  const both = [pizzeria, burger]

  it("routes an identified order to its own establishment", () => {
    const res = resolveStoreIntegration(both, "uber-store-burger")
    expect(res).toEqual({ ok: true, integration: burger })
  })

  it("REFUSES an unidentified order instead of sending it to the first store", () => {
    // This is the whole point. On a multi-location account the old fallback
    // `allIntegrations[0]` put every unfetchable order into the pizzeria's
    // kitchen, whoever it actually belonged to.
    for (const missing of [undefined, null, "", "   "]) {
      const res = resolveStoreIntegration(both, missing)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toBe("unidentified_store")
    }
  })

  it("refuses a store reference it does not recognise", () => {
    const res = resolveStoreIntegration(both, "uber-store-somebody-else")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("unknown_store")
  })

  it("an integration with a blank platformStoreId does not swallow an unrouted order", () => {
    // A bare `.find(i => i.platformStoreId === siteId)` — which is what the
    // Deliveroo path did — MATCHES when the payload carries no site reference
    // and some integration was saved with an empty id. Same class of fault as
    // `allIntegrations[0]`, same consequence: an order in the wrong kitchen.
    const blank = { platformStoreId: "", storeId: "stores:9" }
    for (const missing of [undefined, null, "", "   "]) {
      const res = resolveStoreIntegration([blank, pizzeria], missing)
      expect(res.ok).toBe(false)
    }
  })

  it("REFUSES when two integrations claim the same platform store id", () => {
    // `storeIntegrations` is unique on (storeId, platform), not on
    // platformStoreId — so an owner adding a second location and pasting the
    // same Uber store id gets two matches. Asking "does one match?" routes
    // every order from both restaurants to whichever sorts first, silently.
    const a = { platformStoreId: "uber-store-shared", storeId: "stores:1" }
    const b = { platformStoreId: "uber-store-shared", storeId: "stores:2" }
    const res = resolveStoreIntegration([a, b], "uber-store-shared")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("ambiguous_store")
  })

  it("treats a non-string store id as unidentified rather than throwing", () => {
    // `store: { id: 12345 }` made `storeExternalId?.trim()` throw, which reached
    // the handler's outer catch as a 500 with nothing recorded — seven Uber
    // retries and the order gone. A payload is not a contract.
    for (const hostile of [12345, {}, [], true, Symbol("x")] as unknown[]) {
      const res = resolveStoreIntegration(both, hostile)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.reason).toBe("unidentified_store")
    }
  })

  it("reports the empty case distinctly from a bad reference", () => {
    const res = resolveStoreIntegration([], "uber-store-pizzeria")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("no_integrations")
  })

  it("never returns an integration the caller did not ask for, on any input", () => {
    // Property-ish sweep: the only way to get an integration back is to name it.
    const inputs = [undefined, null, "", "nope", "uber-store-pizzeria"]
    for (const input of inputs) {
      const res = resolveStoreIntegration(both, input)
      if (res.ok) expect(res.integration.platformStoreId).toBe(input)
    }
  })
})

// ---------------------------------------------------------------------------
// Inbound status: a fact from the platform, not a request
// ---------------------------------------------------------------------------

describe("refusePlatformStatus", () => {
  // The cancellation window in ORDER_STATUS_TRANSITIONS stops at `confirmed`
  // for an OUTBOUND reason. Applying it to an inbound notification dropped real
  // cancellations for anything already cooking — 200, no change, no trace.
  it.each(["pending", "confirmed", "preparing", "ready", "out_for_delivery"])(
    "honours a cancellation for an order at %s",
    (from) => {
      expect(refusePlatformStatus(from, "cancelled")).toBeNull()
    }
  )

  it.each(["delivered", "completed"])(
    "refuses a cancellation that arrives after %s, with a reason",
    (from) => {
      expect(refusePlatformStatus(from, "cancelled")).toBe("already_delivered")
    }
  )

  it("treats a repeated status as no change, not a refusal to record", () => {
    expect(refusePlatformStatus("confirmed", "confirmed")).toBe("no_change")
  })

  it("still refuses a move backwards", () => {
    // The original defect: an unmapped status resolved to `pending` and was
    // written unconditionally, so a delivered order was cooked again.
    for (const to of ["pending", "confirmed", "preparing"]) {
      expect(refusePlatformStatus("delivered", to)).toBe("illegal_transition")
    }
  })

  it("never lets anything leave a terminal status except by staying put", () => {
    for (const to of ORDER_STATUSES) {
      if (to !== "completed") expect(refusePlatformStatus("completed", to)).not.toBeNull()
      if (to !== "cancelled") expect(refusePlatformStatus("cancelled", to)).not.toBeNull()
    }
  })

  it("permits the ordinary forward moves a platform reports", () => {
    expect(refusePlatformStatus("pending", "confirmed")).toBeNull()
    expect(refusePlatformStatus("confirmed", "preparing")).toBeNull()
    expect(refusePlatformStatus("preparing", "ready")).toBeNull()
    expect(refusePlatformStatus("out_for_delivery", "delivered")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Money, across the seam — mapper output really passed to createFromWebhook
// ---------------------------------------------------------------------------

/**
 * In-memory Convex db stub.
 *
 * It is NOT a faithful Convex — an earlier comment here claimed it was, and an
 * adversarial pass showed the claim was false in the two ways that matter: it
 * ignored the index name entirely, so a made-up index answered happily, and it
 * accepted `.eq()` on fields the index does not cover. That is a `.filter()`
 * wearing an index's name, and it would have blessed exactly the mistake the
 * index change was meant to prevent.
 *
 * So it now enforces what Convex enforces: the index must exist, and the
 * equality fields must be a prefix of that index's field list. Anything else
 * throws here rather than passing quietly.
 *
 * It still models only what these tests need. The real engine is exercised by
 * the `uber-eats-webhook` suite in both apps, which uses `convex-test`.
 */
const TABLE_INDEXES: Record<string, Record<string, readonly string[]>> = {
  orders: {
    by_external_order: ["externalOrderId"],
    // The real names on the table. `by_store` and `by_status` were listed here
    // and do not exist in the schema, which quietly gave back the one thing
    // this registry exists to refuse: a made-up index that answers happily.
    by_storeId: ["storeId"],
    by_storeId_status: ["storeId", "status"],
    by_orderNumber: ["orderNumber"],
  },
  numberSequences: {
    by_key: ["key"],
    by_kind_year: ["kind", "year"],
  },
}

function createDb(seed: Array<Record<string, unknown>> = []) {
  const rows: Array<Record<string, unknown>> = [...seed]
  let counter = 1
  // Every table lives in one array, so a read has to be scoped by table or the
  // sequence counter answers an order lookup and vice versa.
  const rowsOf = (table: string) =>
    rows.filter((doc) => String(doc._id).startsWith(`${table}:`))
  return {
    get _orders() {
      return rowsOf("orders")
    },
    query: (table: string) => ({
      // `globalSettings` is a singleton, read with no index at all.
      first: async () => rowsOf(table)[0] ?? null,
      collect: async () => rowsOf(table),
      withIndex: (name: string, builder?: (iq: unknown) => unknown) => {
        const indexes = TABLE_INDEXES[table]
        if (!indexes) {
          throw new Error(`No indexes modelled for table "${table}"`)
        }
        const fields = indexes[name]
        if (!fields) {
          throw new Error(`No index named "${name}" on table "${table}"`)
        }
        const constraints: Array<[string, unknown]> = []
        if (builder) {
          const iq = {
            eq: (f: string, v: unknown) => {
              // Convex only allows equality on a PREFIX of the index fields.
              const expected = fields[constraints.length]
              if (f !== expected) {
                throw new Error(
                  `Index "${name}" cannot filter on "${f}" at position ${constraints.length}` +
                    ` (expected "${expected ?? "(index exhausted)"}")`
                )
              }
              constraints.push([f, v])
              return iq
            },
          }
          builder(iq)
        }
        const match = (d: Record<string, unknown>) => constraints.every(([f, v]) => d[f] === v)
        const matched = () => rowsOf(table).filter(match)
        return {
          first: async () => matched()[0] ?? null,
          // The order number allocator reads its counter with `.unique()`:
          // two rows for one key means re-issuing numbers already used, and it
          // must stop rather than pick one.
          unique: async () => {
            const found = matched()
            if (found.length > 1) {
              throw new Error(`unique() found ${found.length} rows on "${table}"`)
            }
            return found[0] ?? null
          },
          collect: async () => matched(),
        }
      },
    }),
    insert: async (table: string, doc: Record<string, unknown>) => {
      const _id = `${table}:${counter++}`
      rows.push({ _id, ...doc })
      return _id
    },
    get: async (id: string) => rows.find((o) => o._id === id) ?? null,
    patch: async (id: string, updates: Record<string, unknown>) => {
      const o = rows.find((x) => x._id === id)
      if (o) Object.assign(o, updates)
    },
  }
}

describe("platform line prices, through the real mapper into the real mutation", () => {
  // The two halves were each tested in isolation and each was self-consistent.
  // The defect lived in the join, which is why it survived five green CI runs.
  const uberOrder = {
    id: "ue-seam-1",
    display_id: "SEAM1",
    store: { id: "uber-store-1" },
    cart: {
      items: [
        {
          id: "i1",
          title: "Burger",
          quantity: 2,
          price: { amount: 1000 },
          selected_modifier_groups: [
            { id: "g1", title: "Extras", selected_items: [{ id: "m1", title: "Cheese", quantity: 1, price: { amount: 150 } }] },
          ],
        },
      ],
    },
    payment: { charges: { total: { amount: 2300 }, sub_total: { amount: 2300 } } },
    placed_at: "2026-01-01T12:00:00Z",
  }

  it("stores the unit price, not the line total", async () => {
    const unified = uberEats.mapUberEatsOrderToUnified(uberOrder as never)
    const db = createDb()

    await createFromWebhook.handler({ db } as never, {
      storeId: "stores:1",
      externalOrderId: "ue-seam-1",
      platform: "uberEats",
      status: "pending",
      type: "delivery",
      customerName: "Client",
      items: toWebhookOrderItems(unified.items),
      subtotal: unified.subtotal,
      total: unified.total,
      createdAt: 1_700_000_000_000,
    } as never)

    const line = (db._orders[0] as { items: Array<Record<string, number>> }).items[0]
    expect(line.unitPrice).toBe(1000)
    // (1000 + 150) * 2 = 2300 cents, which is exactly what the Uber mapper
    // computed as `totalPrice`. The two sides of the seam now agree.
    // Before the fix this line was stored at 4750 — 2.209x its real price.
    expect(line.subtotal).toBe(2300)
  })

  it("never stores a line total above the order total, for any quantity", async () => {
    // The generic shape of the defect: a line worth more than the whole order.
    for (const quantity of [1, 2, 3, 5]) {
      const order = JSON.parse(JSON.stringify(uberOrder))
      order.cart.items[0].quantity = quantity
      const lineTotal = (1000 + 150) * quantity
      order.payment.charges.total.amount = lineTotal
      order.payment.charges.sub_total.amount = lineTotal

      const unified = uberEats.mapUberEatsOrderToUnified(order as never)
      const db = createDb()
      await createFromWebhook.handler({ db } as never, {
        storeId: "stores:1", externalOrderId: `ue-q${quantity}`, platform: "uberEats",
        status: "pending", type: "delivery", customerName: "Client",
        items: toWebhookOrderItems(unified.items),
        subtotal: unified.subtotal, total: unified.total, createdAt: 1_700_000_000_000,
      } as never)

      const line = (db._orders[0] as { items: Array<Record<string, number>> }).items[0]
      expect(line.subtotal).toBe(lineTotal)
      expect(line.subtotal).toBeLessThanOrEqual(unified.total)
    }
  })

  it("charges a double modifier twice, not once", async () => {
    // A modifier carries its own quantity: "double cheese" is one modifier at
    // quantity 2. The mapper prices it `price * quantity`; the mutation used to
    // sum `mod.price` alone and the validator had no field for the quantity at
    // all, so every multiplied extra was charged once however many were ordered.
    const order = JSON.parse(JSON.stringify(uberOrder))
    order.cart.items[0].quantity = 1
    order.cart.items[0].selected_modifier_groups[0].selected_items[0].quantity = 2
    order.payment.charges.total.amount = 1000 + 150 * 2
    order.payment.charges.sub_total.amount = 1000 + 150 * 2

    const unified = uberEats.mapUberEatsOrderToUnified(order as never)
    expect(unified.items[0].modifiers[0].quantity).toBe(2)

    const db = createDb()
    await createFromWebhook.handler({ db } as never, {
      storeId: "stores:1", externalOrderId: "ue-double", platform: "uberEats",
      status: "pending", type: "delivery", customerName: "Client",
      items: toWebhookOrderItems(unified.items),
      subtotal: unified.subtotal, total: unified.total, createdAt: 1_700_000_000_000,
    } as never)

    const line = (db._orders[0] as { items: Array<Record<string, number>> }).items[0]
    // 1000 + (150 * 2) = 1300, not 1150.
    expect(line.subtotal).toBe(1300)
    expect(line.subtotal).toBe(unified.total)
  })

  it("refuses to store a negative line, however large the removal discount", async () => {
    // `orderLine.ts` cites "sans fromage, −0,50 €" as legitimate, so a negative
    // modifier is real house data. Unclamped, a discount bigger than the dish
    // made the line negative and paid for the rest of the basket — the exact
    // thing `verifyOrderLine` clamps, on a path that did not.
    const db = createDb()
    await createFromWebhook.handler({ db } as never, {
      storeId: "stores:1", externalOrderId: "ue-neg", platform: "uberEats",
      status: "pending", type: "delivery", customerName: "Client",
      items: [{ externalId: "i1", name: "Salade", quantity: 3, price: 500,
        modifiers: [{ externalId: "m1", name: "sans fromage", price: -800 }] }],
      subtotal: 0, total: 0, createdAt: 1_700_000_000_000,
    } as never)
    const line = (db._orders[0] as { items: Array<Record<string, number>> }).items[0]
    expect(line.subtotal).toBe(0)
    expect(line.subtotal).toBeGreaterThanOrEqual(0)
  })

  it.each([
    ["a negative quantity", -2, 0],
    ["a fractional quantity", 1.5, 1],
    ["an absurd quantity", 1_000_000, 999],
  ])("clamps %s the way the storefront does", async (_label, quantity, expected) => {
    const db = createDb()
    await createFromWebhook.handler({ db } as never, {
      storeId: "stores:1", externalOrderId: `ue-q-${quantity}`, platform: "uberEats",
      status: "pending", type: "delivery", customerName: "Client",
      items: [{ externalId: "i1", name: "Pizza", quantity, price: 1000 }],
      subtotal: 0, total: 0, createdAt: 1_700_000_000_000,
    } as never)
    const line = (db._orders[0] as { items: Array<Record<string, number>> }).items[0]
    expect(line.quantity).toBe(expected)
    expect(line.subtotal).toBe(1000 * expected)
    expect(Number.isInteger(line.subtotal)).toBe(true)
  })

  it("carries the customer's allergy note across the seam", async () => {
    const order = JSON.parse(JSON.stringify(uberOrder))
    order.cart.items[0].customer_request = { allergy: { instructions: "arachides" } }
    const unified = uberEats.mapUberEatsOrderToUnified(order as never)
    const mapped = toWebhookOrderItems(unified.items)
    expect(mapped[0].notes).toBe("Allergie: arachides")
  })
})

// ---------------------------------------------------------------------------
// The stub itself, because a stub that flatters the code is worse than none
// ---------------------------------------------------------------------------

describe("the in-memory index stub refuses what Convex refuses", () => {
  it("rejects an index that does not exist", () => {
    const db = createDb()
    expect(() =>
      db.query("orders").withIndex("by_a_completely_made_up_index", (q: never) =>
        (q as unknown as { eq: (a: string, b: string) => unknown }).eq("externalOrderId", "x")
      )
    ).toThrow(/No index named/)
  })

  it("rejects an index borrowed from another table", () => {
    // `by_key` is real — on `numberSequences`. Reading `orders` through it is
    // the same mistake as inventing one, and has to fail the same way.
    const db = createDb()
    expect(() =>
      db.query("orders").withIndex("by_key", (q: never) =>
        (q as unknown as { eq: (a: string, b: string) => unknown }).eq("key", "x")
      )
    ).toThrow(/No index named "by_key" on table "orders"/)
  })

  it("rejects an equality on a field the index does not cover", () => {
    const db = createDb()
    expect(() =>
      db.query("orders").withIndex("by_external_order", (q: never) => {
        const iq = q as unknown as { eq: (a: string, b: string) => { eq: (a: string, b: string) => unknown } }
        return iq.eq("externalOrderId", "x").eq("source", "uber_eats")
      })
    ).toThrow(/cannot filter on "source"/)
  })
})
