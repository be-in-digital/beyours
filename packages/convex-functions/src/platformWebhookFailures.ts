import { v } from "convex/values"

/**
 * The record kept when a delivery-platform webhook could not be acted on, and
 * the flag that says an order was never really accepted on the platform.
 *
 * Both exist because the old handler had exactly one way of reporting trouble —
 * `console.error` — and a log line in a Convex deployment is not something a
 * restaurant owner will ever see. An order silently misrouted, or silently
 * never accepted, looked identical to one that worked.
 */

export interface RecordFailureArgs {
  platform: "uberEats" | "deliveroo"
  eventType?: string
  externalOrderId?: string
  platformStoreId?: string
  reason:
    | "no_integrations"
    | "unidentified_store"
    | "unknown_store"
    | "ambiguous_store"
    | "fetch_failed"
    | "accept_failed"
    | "processing_failed"
  detail?: string
  rawBody?: string
}

/** How much of a raw body we keep. Enough to replay, bounded so a flood of
 *  malformed events cannot fill the deployment. */
export const MAX_RAW_BODY_CHARS = 20_000

/**
 * Keep an event we refused to guess about.
 *
 * Deliberately never throws: it is called from the failure path of a webhook,
 * and a dead-letter write that can itself fail the handler would turn one lost
 * order into a retry storm.
 */
export const record = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    eventType: v.optional(v.string()),
    externalOrderId: v.optional(v.string()),
    platformStoreId: v.optional(v.string()),
    reason: v.union(
      v.literal("no_integrations"),
      v.literal("unidentified_store"),
      v.literal("unknown_store"),
      v.literal("ambiguous_store"),
      v.literal("fetch_failed"),
      v.literal("accept_failed"),
      v.literal("processing_failed")
    ),
    detail: v.optional(v.string()),
    rawBody: v.optional(v.string()),
  },
  // `args: any` is the package idiom: Convex's `internalMutation()` overload
  // infers the argument type from the validator above, and an explicitly typed
  // parameter here collapses that inference to `never` at every call site. The
  // shape is re-asserted on the next line so the body stays typed.
  handler: async (ctx: any, args: any) => {
    const failure = args as RecordFailureArgs
    return await ctx.db.insert("platformWebhookFailures", {
      platform: failure.platform,
      eventType: failure.eventType,
      externalOrderId: failure.externalOrderId,
      platformStoreId: failure.platformStoreId,
      reason: failure.reason,
      detail: failure.detail?.slice(0, 2_000),
      rawBody: failure.rawBody?.slice(0, MAX_RAW_BODY_CHARS),
      receivedAt: Date.now(),
    })
  },
}

/** Everything still waiting for somebody, newest first. */
export const listUnresolved = {
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: { limit?: number }) => {
    return await ctx.db
      .query("platformWebhookFailures")
      .withIndex("by_resolvedAt_receivedAt", (q: any) => q.eq("resolvedAt", undefined))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200))
  },
}

export const markResolved = {
  args: {
    id: v.id("platformWebhookFailures"),
    resolvedBy: v.string(),
  },
  handler: async (ctx: any, args: { id: string; resolvedBy: string }) => {
    await ctx.db.patch(args.id, {
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
    })
  },
}

/**
 * Record whether the platform actually agreed to the order.
 *
 * `platformSyncStatus` has been in the schema all along and was written by
 * nothing. Meanwhile `auto_accept` set the local status to `confirmed`
 * unconditionally — the call to Uber was inside an `if`, the confirmation was
 * not, and the `catch` only logged. So the customer was told the restaurant had
 * accepted while Uber had never been told anything, and Uber auto-cancelled at
 * 11.5 minutes with the food already made.
 *
 * An order is `confirmed` only on a 2xx from the platform. Otherwise it stays
 * where it was and is flagged `failed`.
 *
 * What the staff see today is the order itself: it stays `pending`, its ticket
 * stays on the pass, and the accept button stays live — so an order Uber never
 * accepted is visibly unaccepted, which is the point. Once the bounded retries
 * are exhausted it also lands in `platformWebhookFailures`.
 *
 * The flag itself is NOT yet rendered anywhere: the KDS reads `kitchenTickets`
 * and this lives on `orders`, so showing it means either joining the two in the
 * KDS query or denormalising onto the ticket the way `printStatus` already is.
 * Worth doing — but stated here rather than implied, because a comment that
 * claims a reader this field does not have is how the rest of this file's
 * neighbourhood went wrong.
 */
export const setPlatformSyncStatus = {
  args: {
    id: v.id("orders"),
    platformSyncStatus: v.union(
      v.literal("pending"),
      v.literal("synced"),
      v.literal("failed")
    ),
  },
  handler: async (
    ctx: any,
    args: { id: string; platformSyncStatus: "pending" | "synced" | "failed" }
  ) => {
    await ctx.db.patch(args.id, {
      platformSyncStatus: args.platformSyncStatus,
      updatedAt: Date.now(),
    })
  },
}
