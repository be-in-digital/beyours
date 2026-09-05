import { describe, it, expect, vi } from "vitest"
import {
  documentsForOrder,
  invoiceRefusal,
  issueCreditNoteForInvoice,
  issueInvoiceForOrder,
  sellerIsComplete,
} from "../invoices"
import { markCashPaid, recordPaymentStatus } from "../orders"

/**
 * The document a French restaurant is required to issue, and never did.
 *
 * Searching the engine for an invoice returned five hits, four of them
 * BeYours' own Stripe subscription webhook. The diner got nothing and the
 * restaurateur had nothing to hand an accountant, while art. 242 nonies A of
 * Annexe II CGI requires an unbroken, chronological, sequential series.
 *
 * The two properties worth holding: exactly one invoice per sale however many
 * times the payment settles, and figures frozen at issue so that nothing edited
 * afterwards can restate a document already given to a customer.
 */

const NOW = Date.UTC(2026, 5, 15, 12, 0)

type Doc = Record<string, any>

function createCtx(docs: Record<string, Doc>) {
  const store: Record<string, Doc> = JSON.parse(JSON.stringify(docs))
  let counter = 0

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

const SELLER = {
  legalName: "SARL Chez Luigi",
  legalForm: "SARL",
  address: {
    street: "12 rue des Lilas",
    city: "Lyon",
    postalCode: "69003",
    country: "FR",
  },
  siren: "123456789",
  siret: "12345678900012",
  vatNumber: "FR12123456789",
  rcs: "RCS Lyon 123 456 789",
  shareCapital: 1_000_000,
}

function docs(orderOverrides: Doc = {}, settingsOverrides: Doc = {}) {
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
    },
    "globalSettings:1": {
      _id: "globalSettings:1",
      currency: "EUR",
      timezone: "Europe/Paris",
      taxRate: 10,
      seller: SELLER,
      ...settingsOverrides,
    },
    "orders:1": {
      _id: "orders:1",
      storeId: "stores:1",
      orderNumber: "ORD-2026-00412",
      type: "pickup",
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "card",
      source: "website",
      customerInfo: { name: "Camille Martin", email: "camille@example.com" },
      items: [
        {
          productName: "Margherita",
          quantity: 2,
          unitPrice: 1200,
          subtotal: 2400,
          taxRatePercent: 10,
          selectedOptions: [
            { optionName: "Taille", choiceName: "Grande", priceModifier: 0 },
          ],
        },
      ],
      subtotal: 2400,
      taxAmount: 218,
      taxBreakdown: [{ ratePercent: 10, grossAmount: 2400, taxAmount: 218 }],
      total: 2400,
      createdAt: NOW,
      updatedAt: NOW,
      ...orderOverrides,
    },
  }
}

// ============================================================================
// Who gets an invoice
// ============================================================================

describe("sellerIsComplete", () => {
  it("insists on a legal name and nothing more", () => {
    // A micro-entreprise carries « TVA non applicable, art. 293 B du CGI »
    // instead of a VAT number, so the engine cannot require one.
    expect(sellerIsComplete({ legalName: "SARL Chez Luigi" })).toBe(true)
    expect(sellerIsComplete({ legalName: "  " })).toBe(false)
    expect(sellerIsComplete({ siren: "123456789" })).toBe(false)
    expect(sellerIsComplete(undefined)).toBe(false)
  })
})

describe("invoiceRefusal", () => {
  const order = {
    paymentStatus: "paid",
    status: "confirmed",
    source: "website",
  }

  it("invoices a paid website order", () => {
    expect(invoiceRefusal(order, SELLER)).toBeNull()
  })

  it("issues nothing before the money arrives", () => {
    // A number cannot be taken back, so it must not be spent on a sale that
    // may never happen.
    expect(invoiceRefusal({ ...order, paymentStatus: "pending" }, SELLER)).toBe(
      "not_paid"
    )
  })

  it("issues nothing for a cancelled order", () => {
    expect(invoiceRefusal({ ...order, status: "cancelled" }, SELLER)).toBe(
      "cancelled"
    )
  })

  it("leaves a marketplace sale to the marketplace", () => {
    expect(invoiceRefusal({ ...order, source: "uber_eats" }, SELLER)).toBe(
      "marketplace"
    )
    expect(invoiceRefusal({ ...order, source: "deliveroo" }, SELLER)).toBe(
      "marketplace"
    )
  })

  it("issues nothing twice", () => {
    expect(invoiceRefusal({ ...order, invoiceId: "invoices:1" }, SELLER)).toBe(
      "already_issued"
    )
  })

  it("refuses while the business has not said who it is", () => {
    expect(invoiceRefusal(order, undefined)).toBe("seller_incomplete")
  })
})

// ============================================================================
// Issuing
// ============================================================================

