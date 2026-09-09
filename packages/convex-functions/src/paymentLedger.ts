/**
 * What the payments table already holds for an order.
 *
 * WHY ITS OWN MODULE. Three things can put money on an order and all three
 * have to ask the same question before they do: `payments.settlePayment` (the
 * four provider paths), `payments.updateStatus` (the manual promotion to
 * `succeeded`), and `orders.markCashPaid` (staff taking the notes).
 * `payments.ts` and `orders.ts` already import from each other's direction, so
 * the shared reader lives here rather than making that a cycle.
 *
 * #411's first fix stated the invariant inside `settlePayment` and claimed it
 * was "a property of the ledger rather than of five call sites remembering to
 * ask a guard". It was not: `markCashPaid` inserts into the table directly,
 * and `create` + `updateStatus` is a public pair under `payments:write` that
 * writes a `succeeded` row with nothing consulted at all. Both could put a
 * second collection on an order the provider paths would have refused. One
 * definition, read by all three, is what makes the claim true.
 */

/**
 * The payment states in which the charge has been RECORDED as settled.
 *
 * Wider than "is money on this order right now" by exactly one member:
 * `refunded`. The money went back, so nothing is held — but the charge was
 * settled, and a replayed provider event must not resurrect it.
 *
 * Used by `payments.settlePayment` to tell "this charge is already on the
 * ledger" from "a placeholder row exists for it". Those were the same test,
 * and a `pending` placeholder therefore survived a settlement untouched: the
 * order went to `paid`, the row stayed `pending`, `planRefund` refused it for
 * ever, and `collectionOnOrder` — which does not count `pending` — reported
 * the order as holding no money, so a second collection was still allowed.
 */
export const LEDGERED_STATUSES = new Set([
  "succeeded",
  "partially_refunded",
  "refunded",
])

/** A payment row, as much of one as this question needs. */
export interface LedgerCollection {
  _id: string
  provider: string
  externalId?: string
  amount: number
}

/**
 * The collection this order is already holding, if it is holding one.
 *
 * `refunded` is deliberately not counted: that money went back, so nothing is
 * being held and a fresh collection would be a real one. `partially_refunded`
 * is, because part of it is still held.
 *
 * The DINER- AND STAFF-FACING gates are stricter than this.
 * `orders.markCashPaid` and `stripe.createCheckoutSession` both refuse a
 * refunded order outright, because a refunded order is closed business and
 * taking money on it again should be a new order. This is the last-resort
 * check underneath those, and it answers the narrower question a ledger can
 * answer on its own: is money on this order RIGHT NOW.
 */
export async function collectionOnOrder(
  ctx: any,
  orderId: string
): Promise<LedgerCollection | null> {
  const rows = await ctx.db
    .query("payments")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", orderId))
    .collect()

  return (
    rows.find(
      (p: any) => p.status === "succeeded" || p.status === "partially_refunded"
    ) ?? null
  )
}
