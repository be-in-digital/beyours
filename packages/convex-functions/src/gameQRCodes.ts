import { v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("gameQRCodes").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: {
    storeId: v.id("stores"),
    code: v.string(),
    gameType: v.optional(v.union(v.literal("wheel"), v.literal("scratch_card"))),
    tableNumber: v.optional(v.string()),
    location: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("gameQRCodes", { ...args, scannedCount: 0, createdAt: now, updatedAt: now })
  },
}

export const update = {
  args: {
    id: v.id("gameQRCodes"),
    gameType: v.optional(v.union(v.literal("wheel"), v.literal("scratch_card"))),
    tableNumber: v.optional(v.string()),
    location: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("gameQRCodes") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
