/**
 * Email automations functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

const triggerValidator = v.union(
  v.literal("welcome"),
  v.literal("birthday"),
  v.literal("inactive"),
  v.literal("post_order"),
  v.literal("abandoned_cart")
)

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused")
)

const stepValidator = v.object({
  id: v.string(),
  delayMinutes: v.number(),
  templateId: v.id("emailTemplates"),
  segmentId: v.optional(v.id("emailSegments")),
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
      .query("emailAutomations")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

export const getById = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

export const listActive = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailAutomations")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "active")
      )
      .collect()
  },
}

/**
 * Every active automation on one trigger, across the whole deployment.
 *
 * The store-scoped `listActive` cannot serve the nightly win-back sweep: it
 * runs for the deployment, not for one restaurant, and a cron has no store to
 * scope by. Filtered rather than indexed because a deployment holds a handful
 * of automations, not a table worth scanning.
 */
export const listActiveByTrigger = {
  args: { trigger: v.string() },
  handler: async (ctx: any, args: any) => {
    const all = await ctx.db.query("emailAutomations").collect()
    return all.filter(
      (a: any) => a.status === "active" && a.trigger === args.trigger
    )
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    trigger: triggerValidator,
    steps: v.array(stepValidator),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("emailAutomations", {
      ...args,
      status: "draft",
      stats: emptyStats,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailAutomations"),
    name: v.optional(v.string()),
    trigger: v.optional(triggerValidator),
    steps: v.optional(v.array(stepValidator)),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}

export const activate = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() })
  },
}

export const pause = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() })
  },
}

// === INTERNAL ===

export const incrementStats = {
  args: {
    id: v.id("emailAutomations"),
    field: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("unsubscribed"),
      v.literal("converted")
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const automation = await ctx.db.get(args.id)
    if (!automation) return
    const delta = args.amount ?? 1
    await ctx.db.patch(args.id, {
      stats: {
        ...automation.stats,
        [args.field]: (automation.stats[args.field] ?? 0) + delta,
      },
      updatedAt: Date.now(),
    })
  },
}