describe("issueInvoiceForOrder", () => {
  it("numbers the first invoice of the year FA-2026-000001", async () => {
    const { ctx, store } = createCtx(docs())

    const result = await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })

    expect(result).toEqual({
      issued: true,
      invoiceId: expect.stringMatching(/^invoices:/),
      number: "FA-2026-000001",
    })
    expect(store["orders:1"]!.invoiceId).toBe(result.issued && result.invoiceId)
  })

  it("issues exactly one however many times the payment settles", async () => {
    // `recordPaymentStatus` has no "was it already paid" guard on purpose: a
    // replayed Stripe webhook and the success page settle the same order. The
    // `order.invoiceId` read is what makes issuance idempotent under that.
    const { ctx, store } = createCtx(docs({ paymentStatus: "pending" }))

    await recordPaymentStatus.handler(ctx, { id: "orders:1", paymentStatus: "paid" })
    await recordPaymentStatus.handler(ctx, { id: "orders:1", paymentStatus: "paid" })
    await recordPaymentStatus.handler(ctx, { id: "orders:1", paymentStatus: "paid" })

    const invoices = Object.values(store).filter((d) =>
      String(d._id).startsWith("invoices:")
    )
    expect(invoices).toHaveLength(1)
    expect(invoices[0]!.number).toBe("FA-2026-000001")
  })

  it("issues one for cash taken at the counter", async () => {
    const { ctx, store } = createCtx(
      docs({ paymentStatus: "pending", paymentMethod: "cash", status: "pending" })
    )

    await markCashPaid.handler(ctx, { orderId: "orders:1" })

    const invoices = Object.values(store).filter((d) =>
      String(d._id).startsWith("invoices:")
    )
    expect(invoices).toHaveLength(1)
  })

  it("numbers consecutive sales with no gaps", async () => {
    const base = docs()
    const { ctx } = createCtx({
      ...base,
      "orders:2": { ...base["orders:1"], _id: "orders:2", orderNumber: "ORD-2026-00413" },
      "orders:3": { ...base["orders:1"], _id: "orders:3", orderNumber: "ORD-2026-00414" },
    })

    const numbers: string[] = []
    for (const id of ["orders:1", "orders:2", "orders:3"]) {
      const result = await issueInvoiceForOrder(ctx, id, { now: NOW })
      if (result.issued) numbers.push(result.number)
    }

    expect(numbers).toEqual([
      "FA-2026-000001",
      "FA-2026-000002",
      "FA-2026-000003",
    ])
  })

  it("shares no counter with the order series", async () => {
    // `ORD-2026-00412` and `FA-2026-000001` name the same sale and neither can
    // be derived from the other — which is why the invoice carries the order
    // number as a reference.
    const { ctx, store } = createCtx(docs())

    await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })

    const invoice = Object.values(store).find((d) =>
      String(d._id).startsWith("invoices:")
    )
    expect(invoice!.number).toBe("FA-2026-000001")
    expect(invoice!.orderNumber).toBe("ORD-2026-00412")
  })

  it("refuses without ever throwing on the payment path", async () => {
    // A missing SIREN must not fail a payment that has already been taken.
    const { ctx, store } = createCtx(docs({}, { seller: undefined }))

    const result = await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })

    expect(result).toEqual({ issued: false, reason: "seller_incomplete" })
    expect(
      Object.values(store).filter((d) => String(d._id).startsWith("invoices:"))
    ).toHaveLength(0)
  })

  it("issues nothing for a marketplace order settling", async () => {
    const { ctx, store } = createCtx(
      docs({ source: "uber_eats", paymentStatus: "pending" })
    )

    await recordPaymentStatus.handler(ctx, { id: "orders:1", paymentStatus: "paid" })

    expect(
      Object.values(store).filter((d) => String(d._id).startsWith("invoices:"))
    ).toHaveLength(0)
  })
})

// ============================================================================
// A snapshot, not a view
// ============================================================================

