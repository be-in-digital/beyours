/**
 * Store integrations management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * List integrations for a store
 */
export const listByStore = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * Get integration for a store + platform
 */
export const getByStorePlatform = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()
  },
}

// === MUTATIONS ===

/**
 * Create or update a store integration
 */
export const upsert = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    platformStoreId: v.string(),
    syncMenu: v.boolean(),
    autoAccept: v.boolean(),
    enabled: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        platformStoreId: args.platformStoreId,
        syncMenu: args.syncMenu,
        autoAccept: args.autoAccept,
        enabled: args.enabled,
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert("storeIntegrations", {
      ...args,
      lastSyncAt: undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Delete a store integration
 */
export const remove = {
  args: { id: v.id("storeIntegrations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
