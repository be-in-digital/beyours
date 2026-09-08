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
 *
 * `withIndex` on the platform, THEN a filter for the id. It was a bare
 * `.query().filter().first()` — the shape Convex charges the whole table for,
 * because `.filter()` is applied after the scan and `.first()` keeps pulling
 * until something matches, so a miss reads every row there is. That was
 * invisible until the read-counting double stopped counting matches and started
 * counting documents walked (#412 P3-F6), and this is the first live path it
 * caught: both platform webhooks resolve their store through here on every
 * delivery.
 *
 * `by_platform_enabled` is the index because `platform` is its first field;
 * nothing new is declared. The scan that remains is one platform's rows for one
 * deployment — a handful — instead of the table.
 */
export const getBySiteId = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    platformStoreId: v.string(),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo"; platformStoreId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q: any) => q.eq("platform", args.platform))
      .filter((q: any) => q.eq(q.field("platformStoreId"), args.platformStoreId))
      .first()
  },
}

/**
 * Get integration by brandId (for Deliveroo)
 *
 * Same shape and same fix as `getBySiteId` above.
 */
export const getByBrandId = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    brandId: v.string(),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo"; brandId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q: any) => q.eq("platform", args.platform))
      .filter((q: any) => q.eq(q.field("brandId"), args.brandId))
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
 * Toggle autoAccept on a store integration
 */
export const toggleAutoAccept = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    autoAccept: v.boolean(),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    autoAccept: boolean
  }) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    if (!existing) return null

    await ctx.db.patch(existing._id, {
      autoAccept: args.autoAccept,
      updatedAt: Date.now(),
    })
    return existing._id
  },
}

/**
 * Update orderMode on a store integration (per-platform override)
 */
export const updateOrderMode = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    orderMode: v.union(
      v.literal("auto_accept"),
      v.literal("auto_reject"),
      v.literal("manual")
    ),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    orderMode: "auto_accept" | "auto_reject" | "manual"
  }) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    if (!existing) return null

    await ctx.db.patch(existing._id, {
      orderMode: args.orderMode,
      updatedAt: Date.now(),
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
