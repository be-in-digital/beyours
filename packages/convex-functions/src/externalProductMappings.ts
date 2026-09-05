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
 *
 * This is the lookup that turns a PLU on an incoming platform order into a dish
 * we can cook, and the answer has to mean that. It used to return the row
 * without ever dereferencing `internalProductId`, so a mapping left behind by a
 * deleted product was still truthy: `deliverooWebhook` counted zero unmatched
 * PLUs and answered `sendSyncStatus(..., "succeeded")` for an order containing a
 * dish the kitchen no longer has.
 *
 * `products.remove` now deletes the mapping, so that particular row can no
 * longer be created. The dereference stays because the guarantee belongs here:
 * every other way a product can leave the table — a store cascade, a restore, a
 * hand-run mutation — arrives at this same query, and "we have a mapping" must
 * never outlive "we have the dish".
 *
 * `getByInternal` is deliberately not given the same treatment: it is keyed on a
 * product id the caller already holds, so it cannot manufacture a match for a
 * product nobody asked about.
 *
 * It is also scoped to the establishment the order belongs to. A PLU is unique
 * inside one restaurant, not across a deployment, and the lookup used to span
 * every restaurant on it: an order for one establishment whose PLU happened to
 * be mapped in ANOTHER was answered as producible by a kitchen that has never
 * heard of the dish. The same span made `.unique()` throw the moment two
 * establishments used the same PLU string — which is exactly what a chain
 * running one menu across its locations does — and the caller counts a throw as
 * an unmatched item, so a correct multi-store deployment refused its own
 * orders.
 */
export const getByExternal = {
  args: {
    storeId: v.id("stores"),
    externalId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (
    ctx: any,
    args: { storeId: string; externalId: string; platform: "uberEats" | "deliveroo" }
  ) => {
    const mapping = await ctx.db
      .query("externalProductMappings")
      .withIndex("by_store_platform_external", (q: any) =>
        q
          .eq("storeId", args.storeId)
          .eq("platform", args.platform)
          .eq("externalId", args.externalId)
      )
      .unique()

    if (!mapping) return null

    const product = await ctx.db.get(mapping.internalProductId)
    if (!product) return null

    return mapping
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
