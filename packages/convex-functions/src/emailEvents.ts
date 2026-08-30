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
export const sentCountsSince = {
  args: {
    subscriberIds: v.array(v.id("emailSubscribers")),
    since: v.number(),
  },
  handler: async (
    ctx: any,
    args: any
  ): Promise<Array<{ subscriberId: string; count: number }>> => {
    const counts: Array<{ subscriberId: string; count: number }> = []
    for (const subscriberId of args.subscriberIds) {
      const events = await ctx.db
        .query("emailEvents")
        .withIndex("by_subscriberId", (q: any) =>
          q.eq("subscriberId", subscriberId)
        )
        .collect()
      counts.push({
        subscriberId,
        count: events.filter(
          (e: any) => e.type === "sent" && e.occurredAt >= args.since
        ).length,
      })
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
