import { v } from "convex/values"

/**
 * Provider webhook deduplication
 *
 * Export plain { args, handler } objects for Convex internalMutation wrappers.
 *
 * WHY THIS EXISTS: `stripeWebhook.handleWebhook` verified the signature and then
 * processed whatever arrived, every time it arrived. Stripe retries a delivery
 * until it gets a 2xx and warns that a delivery may repeat even after one, so
 * the handler ran the settlement path once per retry.
 *
 * The commercial site solved this for its own account in `apps/site` and the
 * engine never got the same treatment. This is that guard, generalised: the key
 * is (provider, eventId), so SumUp and PayPal callbacks can use it without
 * their opaque ids colliding with Stripe's.
 */

/** How far in the past a delivery stops being worth remembering. */
export const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * What `beginEvent` found:
 *  - "fresh"             — never seen; the row is now recorded, go ahead.
 *  - "in_flight"         — seen, never finished; a previous attempt died, so
 *                          the retry is allowed through rather than swallowed.
 *  - "already_processed" — finished once; do nothing and answer 200.
 */
export type EventAdmission = "fresh" | "in_flight" | "already_processed"

/**
 * Claim a provider delivery before handling it.
 *
 * Deliberately NOT "insert and let a unique index reject the second": Convex
 * has no unique constraint, so the read-then-insert is the only mechanism
 * available, and it is enough because it runs inside one mutation and therefore
 * one transaction.
 */
export const beginEvent = {
  args: {
    provider: v.string(),
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (
    ctx: any,
    args: { provider: string; eventId: string; eventType: string }
  ): Promise<EventAdmission> => {
    if (!args.eventId) {
      throw new Error("beginEvent requires a provider event id")
    }

    const existing = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q: any) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId)
      )
      .unique()

    if (existing) {
      return existing.processed ? "already_processed" : "in_flight"
    }

    const now = Date.now()
    await ctx.db.insert("paymentEvents", {
      provider: args.provider,
      eventId: args.eventId,
      eventType: args.eventType,
      processed: false,
      createdAt: now,
      expiresAt: now + EVENT_RETENTION_MS,
    })

    return "fresh"
  },
}

/**
 * Record that a delivery finished. Only after this does a repeat of the same
 * delivery become a no-op — a handler that threw halfway leaves the row
 * unprocessed on purpose, so the provider's retry can finish the job.
 */
export const markProcessed = {
  args: {
    provider: v.string(),
    eventId: v.string(),
  },
  handler: async (
    ctx: any,
    args: { provider: string; eventId: string }
  ): Promise<void> => {
    const existing = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_eventId", (q: any) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId)
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, { processed: true })
    }
  },
}

/**
 * Delete the deliveries whose replay window has closed.
 *
 * A range scan on `by_expiresAt`, not a full-table walk: on a busy store this
 * runs nightly against a table that only ever grows.
 */
export const sweepExpired = {
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: { now?: number; limit?: number }
  ): Promise<{ deleted: number }> => {
    const cutoff = args.now ?? Date.now()

    const expired = await ctx.db
      .query("paymentEvents")
      .withIndex("by_expiresAt", (q: any) => q.lt("expiresAt", cutoff))
      // A row expiring exactly now has not expired yet; `lt` is the boundary.
      .take(args.limit ?? 500)

    for (const row of expired) {
      await ctx.db.delete(row._id)
    }

    return { deleted: expired.length }
  },
}
