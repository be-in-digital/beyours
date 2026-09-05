import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Invoices — *factures* — and the credit notes that reverse them.
 *
 * WHY THIS EXISTS: the product issued no document at all. Searching the engine
 * for an invoice returned five hits, four of them BeYours' own Stripe
 * subscription webhook: a diner who paid got nothing, and the restaurateur had
 * nothing to hand their accountant. `orderTotals.ts` even carried a comment
 * about "the VAT breakdown an invoice has to show", describing a document that
 * was never produced.
 *
 * ## An invoice is a snapshot, not a view
 *
 * Everything here is copied at issue and never recomputed. That is the whole
 * discipline of the table: an invoice rendered from live rows is a document
 * that changes after it was issued, which is the opposite of what a fiscal
 * archive is for. A product repriced, a store renamed, a global tax rate
 * edited, an order cancelled — none of them may restate an invoice that has
 * already been given to a customer.
 *
 * So the seller identity is copied, not read from `globalSettings`; the buyer
 * is copied, not read from the order; and the lines carry the rate they were
 * taxed at, because `orders.items[]` does not store one and `products.taxRate`
 * is mutable.
 *
 * ## What must never happen to a row here
 *
 * It is never edited and never deleted. A sale reversed afterwards produces a
 * credit note — its own document, in its own numbered series, referencing the
 * invoice it cancels. `storeCascade` must therefore NOT delete invoices when an
 * establishment is removed, and `system.importBackup` must not restore them:
 * a fiscal series that a restore can rewrite is not a series.
 */
export const invoicesTable = defineTable({
  /**
   * `FA-2026-000287`, or `AV-2026-000014` for a credit note. Allocated by
   * `numbering.allocateInvoiceNumber` inside the mutation that writes this row,
   * which is what makes the series gapless.
   */
  number: v.string(),
  kind: v.union(v.literal("invoice"), v.literal("credit_note")),
  /** The invoice a credit note reverses. Absent on an invoice. */
  reversesInvoiceId: v.optional(v.id("invoices")),

  /** When the document counts as issued. Monotonic within a series. */
  issuedAt: v.number(),
  /** The fiscal year of the series, on the establishment's clock. */
  year: v.number(),

  orderId: v.id("orders"),
  /** The reference the customer already knows. `FA-…` cannot be derived from it. */
  orderNumber: v.string(),
  /** Which establishment sold it — for reporting, not for the numbering. */
  storeId: v.id("stores"),

  /** The seller, as at issue. Copied from `globalSettings.seller`. */
  seller: v.object({
    legalName: v.string(),
    legalForm: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.optional(v.string()),
    })),
    siren: v.optional(v.string()),
    siret: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    rcs: v.optional(v.string()),
    shareCapital: v.optional(v.number()),
    legalMentions: v.optional(v.string()),
    /** The trading name of the establishment that served the order. */
    storeName: v.string(),
    storeAddress: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.optional(v.string()),
    })),
  }),

  /** The buyer, as recorded on the order. A guest gives a name and often no more. */
  buyer: v.object({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.optional(v.string()),
    })),
  }),

  /**
   * The lines, frozen.
   *
   * `taxRatePercent` is on the line because `orders.items[]` has none: the rate
   * is read live from `products.taxRate` when the order is priced, so a product
   * retaxed afterwards would restate every invoice that ever included it.
   * Absent when the order predates the rate being recorded.
   */
  lines: v.array(v.object({
    description: v.string(),
    quantity: v.number(),
    /** Unit price in cents, tax included. */
    unitPrice: v.number(),
    /** Line total in cents, tax included, options included. */
    subtotal: v.number(),
    taxRatePercent: v.optional(v.number()),
    options: v.optional(v.array(v.string())),
  })),

  /** Goods total in cents, tax included. */
  subtotal: v.number(),
  deliveryFee: v.optional(v.number()),
  discount: v.optional(v.number()),
  /** What was charged, in cents. Tax is inside it. */
  total: v.number(),
  /** Tax contained in `total`. */
  taxAmount: v.number(),
  /**
   * One entry per rate. Legally required on the document: the taxable amount
   * and the tax, per rate.
   *
   * `deliveryNotBrokenDown` says the delivery fee is NOT represented in these
   * entries, because no rate has been configured for it. The renderer must say
   * so on the face of the document rather than let the figures quietly fail to
   * add up.
   */
  taxBreakdown: v.array(v.object({
    ratePercent: v.number(),
    grossAmount: v.number(),
    taxAmount: v.number(),
  })),
  deliveryNotBrokenDown: v.optional(v.boolean()),
  currency: v.string(),

  /** How it was paid, as at issue. */
  payment: v.object({
    method: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    provider: v.optional(v.string()),
  }),

  createdAt: v.number(),
})
  .index("by_number", ["number"])
  .index("by_orderId", ["orderId"])
  .index("by_storeId_issuedAt", ["storeId", "issuedAt"])
  .index("by_kind_year", ["kind", "year"])
