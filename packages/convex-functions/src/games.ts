import { v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("games").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: { storeId: v.id("stores"), type: v.union(v.literal("wheel"), v.literal("scratch_card")), name: v.string(), description: v.optional(v.string()), winRatio: v.number(), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("games", { ...args, createdAt: now, updatedAt: now })
  },
}

export const updateWinRatio = {
  args: { id: v.id("games"), winRatio: v.number() },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, { winRatio: args.winRatio, updatedAt: Date.now() })
  },
}

export const update = {
  args: { id: v.id("games"), name: v.optional(v.string()), description: v.optional(v.string()), isActive: v.optional(v.boolean()), winRatio: v.optional(v.number()) },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("games") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
