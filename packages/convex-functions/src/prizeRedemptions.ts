import { v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores"), status: v.optional(v.union(v.literal("pending"), v.literal("claimed"), v.literal("redeemed"), v.literal("expired"), v.literal("cancelled"))) },
  handler: async (ctx: any, args: any) => {
    if (args.status) {
      return await ctx.db.query("prizeRedemptions").withIndex("by_storeId_status", (q: any) => q.eq("storeId", args.storeId).eq("status", args.status)).order("desc").collect()
    }
    return await ctx.db.query("prizeRedemptions").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).order("desc").collect()
  },
}

export const markRedeemed = {
  args: { id: v.id("prizeRedemptions"), redeemedBy: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const redemption = await ctx.db.get(args.id)
    if (!redemption) throw new Error("Redemption not found")
    if (redemption.status !== "claimed") throw new Error("Can only redeem prizes with 'claimed' status")
    await ctx.db.patch(args.id, {
      status: "redeemed",
      redeemedAt: Date.now(),
      redeemedBy: args.redeemedBy,
      updatedAt: Date.now(),
    })
  },
}

export const markExpired = {
  args: { id: v.id("prizeRedemptions") },
  handler: async (ctx: any, args: any) => {
    const redemption = await ctx.db.get(args.id)
    if (!redemption) throw new Error("Redemption not found")
    await ctx.db.patch(args.id, {
      status: "expired",
      updatedAt: Date.now(),
    })
  },
}
