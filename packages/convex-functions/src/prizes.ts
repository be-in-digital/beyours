import { v } from "convex/values"

export const list = {
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx: any, _args: any) => {
    // Global: list all prizes
    return await ctx.db.query("prizes").collect()
  },
}

export const create = {
  args: {
    storeId: v.optional(v.id("stores")), // Legacy, ignored
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("discount_percentage"), v.literal("discount_fixed"), v.literal("free_product"), v.literal("free_menu"), v.literal("custom")),
    value: v.optional(v.number()),
    validityDays: v.number(),
    totalAvailable: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const { storeId: _storeId, ...rest } = args
    return await ctx.db.insert("prizes", { ...rest, createdAt: now, updatedAt: now })
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
