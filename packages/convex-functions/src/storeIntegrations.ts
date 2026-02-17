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
  handler: async (ctx: any, args: { storeId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * List all enabled integrations for a given platform
 * Uses the by_platform_enabled index for efficient lookup
 */
export const listByPlatformEnabled = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q: any) =>
        q.eq("platform", args.platform).eq("enabled", true)
      )
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
  handler: async (ctx: any, args: { storeId: string; platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()
  },
}

/**
 * Get integration by platformStoreId (site_id for Deliveroo)
 */
export const getBySiteId = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    platformStoreId: v.string(),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo"; platformStoreId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("platform"), args.platform),
          q.eq(q.field("platformStoreId"), args.platformStoreId)
        )
      )
      .first()
  },
}

/**
 * Get integration by brandId (for Deliveroo)
 */
export const getByBrandId = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    brandId: v.string(),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo"; brandId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("platform"), args.platform),
          q.eq(q.field("brandId"), args.brandId)
        )
      )
      .first()
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
    storeStatus: v.optional(v.union(
      v.literal("ONLINE"),
      v.literal("PAUSED"),
      v.literal("OFFLINE")
    )),
    prepTime: v.optional(v.number()),
    brandId: v.optional(v.string()),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    platformStoreId: string
    syncMenu: boolean
    autoAccept: boolean
    enabled: boolean
    storeStatus?: "ONLINE" | "PAUSED" | "OFFLINE"
    prepTime?: number
    brandId?: string
  }) => {
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
        storeStatus: args.storeStatus,
        prepTime: args.prepTime,
        brandId: args.brandId,
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert("storeIntegrations", {
      ...args,
      lastSyncAt: undefined,
      lastMenuSyncAt: undefined,
      menuSyncStatus: "idle" as const,
      menuSyncError: undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update menu sync status
 */
export const updateMenuSyncStatus = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    menuSyncStatus: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("success"),
      v.literal("error")
    ),
    menuSyncError: v.optional(v.string()),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    menuSyncStatus: "idle" | "syncing" | "success" | "error"
    menuSyncError?: string
  }) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    if (!existing) return null

    const now = Date.now()
    await ctx.db.patch(existing._id, {
      menuSyncStatus: args.menuSyncStatus,
      menuSyncError: args.menuSyncError,
      lastMenuSyncAt: args.menuSyncStatus === "success" ? now : existing.lastMenuSyncAt,
      updatedAt: now,
    })
    return existing._id
  },
}

/**
 * Delete a store integration
 */
export const remove = {
  args: { id: v.id("storeIntegrations") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.delete(args.id)
  },
}
