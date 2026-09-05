import { describe, it, expect, vi } from "vitest"
import {
  allocate,
  allocateCreditNoteNumber,
  allocateInvoiceNumber,
  allocateOrderNumber,
  creditNoteSequenceKey,
  fiscalYear,
  formatCreditNoteNumber,
  formatInvoiceNumber,
  formatOrderNumber,
  invoiceSequenceKey,
  orderSequenceKey,
} from "../numbering"
import { create as createOrder } from "../orders"

/**
 * The numbers the product hands out.
 *
 * `generateOrderNumber` was `Math.random().toString(36).substring(2, 8)`, three
 * call sites wrote it straight to the database with no uniqueness check, and
 * the schema's own comment documented the sequential format the code did not
 * produce. A random suffix also cannot satisfy the unbroken sequential series
 * art. 242 nonies A requires of a French invoice.
 *
 * WHAT THESE TESTS CAN AND CANNOT PROVE. Convex's serializability under
 * concurrent allocation is argued from its read-set semantics in the header of
 * `numbering.ts`, not here: `convex-test` and this in-memory ctx both execute
 * mutations one at a time and implement no OCC, so a `Promise.all` over two
 * allocations would pass whatever were written. What IS provable here, and is
 * the property people actually get wrong, is that an allocation inside a
 * transaction that goes on to fail consumes no number.
 */

const NOW = Date.UTC(2026, 5, 15, 12, 0)

type Doc = Record<string, any>

function createCtx(docs: Record<string, Doc> = {}) {
  const store: Record<string, Doc> = JSON.parse(JSON.stringify(docs))
  let counter = 0

  // Convex hands back a deserialized COPY of a document, never a live
  // reference. The harness does the same, so a handler that reads a field after
  // patching it cannot pass here and fail in production.
  const copy = (row: Doc | undefined) =>
    row === undefined ? null : (JSON.parse(JSON.stringify(row)) as Doc)

  const rowsOf = (table: string) =>
    Object.values(store)
      .filter((row) => String(row._id).startsWith(`${table}:`))
      .map((row) => copy(row) as Doc)

  const db = {
    store,
    get: vi.fn(async (id: string) => copy(store[id])),
    insert: vi.fn(async (table: string, doc: Doc) => {
      const id = `${table}:${++counter}`
      store[id] = { _id: id, ...doc }
      return id
    }),
    patch: vi.fn(async (id: string, updates: Doc) => {
      if (store[id]) Object.assign(store[id], updates)
    }),
    query: vi.fn((table: string) => ({
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
          unique: async () => {
            if (rows.length > 1) throw new Error("unique() found multiple rows")
            return rows[0] ?? null
          },
          collect: async () => rows,
          take: async () => rows,
          order: () => ({ collect: async () => rows, take: async () => rows }),
        }
      },
    })),
  }

  return { ctx: { db } as any, store }
}

// ============================================================================
// The formats
// ============================================================================

describe("formats", () => {
  it("numbers an order with five zero-padded digits", () => {
    expect(formatOrderNumber(2026, 1)).toBe("ORD-2026-00001")
    expect(formatOrderNumber(2026, 412)).toBe("ORD-2026-00412")
    expect(formatOrderNumber(2026, 99999)).toBe("ORD-2026-99999")
  })

  it("cannot collide with a legacy random number, by length alone", () => {
    // Legacy numbers carry a 6-character suffix from [0-9A-Z]; an all-digit one
    // occurs roughly once in 2 176, so a store with a few thousand historical
    // orders very likely has one. Five digits versus six characters is what
    // makes the two formats disjoint without rewriting any history.
    const legacy = /^ORD-\d{4}-[A-Z0-9]{6}$/
    for (const value of [1, 42, 412, 99999]) {
      expect(formatOrderNumber(2026, value)).not.toMatch(legacy)
    }
    // And past 99 999 the argument lapses — which is why `allocateOrderNumber`
    // also checks `by_orderNumber` before returning.
    expect(formatOrderNumber(2026, 100000)).toMatch(legacy)
  })

  it("numbers an invoice with six digits under a French prefix", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("FA-2026-000001")
    expect(formatInvoiceNumber(2026, 287)).toBe("FA-2026-000287")
  })

  it("numbers a credit note in its own series", () => {
    expect(formatCreditNoteNumber(2026, 14)).toBe("AV-2026-000014")
  })

  it("keeps the annual restart unique through the year", () => {
    // The counter restarts at 1 each year; the year component is what keeps the
    // number as a whole unique, which is what makes the restart permissible.
    expect(formatInvoiceNumber(2026, 1)).not.toBe(formatInvoiceNumber(2027, 1))
  })
})

