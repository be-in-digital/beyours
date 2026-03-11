import { v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("gameQRCodes").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: { storeId: v.id("stores"), code: v.string(), tableNumber: v.optional(v.string()), location: v.optional(v.string()), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("gameQRCodes", { ...args, createdAt: now, updatedAt: now })
  },
}

export const remove = {
  args: { id: v.id("gameQRCodes") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
