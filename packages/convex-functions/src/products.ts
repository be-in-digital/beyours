// NOTE: This file will be copied to the convex/ directory of each app
// Imports will be resolved by Convex

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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
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
      .withIndex("by_store_slug", (q) =>
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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.eq(q.field("isFeatured"), true))
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
    images: v.array(v.string()),
    stock: v.object({
      quantity: v.number(),
      trackInventory: v.boolean(),
      lowStockThreshold: v.optional(v.number()),
    }),
    options: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      type: v.union(v.literal("radio"), v.literal("checkbox")),
      required: v.boolean(),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        price: v.number(),
      })),
    }))),
    allergens: v.optional(v.array(v.string())),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("products", {
      ...args,
      externalIds: {},
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
    images: v.optional(v.array(v.string())),
    stock: v.optional(v.object({
      quantity: v.number(),
      trackInventory: v.boolean(),
      lowStockThreshold: v.optional(v.number()),
    })),
    options: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      type: v.union(v.literal("radio"), v.literal("checkbox")),
      required: v.boolean(),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        price: v.number(),
      })),
    }))),
    allergens: v.optional(v.array(v.string())),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
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
