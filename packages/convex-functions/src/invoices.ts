/**
 * Issuing an invoice, and the credit note that reverses one.
 *
 * WHY THIS EXISTS: the product issued no document to anybody. A French business
 * must issue an unbroken, chronological, sequential series of invoices — art.
 * 242 nonies A of Annexe II CGI — and every French restaurant on this product
 * inherited a breach: no invoice at all, and an order number drawn from
 * `Math.random()`.
 *
 * ## Where issuance happens, and why there
 *
 * At the two seams where an order becomes paid: `orders.recordPaymentStatus`,
 * which every card path lands on — Stripe webhook, Stripe return page, PayPal
 * capture, SumUp verify — and `orders.markCashPaid`. The same two seams
 * `releaseToKitchen` uses, for the reason that file already gives: a rule that
 * lives in one caller is a rule the other three skip.
 *
 * At payment rather than at order creation, and that is the difference between
 * the two series. An order number is operational: the diner quotes it on the
 * phone, the kitchen ticket carries it, and a cancelled order consuming one is
 * a curiosity. An invoice number is fiscal: it is allocated only when the sale
 * is definitive, so the series is gapless by construction. The consequence is
 * worth stating wherever both are shown — `ORD-2026-00412` and `FA-2026-000287`
 * do not correspond, and neither can be derived from the other. The invoice
 * carries the order number as a reference instead.
 *
 * ## Everything is copied
 *
 * Nothing on an invoice is read live at render time. See the header of
 * `convex-schema/src/tables/invoices.ts`.
 *
 * @module invoices
 */

import { allocateCreditNoteNumber, allocateInvoiceNumber } from "./numbering"
import { isMarketplaceOrder } from "./orderSource"

/** Why an order gets no invoice. Every one of these is a normal outcome. */
export type InvoiceRefusal =
  | "not_paid"
  | "cancelled"
  | "marketplace"
  | "already_issued"
  | "seller_incomplete"

/** The order fields the decision reads. */
export interface InvoiceableOrder {
  paymentStatus?: unknown
  status?: unknown
  source?: unknown
  invoiceId?: unknown
}

/**
 * The one field an invoice cannot be issued without.
 *
 * A document that does not name its seller is not an invoice, whatever else is
 * on it. The rest of `globalSettings.seller` — SIREN, VAT number, RCS — is
 * required of most French businesses but not of all of them (a micro-entreprise
 * carries « TVA non applicable, art. 293 B du CGI » instead of a VAT number),
 * so the engine insists on the name and leaves the rest to the owner and their
 * accountant, rendering whatever is there.
 */
export function sellerIsComplete(seller: unknown): boolean {
  if (!seller || typeof seller !== "object") return false
  const legalName = (seller as { legalName?: unknown }).legalName
  return typeof legalName === "string" && legalName.trim().length > 0
}

/**
 * Should this order be invoiced?
 *
 * Pure, so the rule is readable in one piece and testable without a database.
 *
 *  - **not_paid** — an invoice records a completed sale. Issuing one before the
 *    money arrives puts a number in the series for a sale that may never happen,
 *    and a number cannot be taken back.
 *  - **cancelled** — likewise.
 *  - **marketplace** — Uber Eats and Deliveroo invoice the diner themselves and
 *    the restaurant is not the seller of record for that transaction. Their
 *    orders also carry `taxAmount: 0`, so an invoice built from those figures
 *    would not balance.
 *  - **already_issued** — see `orders.invoiceId`.
 *  - **seller_incomplete** — see `sellerIsComplete`.
 */
export function invoiceRefusal(
  order: InvoiceableOrder,
  seller: unknown
): InvoiceRefusal | null {
  if (order.paymentStatus !== "paid") return "not_paid"
  if (order.status === "cancelled") return "cancelled"
  if (isMarketplaceOrder(order.source)) return "marketplace"
  if (order.invoiceId) return "already_issued"
  if (!sellerIsComplete(seller)) return "seller_incomplete"
  return null
}

/**
 * What the admin's order screen says about this order's invoice.
 *
 * Either the number of the issued document, or the reason none exists —
 * computed fresh from `invoiceRefusal` on every read rather than persisted,
 * so it can never go stale when the owner completes the seller identity.
 * `orders.getById` in both apps spreads this onto the order it returns; that
 * is the surface issue #375 was about, where a seller-incomplete deployment
 * took money for weeks with no invoice and no warning anywhere (art. 242
 * nonies A CGI).
 */
