/**
 * External product mappings management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

/**
 * List mappings for a store and platform
 */
export const listByStorePlatform = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { storeId: string; platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("externalProductMappings")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .collect()
  },
}

/**
 * Get mapping by internal product ID and platform
 */
export const getByInternal = {
  args: {
    internalProductId: v.id("products"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { internalProductId: string; platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("externalProductMappings")
      .withIndex("by_internal", (q: any) =>
        q.eq("internalProductId", args.internalProductId).eq("platform", args.platform)
      )
      .unique()
  },
}

/**
 * Get mapping by external ID and platform
 */
export const getByExternal = {
  args: {
    externalId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { externalId: string; platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("externalProductMappings")
      .withIndex("by_external", (q: any) =>
        q.eq("platform", args.platform).eq("externalId", args.externalId)
      )
      .unique()
  },
}

/**
 * Create or update a mapping
 */
export const upsert = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    internalProductId: v.id("products"),
    externalId: v.string(),
    externalName: v.optional(v.string()),
    externalPrice: v.optional(v.number()),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    internalProductId: string
    externalId: string
    externalName?: string
    externalPrice?: number
  }) => {
    // The caller proved rights over `args.storeId`, and the lookup below keys
    // on the product alone. Product ids are public — `products.list` is the
    // storefront — so a mapping in another restaurant could be overwritten by
    // naming its product and one's own store: their dish then points at the
    // caller's Uber Eats item, and every order for it lands in the wrong
    // kitchen. The tenancy of both ends is checked before anything is written.
    const product = await ctx.db.get(args.internalProductId)
    if (!product) throw new Error("Product not found")
    if (product.storeId !== args.storeId) {
      throw new Error("Product belongs to another store")
    }

    const existing = await ctx.db
      .query("externalProductMappings")
      .withIndex("by_internal", (q: any) =>
        q.eq("internalProductId", args.internalProductId).eq("platform", args.platform)
      )
      .unique()

    if (existing && existing.storeId !== args.storeId) {
      throw new Error("Mapping belongs to another store")
    }

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        externalId: args.externalId,
        externalName: args.externalName,
        externalPrice: args.externalPrice,
        lastSyncAt: now,
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert("externalProductMappings", {
      ...args,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Delete a mapping
 */
export const remove = {
  args: { id: v.id("externalProductMappings") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.delete(args.id)
  },
}

/**
 * Delete all mappings for a store + platform
 */
export const removeAllByStorePlatform = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { storeId: string; platform: "uberEats" | "deliveroo" }) => {
    const mappings = await ctx.db
      .query("externalProductMappings")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .collect()

    for (const mapping of mappings) {
      await ctx.db.delete(mapping._id)
    }
    return mappings.length
  },
}
