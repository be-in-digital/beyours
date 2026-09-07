/**
 * What an order owes back when it stops being an order.
 *
 * WHY THIS EXISTS. Two destructive paths on `orders` were written as if nothing
 * pointed at the row, and five columns across five tables do.
 *
 * **Cancellation gave the stock back and kept the coupon.** `updateStatus`
 * restored tracked stock when an order was cancelled and left the promotion
 * exactly as the checkout had spent it: `promotions.usageCount` still counted
 * the use, and the `promotionUsages` row still stood against the customer's
 * email. So a diner who ordered with a one-per-customer code and had the order
 * cancelled — by the restaurant, on a dish that had run out — had burned their
 * one use on nothing, and could not order again. The campaign's global budget
 * spent a slot the same way. Neither is recoverable by hand: no screen anywhere
 * edits either number.
 *
 * **`orders.remove` was one line.** `ctx.db.delete(args.id)` against a row that
 * `payments.orderId`, `kitchenTickets.orderId` and `invoices.orderId` all
 * reference REQUIRED, plus `promotionUsages.orderId` and
 * `deliveryQuotes.consumedByOrderId` optionally. It has no UI caller today,
 * which is exactly why it is worth guarding now: it is live under
 * `orders:delete`, and the first button wired to it would take the invoice.
 *
 * THE SPLIT is the one `products.remove` established, on what the row means:
 *
 *  - REFUSED — `invoices`. A *facture* is a numbered fiscal document in an
 *    unbroken series (art. 242 nonies A CGI). It is never edited and never
 *    deleted, and it references the order it was issued for, so the order
 *    cannot go either. `storeCascade.assertStoreHasNoInvoices` refuses the same
 *    thing one level up, for the same reason.
 *  - REFUSED — a `payments` row that is not a dead attempt. `succeeded`,
 *    `refunded` and `partially_refunded` are money that moved and has to stay
 *    reconcilable; `pending` and `processing` are money in flight, and the
 *    provider webhook that settles it would come back to patch an order that is
 *    no longer there.
 *  - CASCADED — `kitchenTickets` and `failed` payments. Machine-kept rows that
 *    mean nothing without the order and hold a REQUIRED reference to it.
 *  - CASCADED — the consumed `deliveryQuotes` row, reached the way `privacy.ts`
 *    reaches it: through `order.uberDirectEstimateId` and `by_estimateId`.
 *    Deleted rather than detached, deliberately — clearing `consumedByOrderId`
 *    would make a spent quote reusable, which is the hole that column closed.
 *  - RELEASED — the promotion, exactly as on cancellation. An order that never
 *    happened did not spend a coupon.
 *
 * The refusals are `ConvexError`: Convex redacts a plain error's message in
 * production, and a refusal the operator is meant to act on would arrive as
 * "Server Error". The same reasoning `products.remove` and `refusal.ts` record.
 */

import { ConvexError } from "convex/values"

/** Payment states that mean money moved, or is about to. */
export const BLOCKING_PAYMENT_STATUSES: ReadonlyArray<string> = [
  "pending",
  "processing",
  "succeeded",
  "refunded",
  "partially_refunded",
]

/** Build an index range function without repeating the cast at each call. */
const eq =
  (field: string, value: unknown) =>
  (q: { eq: (f: string, v: unknown) => unknown }) =>
    q.eq(field, value)

/**
 * Give back the promotion an order spent.
 *
 * Both halves of the checkout's write are undone: the global counter that
 * `maxTotalUsage` is measured against, and the per-customer ledger row that
 * `maxUsagePerCustomer` is measured against. The row only ever exists for an
 * identified customer — `orders.create` writes it behind
 * `args.customerInfo.email` — so its absence is normal, not a failure.
 *
 * A no-op for an order that carried no promotion, which is every marketplace
 * order: `createFromWebhook` has no promotion path at all.
 *
 * Floored at zero rather than trusted: the counter is a denormalised tally, a
 * restore or a seed can leave it behind the ledger, and a negative usage count
 * would read as "minus one use" on the promotions screen for ever.
 *
 * Returns whether anything was given back, for a caller that wants to log it.
 */