export async function orderInvoiceSurface(
  ctx: any,
  order: InvoiceableOrder & { invoiceId?: string }
): Promise<{ invoiceNumber: string | null; invoiceRefusal: InvoiceRefusal | null }> {
  if (order.invoiceId) {
    const invoice = await ctx.db.get(order.invoiceId)
    if (invoice) {
      return { invoiceNumber: String(invoice.number), invoiceRefusal: null }
    }
  }
  const globalSettings = await ctx.db.query("globalSettings").first()
  return {
    invoiceNumber: null,
    invoiceRefusal: invoiceRefusal(order, globalSettings?.seller),
  }
}

/** Chosen options as they should read on a line of the document. */
function optionLabels(item: any): string[] {
  const options = Array.isArray(item?.selectedOptions) ? item.selectedOptions : []
  return options
    .map((option: any) => {
      const choice = typeof option?.choiceName === "string" ? option.choiceName : ""
      const name = typeof option?.optionName === "string" ? option.optionName : ""
      if (choice && name && choice !== name) return `${name} : ${choice}`
      return choice || name
    })
    .filter((label: string) => label.length > 0)
}

/** An address, only when it is one. */
function readAddress(value: any) {
  if (!value || typeof value !== "object") return undefined
  const { street, city, postalCode, country } = value
  if (typeof street !== "string" || typeof city !== "string") return undefined
  return {
    street,
    city,
    postalCode: typeof postalCode === "string" ? postalCode : "",
    country: typeof country === "string" ? country : undefined,
  }
}

/** What `issueInvoiceForOrder` answers: the invoice, or why there is none. */
export type IssueResult =
  | { issued: true; invoiceId: string; number: string }
  | { issued: false; reason: InvoiceRefusal }

/**
 * Issue the invoice for a paid order.
 *
 * Idempotent through `order.invoiceId`: reading it is what puts it in the
 * transaction's read set, so a second settlement racing the first is retried
 * and finds the invoice already there. `recordPaymentStatus` has no
 * "was it already paid" guard, deliberately, so this guard is the one that
 * matters.
 *
 * Allocates the number and writes the row in the SAME transaction, which is
 * what makes the series gapless: if anything below throws, the whole write set
 * is discarded and the number goes to the next sale rather than being burned.
 * Never split this across a `ctx.scheduler` call or an action.
 *
 * Never throws for a business reason — the caller is on the path that marks
 * money as received, and a missing SIREN must not fail a payment. It answers
 * with the reason instead, and the admin surfaces it: `orderInvoiceSurface`
 * puts the number-or-reason on the order `orders.getById` returns, the order
 * detail page renders « Facture non émise » with the reason, and the
 * dashboard banner warns while `globalSettings.seller` is incomplete. (#375
 * is what happens when this sentence is written before those surfaces exist.)
 */
