/**
 * Orphan products management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

/**
 * List orphan products for a store and platform
 */
export const listByStorePlatform = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { storeId: string; platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("orphanProducts")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .collect()
  },
}

/**
 * List pending orphan products for a store
 */
export const listPending = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: { storeId: string }) => {
    return await ctx.db
      .query("orphanProducts")
      .withIndex("by_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "pending")
      )
      .collect()
  },
}

/**
 * Create an orphan product
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    externalId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    imageUrl: v.optional(v.string()),
    rawData: v.string(),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    externalId: string
    name: string
    description?: string
    price: number
    imageUrl?: string
    rawData: string
  }) => {
    const now = Date.now()
    return await ctx.db.insert("orphanProducts", {
      ...args,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Match an orphan product to an internal product
 */
export const match = {
  args: {
    id: v.id("orphanProducts"),
    matchedProductId: v.id("products"),
  },
  handler: async (ctx: any, args: { id: string; matchedProductId: string }) => {
    await ctx.db.patch(args.id, {
      status: "matched" as const,
      matchedProductId: args.matchedProductId,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Ignore an orphan product
 */
export const ignore = {
  args: { id: v.id("orphanProducts") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.patch(args.id, {
      status: "ignored" as const,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Delete an orphan product
 */
export const remove = {
  args: { id: v.id("orphanProducts") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.delete(args.id)
  },
}
