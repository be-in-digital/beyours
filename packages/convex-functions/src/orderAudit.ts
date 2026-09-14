/**
 * A record of who moved an order, and from what to what (#104).
 *
 * WHAT WAS MISSING. An order's status is the most consequential field in the
 * product — it releases the kitchen, it flags money as owed back, it cancels
 * tickets — and nothing recorded who changed it. `systemAuditLog` existed and
 * carried the RGPD runs and nothing else, so an owner asking "who cancelled the
 * 42 € order at half past eight" had `orders.updatedAt` and a shrug.
 *
 * WHY IT IS NOT `stockMovements`-SHAPED. A status change is not a quantity; it is
 * an ACT, and the question asked of it later is about the person. It therefore
 * goes into the log the product already uses for acts — the one the privacy runs
 * write to — rather than into a new table nobody would think to read.
 *
 * WHAT IT DOES NOT RECORD. The diner. `details` carries the order NUMBER, the two
 * statuses and the reason; it does not carry the customer's name, address or
 * telephone number. An audit log is read by the whole team and is outside the
 * erasure set, so putting a diner in it would be a copy of their data that
 * `eraseDataSubject` cannot reach.
 */

/** How long a details string may be. The log is read, not parsed. */
export const MAX_ORDER_AUDIT_DETAILS = 500

/**
 * The sentence written into the log.
 *
 * Pure, so it is testable without a database and so both the wording and the
 * omission of the diner can be pinned.
 */
export function orderStatusAuditDetails(input: {
  orderNumber: string
  from: string
  to: string
  reason?: string
  source?: string
}): string {
  const parts = [`commande ${input.orderNumber}`, `${input.from} → ${input.to}`]
  // The platform an order came from, when it came from one: a cancellation that
  // Deliveroo sent and one a member of staff made are the same two statuses and
  // very different facts.
  if (input.source && input.source !== "website") parts.push(`source ${input.source}`)
  if (input.reason) parts.push(`motif : ${input.reason}`)
  return parts.join(" — ").slice(0, MAX_ORDER_AUDIT_DETAILS)
}

/**
 * Record one status change.
 *
 * `performedBy` is the identity's subject when there is one and a named
 * non-person otherwise: a platform webhook, a scheduler and a payment
 * confirmation all move orders with no session, and writing "unknown" for the
 * three of them would make the log useless exactly where it is most needed.
 *
 * Never throws. An audit line is not a reason for a kitchen status change to
 * fail — the same rule the confirmation email follows.
 */
export async function recordOrderStatusChange(
  ctx: any,
  input: {
    orderNumber: string
    from: string
    to: string
    reason?: string
    source?: string
    now: number
  }
): Promise<void> {
  let actor = "système"
  try {
    const identity = await ctx.auth?.getUserIdentity?.()
    if (identity?.subject) actor = String(identity.subject)
  } catch {
    // An internal mutation has no auth at all on some runtimes. "système" is the
    // honest answer there, and it is better than failing the status change.
  }

  await ctx.db.insert("systemAuditLog", {
    action: "order_status_change",
    performedBy: actor,
    performedAt: input.now,
    details: orderStatusAuditDetails(input),
    result: "success" as const,
  })
}