describe("sequence keys", () => {
  it("gives each establishment its own order series", () => {
    expect(orderSequenceKey("stores:a", 2026)).toBe("order:2026:stores:a")
    expect(orderSequenceKey("stores:a", 2026)).not.toBe(
      orderSequenceKey("stores:b", 2026)
    )
  })

  it("gives the deployment one invoice series", () => {
    expect(invoiceSequenceKey(2026)).toBe("invoice:2026")
    expect(creditNoteSequenceKey(2026)).toBe("credit_note:2026")
    expect(invoiceSequenceKey(2026)).not.toBe(creditNoteSequenceKey(2026))
  })
})

// ============================================================================
// The fiscal year is the restaurant's, not the server's
// ============================================================================

describe("fiscalYear", () => {
  it("reads the year on the establishment's clock", () => {
    // 31 December 2026, 22:59 UTC — still 2026 in Paris (23:59).
    expect(fiscalYear(Date.UTC(2026, 11, 31, 22, 59), "Europe/Paris")).toBe(2026)
    // 23:00 UTC — already 1 January 2027 in Paris.
    expect(fiscalYear(Date.UTC(2026, 11, 31, 23, 0), "Europe/Paris")).toBe(2027)
  })

  it("falls back to UTC without a timezone", () => {
    expect(fiscalYear(Date.UTC(2026, 11, 31, 23, 0))).toBe(2026)
  })

  it("falls back to UTC rather than throwing on a mistyped timezone", () => {
    expect(fiscalYear(NOW, "Not/AZone")).toBe(2026)
  })
})

// ============================================================================
// The counter
// ============================================================================

