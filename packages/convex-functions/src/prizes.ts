import { v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("prizes").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: { storeId: v.id("stores"), name: v.string(), description: v.optional(v.string()), type: v.union(v.literal("discount_percentage"), v.literal("discount_fixed"), v.literal("free_product"), v.literal("free_menu"), v.literal("custom")), value: v.optional(v.number()), validityDays: v.number(), totalAvailable: v.optional(v.number()), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("prizes", { ...args, createdAt: now, updatedAt: now })
  },
}

export const update = {
  args: { id: v.id("prizes"), name: v.optional(v.string()), description: v.optional(v.string()), value: v.optional(v.number()), isActive: v.optional(v.boolean()) },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("prizes") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
