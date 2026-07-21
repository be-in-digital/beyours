import { v } from "convex/values"

/**
 * Required social actions before playing (admin CRUD).
 * The public read path lives in gamePlay.getSession.
 */

const actionType = v.union(
  v.literal("google_review"),
  v.literal("instagram_follow"),
  v.literal("facebook_like"),
  v.literal("tiktok_follow"),
  v.literal("email_subscribe")
)

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const actions = await ctx.db
      .query("requiredActions")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return actions.sort((a: any, b: any) => a.sortOrder - b.sortOrder)
  },
}

export const create = {
  args: {
    storeId: v.id("stores"),
    type: actionType,
    name: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    isRequired: v.boolean(),
    timerSeconds: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("requiredActions")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    const maxOrder = existing.reduce((max: number, a: any) => Math.max(max, a.sortOrder), -1)
    const now = Date.now()
    return await ctx.db.insert("requiredActions", {
      ...args,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("requiredActions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    timerSeconds: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("requiredActions") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
