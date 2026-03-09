import { v } from "convex/values"

export const list = {
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx: any, args: any) => {
    // Global: list all required actions (ignore storeId)
    return await ctx.db.query("requiredActions").collect()
  },
}

export const create = {
  args: {
    storeId: v.optional(v.id("stores")), // Legacy, ignored
    type: v.union(v.literal("google_review"), v.literal("instagram_follow"), v.literal("facebook_like"), v.literal("tiktok_follow"), v.literal("email_subscribe")),
    name: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    icon: v.optional(v.string()),
    isRequired: v.boolean(),
    sortOrder: v.number(),
    timerSeconds: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const { storeId: _storeId, ...rest } = args
    return await ctx.db.insert("requiredActions", { ...rest, createdAt: now, updatedAt: now })
  },
}

export const update = {
  args: {
    id: v.id("requiredActions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    icon: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    timerSeconds: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("requiredActions") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
