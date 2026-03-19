/**
 * Contact messages functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

export const list = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(v.union(v.literal("new"), v.literal("read"), v.literal("archived"))),
  },
  handler: async (ctx: any, args: any) => {
    if (args.status) {
      return await ctx.db
        .query("contactMessages")
        .withIndex("by_storeId_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .order("desc")
        .collect()
    }
    return await ctx.db
      .query("contactMessages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("contactMessages", {
      storeId: args.storeId,
      name: args.name,
      email: args.email.toLowerCase(),
      phone: args.phone,
      subject: args.subject,
      message: args.message,
      status: "new",
      createdAt: Date.now(),
    })
  },
}

export const updateStatus = {
  args: {
    id: v.id("contactMessages"),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("archived")),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.patch(args.id, { status: args.status })
  },
}
