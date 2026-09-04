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
    // `scannedCount` is required by the schema and never comes from the caller:
    // it is the scan counter this row will accumulate. Without it every insert
    // was rejected by the validator, so no QR code could be created and nobody
    // could ever play.
    return await ctx.db.insert("gameQRCodes", { ...args, scannedCount: 0, createdAt: now, updatedAt: now })
  },
}

export const remove = {
  args: { id: v.id("gameQRCodes") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