describe("what the invoice freezes", () => {
  it("copies the seller, the establishment and the buyer", async () => {
    const { ctx, store } = createCtx(
      docs({
        type: "delivery",
        deliveryAddress: {
          street: "5 avenue de la Gare",
          city: "Lyon",
          postalCode: "69002",
          country: "FR",
        },
      })
    )

    await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    const invoice = Object.values(store).find((d) =>
      String(d._id).startsWith("invoices:")
    )!

    expect(invoice.seller.legalName).toBe("SARL Chez Luigi")
    expect(invoice.seller.siret).toBe("12345678900012")
    expect(invoice.seller.vatNumber).toBe("FR12123456789")
    expect(invoice.seller.storeName).toBe("Chez Luigi")
    expect(invoice.buyer.name).toBe("Camille Martin")
    expect(invoice.buyer.address).toEqual({
      street: "5 avenue de la Gare",
      city: "Lyon",
      postalCode: "69002",
      country: "FR",
    })
  })

  it("copies the lines with the rate they were taxed at", async () => {
    const { ctx, store } = createCtx(docs())

    await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    const invoice = Object.values(store).find((d) =>
      String(d._id).startsWith("invoices:")
    )!

    expect(invoice.lines).toEqual([
      {
        description: "Margherita",
        quantity: 2,
        unitPrice: 1200,
        subtotal: 2400,
        taxRatePercent: 10,
        options: ["Taille : Grande"],
      },
    ])
    expect(invoice.taxBreakdown).toEqual([
      { ratePercent: 10, grossAmount: 2400, taxAmount: 218 },
    ])
    expect(invoice.currency).toBe("EUR")
  })

  it("does not change when the establishment is renamed afterwards", async () => {
    const { ctx, store } = createCtx(docs())

    await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    store["stores:1"]!.name = "Chez Mario"
    store["globalSettings:1"]!.seller = { legalName: "SAS Mario" }
    store["globalSettings:1"]!.taxRate = 20

    const invoice = Object.values(store).find((d) =>
      String(d._id).startsWith("invoices:")
    )!
    expect(invoice.seller.storeName).toBe("Chez Luigi")
    expect(invoice.seller.legalName).toBe("SARL Chez Luigi")
    expect(invoice.taxBreakdown).toEqual([
      { ratePercent: 10, grossAmount: 2400, taxAmount: 218 },
    ])
  })

  it("says on its face when the delivery fee is not broken down", async () => {
    // No `deliveryTaxRate` is configured, so the fee carries no rate and the
    // taxed amounts do not add up to the total. The document must admit that
    // rather than present figures that quietly disagree.
    const { ctx, store } = createCtx(
      docs({ type: "delivery", deliveryFee: 490, total: 2890 })
    )

    await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    const invoice = Object.values(store).find((d) =>
      String(d._id).startsWith("invoices:")
    )!

    expect(invoice.deliveryFee).toBe(490)
    expect(invoice.deliveryNotBrokenDown).toBe(true)
  })

  it("says nothing of the sort when the figures do add up", async () => {
    const { ctx, store } = createCtx(docs())

    await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    const invoice = Object.values(store).find((d) =>
      String(d._id).startsWith("invoices:")
    )!

    expect(invoice.deliveryNotBrokenDown).toBeUndefined()
  })
})

// ============================================================================
// Reversing one
// ============================================================================

describe("issueCreditNoteForInvoice", () => {
  it("reverses an invoice with an avoir in its own series", async () => {
    const { ctx, store } = createCtx(docs())

    const issued = await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    expect(issued.issued).toBe(true)
    const invoiceId = issued.issued ? issued.invoiceId : ""

    const avoir = await issueCreditNoteForInvoice(ctx, invoiceId, { now: NOW })

    expect(avoir).toEqual({
      issued: true,
      invoiceId: expect.stringMatching(/^invoices:/),
      number: "AV-2026-000001",
    })

    // The invoice is untouched. An invoice is never edited and never deleted.
    expect(store[invoiceId]!.number).toBe("FA-2026-000001")
    expect(store[invoiceId]!.kind).toBe("invoice")
  })

  it("does not reverse the same invoice twice", async () => {
    const { ctx } = createCtx(docs())

    const issued = await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    const invoiceId = issued.issued ? issued.invoiceId : ""

    await issueCreditNoteForInvoice(ctx, invoiceId, { now: NOW })
    const again = await issueCreditNoteForInvoice(ctx, invoiceId, { now: NOW })

    expect(again).toEqual({ issued: false, reason: "already_issued" })
  })

  it("carries the figures of the invoice it reverses", async () => {
    const { ctx, store } = createCtx(docs())

    const issued = await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    const invoiceId = issued.issued ? issued.invoiceId : ""
    await issueCreditNoteForInvoice(ctx, invoiceId, { now: NOW })

    // Scoped to the table: `numberSequences` rows carry a `kind` field too, and
    // one of them is literally `"credit_note"`.
    const avoir = Object.values(store).find(
      (d) => String(d._id).startsWith("invoices:") && d.kind === "credit_note"
    )!
    expect(avoir.reversesInvoiceId).toBe(invoiceId)
    expect(avoir.total).toBe(2400)
    expect(avoir.orderNumber).toBe("ORD-2026-00412")
  })
})

describe("documentsForOrder", () => {
  it("returns the invoice and any credit note against an order", async () => {
    const { ctx } = createCtx(docs())

    const issued = await issueInvoiceForOrder(ctx, "orders:1", { now: NOW })
    await issueCreditNoteForInvoice(
      ctx,
      issued.issued ? issued.invoiceId : "",
      { now: NOW }
    )

    const documents = await documentsForOrder(ctx, "orders:1")

    expect(documents.map((d: Doc) => d.number)).toEqual([
      "FA-2026-000001",
      "AV-2026-000001",
    ])
  })

  it("returns nothing for an order that was never invoiced", async () => {
    const { ctx } = createCtx(docs({ paymentStatus: "pending" }))

    expect(await documentsForOrder(ctx, "orders:1")).toEqual([])
  })
})
