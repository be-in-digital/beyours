/**
 * Email campaigns functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 * Stats are incremented in real-time — never aggregated from emailEvents
 */

import { v } from "convex/values"

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("paused"),
  v.literal("cancelled")
)

const statsValidator = v.object({
  sent: v.number(),
  delivered: v.number(),
  opened: v.number(),
  clicked: v.number(),
  bounced: v.number(),
  unsubscribed: v.number(),
  converted: v.number(),
  revenue: v.number(),
})

const emptyStats = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
  converted: 0,
  revenue: 0,
}

// === QUERIES ===

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailCampaigns")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
}

export const getById = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

export const listRecent = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailCampaigns")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(args.limit ?? 5)
  },
}

export const listByStatus = {
  args: {
    storeId: v.id("stores"),
    status: statusValidator,
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailCampaigns")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      .collect()
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    subject: v.string(),
    previewText: v.optional(v.string()),
    templateId: v.id("emailTemplates"),
    segmentId: v.optional(v.id("emailSegments")),
    abTestEnabled: v.boolean(),
    variants: v.optional(
      v.array(
        v.object({
          id: v.string(),
          subject: v.string(),
          percentage: v.number(),
        })
      )
    ),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("emailCampaigns", {
      ...args,
      status: args.scheduledAt ? "scheduled" : "draft",
      stats: emptyStats,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailCampaigns"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    previewText: v.optional(v.string()),
    templateId: v.optional(v.id("emailTemplates")),
    segmentId: v.optional(v.id("emailSegments")),
    abTestEnabled: v.optional(v.boolean()),
    variants: v.optional(
      v.array(
        v.object({
          id: v.string(),
          subject: v.string(),
          percentage: v.number(),
        })
      )
    ),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}

export const schedule = {
  args: {
    id: v.id("emailCampaigns"),
    scheduledAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "scheduled",
      scheduledAt: args.scheduledAt,
      updatedAt: Date.now(),
    })
  },
}

export const cancel = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    })
  },
}

export const pause = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "paused",
      updatedAt: Date.now(),
    })
  },
}

export const markSending = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "sending",
      sentAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

export const markSent = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "sent",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

// === INTERNAL ===

/**
 * Increment a single stat field atomically.
 * Called by the SES webhook handler on each tracking event.
 */
export const incrementStats = {
  args: {
    id: v.id("emailCampaigns"),
    field: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("unsubscribed"),
      v.literal("converted")
    ),
    amount: v.optional(v.number()), // defaults to 1
  },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) return
    const delta = args.amount ?? 1
    await ctx.db.patch(args.id, {
      stats: {
        ...campaign.stats,
        [args.field]: (campaign.stats[args.field] ?? 0) + delta,
      },
      updatedAt: Date.now(),
    })
  },
}

/**
 * Reset stats and put campaign back to draft (for resend).
 */
export const resetStats = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      stats: emptyStats,
      status: "draft",
      sentAt: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Increment revenue stat atomically.
 */
export const incrementRevenue = {
  args: {
    id: v.id("emailCampaigns"),
    amount: v.number(), // in cents
  },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) return
    await ctx.db.patch(args.id, {
      stats: {
        ...campaign.stats,
        revenue: (campaign.stats.revenue ?? 0) + args.amount,
        converted: (campaign.stats.converted ?? 0) + 1,
      },
      updatedAt: Date.now(),
    })
  },
}
