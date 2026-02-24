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