export async function releasePromotionForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  order: { _id: unknown; promotionId?: unknown },
  now: number
): Promise<boolean> {
  if (!order.promotionId) return false

  let released = false

  const promotion = await ctx.db.get(order.promotionId)
  if (promotion) {
    await ctx.db.patch(order.promotionId, {
      usageCount: Math.max(0, (promotion.usageCount ?? 0) - 1),
      updatedAt: now,
    })
    released = true
  }

  // `by_orderId` exists for this. Both other indexes on the table start at the
  // promotion, and a cancellation knows the order.
  const usages = await ctx.db
    .query("promotionUsages")
    .withIndex("by_orderId", eq("orderId", order._id))
    .collect()

  for (const usage of usages) {
    await ctx.db.delete(usage._id)
    released = true
  }

  return released
}

/**
 * Refuse to delete an order that has issued an invoice.
 *
 * Read both ways round on purpose. `order.invoiceId` is the fast answer and the
 * one `issueInvoiceForOrder` writes, but it is optional, and an order invoiced
 * before that column was populated would slip past it. `invoices.by_orderId` is
 * the authoritative side of the same link. Either standing is a refusal.
 */
export async function assertOrderHasNoInvoice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  order: { _id: unknown; invoiceId?: unknown }
): Promise<void> {
  const linked = order.invoiceId ? await ctx.db.get(order.invoiceId) : null
  const invoice =
    linked ??
    (await ctx.db
      .query("invoices")
      .withIndex("by_orderId", eq("orderId", order._id))
      .first())

  if (!invoice) return

  const named = invoice.number ? `La facture ${invoice.number}` : "Une facture"

  throw new ConvexError({
    code: "order_has_invoice",
    message:
      `${named} a été émise pour cette commande : elle ne peut pas être supprimée. ` +
      "Les factures forment une série comptable continue, conservée de façon définitive. " +
      "Annulez la commande — un avoir sera émis si elle a été payée.",
  })
}

/**
 * Refuse to delete an order whose money is not settled and gone.
 *
 * A `failed` payment is a dead attempt and is cascaded by
 * `deleteOrderDependents`. Everything else either moved money or is about to,
 * and in the in-flight case the provider's webhook would come back to patch an
 * order that no longer exists.
 */
export async function assertOrderHasNoLivePayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  order: { _id: unknown }
): Promise<void> {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_orderId", eq("orderId", order._id))
    .collect()

  const blocking = payments.some((payment: { status?: unknown }) =>
    BLOCKING_PAYMENT_STATUSES.includes(String(payment.status))
  )
  if (!blocking) return

  throw new ConvexError({
    code: "order_has_payment",
    message:
      "Cette commande porte un paiement enregistré : elle ne peut pas être supprimée, " +
      "sinon l'encaissement resterait sans commande à rapprocher. " +
      "Annulez-la et traitez le remboursement depuis l'écran Paiements.",
  })
}

/** What the delete carried away with the order. */
export interface OrderCascadeResult {
  kitchenTickets: number
  failedPayments: number
  deliveryQuotes: number
  promotionReleased: boolean
}

/**
 * Delete the rows that mean nothing once the order is gone.
 *
 * Called only after the refusals above have passed, so nothing here can meet an
 * invoice or a payment that matters — the payment filter repeats the rule
 * anyway rather than trusting call order. Bounded by one order: a handful of
 * tickets, at most a few dead attempts, one quote.
 */
export async function deleteOrderDependents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  order: { _id: unknown; promotionId?: unknown; uberDirectEstimateId?: unknown },
  now: number
): Promise<OrderCascadeResult> {
  const tickets = await ctx.db
    .query("kitchenTickets")
    .withIndex("by_orderId", eq("orderId", order._id))
    .collect()
  for (const ticket of tickets) {
    await ctx.db.delete(ticket._id)
  }

  const payments = await ctx.db
    .query("payments")
    .withIndex("by_orderId", eq("orderId", order._id))
    .collect()
  let failedPayments = 0
  for (const payment of payments) {
    if (BLOCKING_PAYMENT_STATUSES.includes(String(payment.status))) continue
    await ctx.db.delete(payment._id)
    failedPayments++
  }

  let deliveryQuotes = 0
  if (order.uberDirectEstimateId) {
    const quotes = await ctx.db
      .query("deliveryQuotes")
      .withIndex("by_estimateId", eq("estimateId", order.uberDirectEstimateId))
      .collect()
    for (const quote of quotes) {
      await ctx.db.delete(quote._id)
      deliveryQuotes++
    }
  }

  const promotionReleased = await releasePromotionForOrder(ctx, order, now)

  return {
    kitchenTickets: tickets.length,
    failedPayments,
    deliveryQuotes,
    promotionReleased,
  }
}
