/**
 * Product management functions
 *
 * NOTE: Originated from packages/convex-functions/src/products.ts
 * Imports are resolved by Convex in the app's convex/ directory
 */

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// === QUERIES ===

/**
 * List all products for a store
 */
export const list = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .collect()
  },
})

/**
 * Get product by ID
 */
export const getById = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

/**
 * Get products by category
 */
export const getByCategory = query({
  args: {
    storeId: v.id("stores"),
    categoryId: v.id("categories")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_categoryId", (q) =>
        q.eq("storeId", args.storeId).eq("categoryId", args.categoryId)
      )
      .collect()
  },
})

/**
 * Get product by slug
 */
export const getBySlug = query({
  args: {
    storeId: v.id("stores"),
    slug: v.string()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_slug", (q) =>
        q.eq("storeId", args.storeId).eq("slug", args.slug)
      )
      .unique()
  },
})

/**
 * Get featured products
 */
export const getFeatured = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_isFeatured", (q) =>
        q.eq("storeId", args.storeId).eq("isFeatured", true)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Create a new product
 */
export const create = mutation({
  args: {
    storeId: v.id("stores"),
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    compareAtPrice: v.optional(v.number()),
    taxRate: v.number(),
    preparationTime: v.optional(v.number()),
    sku: v.optional(v.string()),
    images: v.array(v.string()),
    options: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      required: v.boolean(),
      maxSelections: v.optional(v.number()),
      externalIds: v.optional(v.object({
        uberEatsId: v.optional(v.string()),
        deliverooId: v.optional(v.string()),
      })),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        priceModifier: v.number(),
        externalIds: v.optional(v.object({
          uberEatsId: v.optional(v.string()),
          deliverooId: v.optional(v.string()),
        })),
      })),
    }))),
    allergens: v.optional(v.array(v.string())),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
      fiber: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
    stock: v.optional(v.object({
      tracked: v.boolean(),
      quantity: v.number(),
      lowStockThreshold: v.number(),
    })),
    scheduling: v.optional(v.object({
      availableFrom: v.optional(v.string()),
      availableUntil: v.optional(v.string()),
      availableDays: v.optional(v.array(v.number())),
    })),
    spiceLevel: v.optional(v.number()),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("products", {
      ...args,
      source: args.source ?? "manual",
      options: args.options ?? [],
      allergens: args.allergens ?? [],
      tags: args.tags ?? [],
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update product
 */
export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    compareAtPrice: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    preparationTime: v.optional(v.number()),
    sku: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    options: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      required: v.boolean(),
      maxSelections: v.optional(v.number()),
      externalIds: v.optional(v.object({
        uberEatsId: v.optional(v.string()),
        deliverooId: v.optional(v.string()),
      })),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        priceModifier: v.number(),
        externalIds: v.optional(v.object({
          uberEatsId: v.optional(v.string()),
          deliverooId: v.optional(v.string()),
        })),
      })),
    }))),
    allergens: v.optional(v.array(v.string())),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
      fiber: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
    stock: v.optional(v.object({
      tracked: v.boolean(),
      quantity: v.number(),
      lowStockThreshold: v.number(),
    })),
    scheduling: v.optional(v.object({
      availableFrom: v.optional(v.string()),
      availableUntil: v.optional(v.string()),
      availableDays: v.optional(v.array(v.number())),
    })),
    spiceLevel: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Product not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

/**
 * Update product stock quantity
 */
export const updateStock = mutation({
  args: {
    id: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")
    if (!product.stock) throw new Error("Product does not track stock")

    await ctx.db.patch(args.id, {
      stock: {
        ...product.stock,
        quantity: args.quantity,
      },
      updatedAt: Date.now(),
    })
  },
})

/**
 * Toggle product active status
 */
export const toggleStatus = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")

    await ctx.db.patch(args.id, {
      isActive: !product.isActive,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete a product
 */
export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
