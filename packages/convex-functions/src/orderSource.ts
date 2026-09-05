/**
 * Where an order came from, and who took the money for it.
 *
 * Its own module so that both `orders.ts` and `invoices.ts` can ask the
 * question without importing each other. It lived in `orders.ts`, and issuing
 * invoices from the payment seam would have made the two files circular — a
 * cycle that happens to work through hoisting today and is a poor thing to
 * rest a fiscal document on.
 *
 * @module orderSource
 */

/**
 * The sources where the customer paid a MARKETPLACE, not the restaurant.
 *
 * An Uber Eats or Deliveroo order is created with `paymentStatus: "paid"` and
 * never gets a `payments` row — there is nothing to write one from, and the
 * `payments.provider` union has no value for a platform. The money went to
 * Uber or Deliveroo, who remit it later and who refund the customer
 * themselves when the order is rejected.
 *
 * `source` is the discriminator rather than the absence of a `payments` row.
 * A direct card order is marked paid and settled in TWO separate mutations —
 * `orders.internalUpdatePaymentStatus` then `payments.internalSettle`, in each
 * app's `convex/stripe.ts` and `convex/stripeWebhook.ts` — so between the two a
 * genuine Stripe order is "paid" with zero payment rows. Reading marketplace
 * from that window would drop the refund flag on a real customer's money.
 * Absence is also what a genuine data bug looks like, and that must stay loud.
 *
 * Listed as marketplace rather than as "not website, not pos" on purpose: a
 * source nobody has classified yet falls through to DIRECT. A false "refund
 * owed" is visible and correctable; a missing one silently keeps a customer's
 * money, which is the whole defect #128 closed.
 */
export const MARKETPLACE_ORDER_SOURCES: readonly string[] = ["uber_eats", "deliveroo"]

/** Whether the restaurant was paid by a marketplace instead of by the customer. */
export function isMarketplaceOrder(source: unknown): boolean {
  return typeof source === "string" && MARKETPLACE_ORDER_SOURCES.includes(source)
}