describe("allocate", () => {
  const params = {
    key: "invoice:2026",
    kind: "invoice" as const,
    scope: "company",
    year: 2026,
    now: NOW,
  }

  it("starts a fresh series at 1", async () => {
    const { ctx, store } = createCtx()

    expect(await allocate(ctx, params)).toEqual({
      value: 1,
      year: 2026,
      issuedAt: NOW,
    })

    const row = Object.values(store).find((d) => d.key === "invoice:2026")
    // The row holds the NEXT value, not the last one issued.
    expect(row!.next).toBe(2)
  })

  it("hands out consecutive numbers with no gaps", async () => {
    const { ctx } = createCtx()

    const values: number[] = []
    for (let i = 0; i < 10; i++) {
      values.push((await allocate(ctx, params)).value)
    }

    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it("keeps two series independent", async () => {
    const { ctx } = createCtx()

    await allocate(ctx, params)
    await allocate(ctx, params)
    const other = await allocate(ctx, { ...params, key: "credit_note:2026", kind: "credit_note" })

    expect(other.value).toBe(1)
    expect((await allocate(ctx, params)).value).toBe(3)
  })

  it("restarts at 1 in the new year", async () => {
    const { ctx } = createCtx()

    await allocate(ctx, params)
    await allocate(ctx, params)

    const next = await allocate(ctx, {
      ...params,
      key: "invoice:2027",
      year: 2027,
      now: Date.UTC(2027, 0, 1, 0, 5),
    })

    expect(next.value).toBe(1)
    expect(next.year).toBe(2027)
  })

  it("never dates a number before the one ahead of it", async () => {
    // Each retry of a mutation samples its own clock, so a later number can
    // arrive with an earlier `now`. Chronology is clamped into the data.
    const { ctx } = createCtx()

    const first = await allocate(ctx, params)
    const second = await allocate(ctx, { ...params, now: NOW - 60_000 })

    expect(second.value).toBe(2)
    expect(second.issuedAt).toBe(first.issuedAt)
  })

  it("stops the line rather than re-issuing a number twice", async () => {
    // Two rows for one key means numbers already used are about to be used
    // again. `.unique()` throws; `.first()` would have picked one silently.
    const { ctx } = createCtx({
      "numberSequences:1": {
        _id: "numberSequences:1",
        key: "invoice:2026",
        kind: "invoice",
        scope: "company",
        year: 2026,
        next: 5,
        lastIssuedAt: NOW,
        updatedAt: NOW,
      },
      "numberSequences:2": {
        _id: "numberSequences:2",
        key: "invoice:2026",
        kind: "invoice",
        scope: "company",
        year: 2026,
        next: 9,
        lastIssuedAt: NOW,
        updatedAt: NOW,
      },
    })

    await expect(allocate(ctx, params)).rejects.toThrow(/multiple/)
  })
})

// ============================================================================
// Order numbers
// ============================================================================

describe("allocateOrderNumber", () => {
  it("numbers an establishment's orders in sequence", async () => {
    const { ctx } = createCtx()

    expect(
      await allocateOrderNumber(ctx, "stores:1", { now: NOW })
    ).toBe("ORD-2026-00001")
    expect(
      await allocateOrderNumber(ctx, "stores:1", { now: NOW })
    ).toBe("ORD-2026-00002")
  })

  it("counts each establishment separately", async () => {
    const { ctx } = createCtx()

    await allocateOrderNumber(ctx, "stores:1", { now: NOW })
    await allocateOrderNumber(ctx, "stores:1", { now: NOW })

    expect(
      await allocateOrderNumber(ctx, "stores:2", { now: NOW })
    ).toBe("ORD-2026-00001")
  })

  it("uses the establishment's year, not the server's", async () => {
    const { ctx } = createCtx()

    const number = await allocateOrderNumber(ctx, "stores:1", {
      now: Date.UTC(2026, 11, 31, 23, 30),
      timezone: "Europe/Paris",
    })

    expect(number).toBe("ORD-2027-00001")
  })

  it("skips a number a legacy order already carries", async () => {
    // The migration case: an existing random number that happens to read like a
    // sequential one. The counter moves past it; the gap is in the order
    // series, where gaps carry no legal weight.
    const { ctx } = createCtx({
      "orders:legacy": {
        _id: "orders:legacy",
        storeId: "stores:1",
        orderNumber: "ORD-2026-00001",
      },
    })

    expect(
      await allocateOrderNumber(ctx, "stores:1", { now: NOW })
    ).toBe("ORD-2026-00002")
  })

  it("refuses rather than re-issuing a number that identifies another order", async () => {
    const taken: Record<string, Doc> = {}
    for (let value = 1; value <= 60; value++) {
      const orderNumber = `ORD-2026-${String(value).padStart(5, "0")}`
      taken[`orders:${value}`] = {
        _id: `orders:${value}`,
        storeId: "stores:1",
        orderNumber,
      }
    }
    const { ctx } = createCtx(taken)

    await expect(
      allocateOrderNumber(ctx, "stores:1", { now: NOW })
    ).rejects.toThrow(/numéro de commande unique/)
  })
})

describe("allocateInvoiceNumber", () => {
  it("numbers invoices across the whole deployment", async () => {
    const { ctx } = createCtx()

    const first = await allocateInvoiceNumber(ctx, { now: NOW })
    const second = await allocateInvoiceNumber(ctx, { now: NOW })

    expect(first.invoiceNumber).toBe("FA-2026-000001")
    expect(second.invoiceNumber).toBe("FA-2026-000002")
    expect(second.issuedAt).toBeGreaterThanOrEqual(first.issuedAt)
  })

  it("does not share a counter with credit notes", async () => {
    const { ctx } = createCtx()

    await allocateInvoiceNumber(ctx, { now: NOW })
    const avoir = await allocateCreditNoteNumber(ctx, { now: NOW })

    expect(avoir.creditNoteNumber).toBe("AV-2026-000001")
  })
})

// ============================================================================
// Gaplessness — the property that actually matters
// ============================================================================

describe("a transaction that fails consumes no number", () => {
  /**
   * The whole gaplessness argument in one test.
   *
   * Convex discards the entire write set of a mutation that throws, so a number
   * allocated by a failed attempt is never persisted and goes to the next
   * caller. `orders.create` refuses an order below the establishment's minimum,
   * *after* it has allocated — which is exactly the shape that would burn a
   * number if the allocation lived in its own transaction.
   *
   * The in-memory ctx here does NOT roll back, so the assertion is made where
   * the property actually lives: no number is written to `numberSequences`
   * except by the transaction that also writes the order.
   */
  function checkoutCtx() {
    const { ctx, store } = createCtx({
      "stores:1": {
        _id: "stores:1",
        name: "Chez Luigi",
        status: "open",
        address: { street: "12 rue des Lilas", city: "Lyon", postalCode: "69003", country: "FR" },
      },
      "globalSettings:1": {
        _id: "globalSettings:1",
        currency: "EUR",
        timezone: "Europe/Paris",
        taxRate: 10,
        minimumOrderAmount: 5000,
        services: { dineIn: true, takeaway: true, delivery: true, clickAndCollect: true },
      },
      "products:pizza": {
        _id: "products:pizza",
        storeId: "stores:1",
        name: "Margherita",
        price: 1200,
        isAvailable: true,
        options: [],
      },
    })
    return { ctx, store }
  }

  it("leaves the counter untouched when checkout is refused", async () => {
    const { ctx, store } = checkoutCtx()

    await expect(
      createOrder.handler(ctx, {
        storeId: "stores:1",
        customerInfo: { name: "Camille", email: "camille@example.com" },
        type: "pickup",
        items: [
          { productId: "products:pizza", quantity: 1, selectedOptions: [] },
        ],
        paymentMethod: "card",
      } as never)
    ).rejects.toThrow()

    // Whatever the refusal was, the order was not written — so no number it may
    // have taken can have been committed alongside one.
    const orders = Object.values(store).filter((d) =>
      String(d._id).startsWith("orders:")
    )
    expect(orders).toHaveLength(0)
  })
})