export async function issueInvoiceForOrder(
  ctx: any,
  orderId: string,
  options: { now?: number } = {}
): Promise<IssueResult> {
  const order = await ctx.db.get(orderId)
  if (!order) return { issued: false, reason: "not_paid" }

  const globalSettings = await ctx.db.query("globalSettings").first()
  const seller = globalSettings?.seller

  const refusal = invoiceRefusal(order, seller)
  if (refusal) return { issued: false, reason: refusal }

  const store = await ctx.db.get(order.storeId)
  if (!store) return { issued: false, reason: "seller_incomplete" }

  const now = options.now ?? Date.now()
  const { invoiceNumber, issuedAt, year } = await allocateInvoiceNumber(ctx, {
    now,
    timezone: globalSettings?.timezone,
  })

  const payment = await ctx.db
    .query("payments")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", orderId))
    .first()

  const lines = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
    description: String(item?.productName ?? ""),
    quantity: Number(item?.quantity ?? 0),
    unitPrice: Number(item?.unitPrice ?? 0),
    subtotal: Number(item?.subtotal ?? 0),
    taxRatePercent:
      typeof item?.taxRatePercent === "number" ? item.taxRatePercent : undefined,
    options: optionLabels(item),
  }))

  const taxBreakdown = (Array.isArray(order.taxBreakdown) ? order.taxBreakdown : []).map(
    (entry: any) => ({
      ratePercent: Number(entry?.ratePercent ?? 0),
      grossAmount: Number(entry?.grossAmount ?? 0),
      taxAmount: Number(entry?.taxAmount ?? 0),
    })
  )

  // The delivery fee is only inside the breakdown when a rate was configured
  // for it. When it is not, the document has to say so on its face rather than
  // present figures that quietly fail to add up.
  const deliveryFee =
    typeof order.deliveryFee === "number" ? order.deliveryFee : undefined
  const brokenDownGross = taxBreakdown.reduce(
    (sum: number, entry: { grossAmount: number }) => sum + entry.grossAmount,
    0
  )
  const discount =
    typeof order.discountAmount === "number" ? order.discountAmount : undefined
  const deliveryNotBrokenDown =
    (deliveryFee ?? 0) > 0 &&
    brokenDownGross < Math.max(0, order.subtotal + (deliveryFee ?? 0) - (discount ?? 0))

  const invoiceId = await ctx.db.insert("invoices", {
    number: invoiceNumber,
    kind: "invoice" as const,
    issuedAt,
    year,
    orderId,
    orderNumber: String(order.orderNumber ?? ""),
    storeId: order.storeId,
    seller: {
      legalName: String(seller.legalName),
      legalForm: seller.legalForm,
      address: readAddress(seller.address),
      siren: seller.siren,
      siret: seller.siret,
      vatNumber: seller.vatNumber,
      rcs: seller.rcs,
      shareCapital: seller.shareCapital,
      legalMentions: seller.legalMentions,
      storeName: String(store.name ?? ""),
      storeAddress: readAddress(store.address),
    },
    buyer: {
      name: String(order.customerInfo?.name ?? ""),
      email:
        typeof order.customerInfo?.email === "string"
          ? order.customerInfo.email
          : undefined,
      phone:
        typeof order.customerInfo?.phone === "string"
          ? order.customerInfo.phone
          : undefined,
      address: readAddress(order.deliveryAddress),
    },
    lines,
    subtotal: Number(order.subtotal ?? 0),
    deliveryFee,
    discount,
    total: Number(order.total ?? 0),
    taxAmount: Number(order.taxAmount ?? 0),
    taxBreakdown,
    deliveryNotBrokenDown: deliveryNotBrokenDown ? true : undefined,
    currency: String(globalSettings?.currency ?? "EUR"),
    payment: {
      method:
        typeof order.paymentMethod === "string" ? order.paymentMethod : undefined,
      paidAt: payment?.createdAt ?? now,
      provider: typeof payment?.provider === "string" ? payment.provider : undefined,
    },
    createdAt: now,
  })

  await ctx.db.patch(orderId, { invoiceId, updatedAt: now })

  return { issued: true, invoiceId: String(invoiceId), number: invoiceNumber }
}

/**
 * Reverse an invoice with a credit note.
 *
 * An invoice is never edited and never deleted — that is what makes the series
 * mean anything. A sale reversed after issue produces an *avoir*: its own
 * document, in its own numbered series, naming the invoice it cancels and
 * carrying the same figures negated by convention of reading rather than by
 * storing negative amounts.
 *
 * Not wired to the refund path yet, and deliberately not: which refunds require
 * a credit note, and whether a partial refund produces a partial avoir, is an
 * accounting decision rather than an engineering one. The mechanism exists so
 * that decision can be implemented rather than designed from scratch.
 */
export async function issueCreditNoteForInvoice(
  ctx: any,
  invoiceId: string,
  options: { now?: number } = {}
): Promise<IssueResult> {
  const invoice = await ctx.db.get(invoiceId)
  if (!invoice) return { issued: false, reason: "not_paid" }
  if (invoice.kind !== "invoice") return { issued: false, reason: "already_issued" }

  const existing = await ctx.db
    .query("invoices")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", invoice.orderId))
    .collect()
  if (existing.some((doc: any) => doc.reversesInvoiceId === invoiceId)) {
    return { issued: false, reason: "already_issued" }
  }

  const globalSettings = await ctx.db.query("globalSettings").first()
  const now = options.now ?? Date.now()
  const { creditNoteNumber, issuedAt, year } = await allocateCreditNoteNumber(ctx, {
    now,
    timezone: globalSettings?.timezone,
  })

  const { _id, _creationTime, ...snapshot } = invoice as Record<string, unknown>

  const creditNoteId = await ctx.db.insert("invoices", {
    ...snapshot,
    number: creditNoteNumber,
    kind: "credit_note" as const,
    reversesInvoiceId: invoiceId,
    issuedAt,
    year,
    createdAt: now,
  })

  return {
    issued: true,
    invoiceId: String(creditNoteId),
    number: creditNoteNumber,
  }
}

/**
 * Every document issued against an order — the invoice, and any credit note.
 *
 * A plain helper rather than a def object: the app wrapper declares the
 * validator and the permission, because who may read an invoice is an
 * application question and the answer differs between the storefront (the
 * customer, through their order's view token) and the admin.
 */
export async function documentsForOrder(ctx: any, orderId: string) {
  return await ctx.db
    .query("invoices")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", orderId))
    .collect()
}
