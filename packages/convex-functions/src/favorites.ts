/**
 * Favorites management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

/**
 * List all favorites for a user
 */
export const listByUser = {
  args: { userId: v.string() },
  handler: async (ctx: any, args: { userId: string }) => {
    return await ctx.db
      .query("favorites")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect()
  },
}

/**
 * List favorites for a user in a specific store
 */
export const listByUserAndStore = {
  args: {
    userId: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx: any, args: { userId: string; storeId: string }) => {
    return await ctx.db
      .query("favorites")
      .withIndex("by_userId_storeId", (q: any) =>
        q.eq("userId", args.userId).eq("storeId", args.storeId)
      )
      .collect()
  },
}

/**
 * Toggle a favorite (add if not exists, remove if exists)
 */
export const toggle = {
  args: {
    userId: v.string(),
    productId: v.id("products"),
    storeId: v.id("stores"),
  },
  handler: async (ctx: any, args: { userId: string; productId: string; storeId: string }) => {
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_userId_productId_storeId", (q: any) =>
        q
          .eq("userId", args.userId)
          .eq("productId", args.productId)
          .eq("storeId", args.storeId)
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { action: "removed" as const }
    }

    await ctx.db.insert("favorites", {
      userId: args.userId,
      productId: args.productId,
      storeId: args.storeId,
      createdAt: Date.now(),
    })
    return { action: "added" as const }
  },
}

/**
 * Remove all favorites for a user
 */
export const clearAll = {
  args: { userId: v.string() },
  handler: async (ctx: any, args: { userId: string }) => {
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect()

    for (const fav of favorites) {
      await ctx.db.delete(fav._id)
    }

    return { removed: favorites.length }
  },
}
