/**
 * Email events functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 *
 * NOTE: emailEvents is a detail/debug table only.
 * Never aggregate this table for dashboard analytics — use campaign.stats instead.
 * Future: events older than 90 days can be purged (V2).
 */

import { v } from "convex/values"
import { MAX_EMAILS_PER_WEEK } from "./campaignDelivery"
import { clampPageSize } from "./pagination"

const eventTypeValidator = v.union(
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("opened"),
  v.literal("clicked"),
  v.literal("bounced"),
  v.literal("unsubscribed"),
  v.literal("complained"),
  v.literal("converted")
)

const metadataValidator = v.optional(
  v.object({
    linkUrl: v.optional(v.string()),
    orderId: v.optional(v.string()),
    revenue: v.optional(v.number()),
    userAgent: v.optional(v.string()),
    variantId: v.optional(v.string()),
  })
)

// === QUERIES ===

export const listByCampaign = {
  args: {
    campaignId: v.id("emailCampaigns"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailEvents")
      .withIndex("by_campaignId", (q: any) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(args.limit ?? 100)
  },
}

export const listBySubscriber = {
  args: {
    subscriberId: v.id("emailSubscribers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailEvents")
      .withIndex("by_subscriberId", (q: any) =>
        q.eq("subscriberId", args.subscriberId)
      )
      .order("desc")
      .take(args.limit ?? 50)
  },
}

// === INTERNAL MUTATIONS (called by SES webhook only) ===

/**
 * Which of these subscribers has this campaign already reached?
 *
 * The guarantee that makes a resumed send safe. A cursor alone is not enough:
 * "Relancer" after a pause used to restart at the first subscriber, and even a
 * correct cursor cannot survive a batch that is retried after a transient
 * failure. Asking the events table what actually went out is the only answer
 * that holds however the send was interrupted.
 *
 * One index lookup per subscriber in the page, asked once per batch rather than
 * once per send, so the cost is a single round-trip for a batch of any size.
 */
export const alreadySentTo = {
  args: {
    campaignId: v.id("emailCampaigns"),
    subscriberIds: v.array(v.id("emailSubscribers")),
  },
  handler: async (ctx: any, args: any): Promise<string[]> => {
    const reached: string[] = []
    for (const subscriberId of args.subscriberIds) {
      const events = await ctx.db
        .query("emailEvents")
        .withIndex("by_campaignId_subscriberId", (q: any) =>
          q.eq("campaignId", args.campaignId).eq("subscriberId", subscriberId)
        )
        .collect()
      if (events.some((e: any) => e.type === "sent")) reached.push(subscriberId)
    }
    return reached
  },
}

/**
 * How many campaign emails each of these subscribers received since `since`.
 *
 * What `maxEmailsPerWeek` needs, and it counts what was actually SENT rather
 * than a stored tally that could drift — the same source `alreadySentTo` reads,
 * so the two answers cannot disagree about what went out.
 *
 * Asked once per batch, like the idempotency check, rather than once per
 * subscriber.
 */
/**
 * How high the count is allowed to climb before the answer stops mattering.
 *
 * The only consumer compares the count against `maxEmailsPerWeek`, so counting
 * past that cap buys nothing and costs a document per row. The caller passes
 * its own cap; this is the ceiling applied when it does not.
 *
 * It is `MAX_EMAILS_PER_WEEK` and not a number of its own, because saturating
 * the count is only safe while the count can still reach the cap it is compared
 * against. At 50 it could not: the settings screen offers up to 100, so a store
 * set anywhere from 51 upward counted 50, `50 < 60` is true, and a subscriber
 * with five hundred sends behind them was sent another — every batch, with the
 * anti-spam promise in the settings screen reading as enforced throughout.
 * Tying the two to one constant is what stops them drifting apart again.
 */
export const DEFAULT_SENT_COUNT_LIMIT = MAX_EMAILS_PER_WEEK

export const sentCountsSince = {
  args: {
    subscriberIds: v.array(v.id("emailSubscribers")),
    since: v.number(),
    /**
     * Stop counting here. The caller's weekly cap: `withinWeeklyCap` only asks
     * whether the count is below it, so `cap` and "cap or more" are the same
     * answer and reading further rows changes nothing.
     */
    countLimit: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: any
  ): Promise<Array<{ subscriberId: string; count: number }>> => {
    /**
     * Bounded by the week and by the cap, not by the subscriber's history.
     *
     * This read `by_subscriberId` and filtered `type` and `occurredAt` in
     * JavaScript, so the one-week question cost every event ever recorded for
     * that subscriber — sent, delivered, opened and clicked, across every
     * campaign and both automations — asked once per subscriber in a batch of
     * forty. Measured on a seeded store: 6,240 documents read to return an
     * answer that touched none of them. Convex aborts a transaction past
     * 16,384 documents, which at `BATCH_SIZE = 40` is roughly 410 lifetime
     * events per subscriber; past that, no campaign for the store can ever
     * complete again, and the failure arrives precisely as customers become
     * loyal.
     *
     * `by_subscriber_type_occurredAt` puts both filters in the index: two
     * equalities and a range on the week. The number of documents read is now
     * decided by how many emails went out in the last seven days, capped by the
     * limit above, and no longer by how long the subscriber has been a
     * customer.
     */
    // `clampPageSize` rather than `Math.max(1, Math.floor(...))`: `v.number()`
    // accepts NaN over the wire and NaN survives both, reaching `.take()`.
    const limit = clampPageSize(
      args.countLimit,
      DEFAULT_SENT_COUNT_LIMIT,
      MAX_EMAILS_PER_WEEK
    )
    const counts: Array<{ subscriberId: string; count: number }> = []
    for (const subscriberId of args.subscriberIds) {
      const events = await ctx.db
        .query("emailEvents")
        .withIndex("by_subscriber_type_occurredAt", (q: any) =>
          q
            .eq("subscriberId", subscriberId)
            .eq("type", "sent")
            .gte("occurredAt", args.since)
        )
        .take(limit)
      counts.push({ subscriberId, count: events.length })
    }
    return counts
  },
}

export const create = {
  args: {
    storeId: v.id("stores"),
    campaignId: v.optional(v.id("emailCampaigns")),
    automationId: v.optional(v.id("emailAutomations")),
    subscriberId: v.id("emailSubscribers"),
    type: eventTypeValidator,
    metadata: metadataValidator,
    occurredAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("emailEvents", args)
  },
}

export const createBatch = {
  args: {
    events: v.array(
      v.object({
        storeId: v.id("stores"),
        campaignId: v.optional(v.id("emailCampaigns")),
        automationId: v.optional(v.id("emailAutomations")),
        subscriberId: v.id("emailSubscribers"),
        type: eventTypeValidator,
        metadata: metadataValidator,
        occurredAt: v.number(),
      })
    ),
  },
  handler: async (ctx: any, args: any) => {
    for (const event of args.events) {
      await ctx.db.insert("emailEvents", event)
    }
  },
}
