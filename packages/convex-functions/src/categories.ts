/**
 * Category management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * List all categories for a store, ordered by sortOrder
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("asc")
      .collect()
      .then((categories: any) =>
        categories.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      )
  },
}

/**
 * Get category by ID
 */
export const getById = {
  args: { id: v.id("categories") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

// === MUTATIONS ===

/**
 * Create a new category
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("categories", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update category
 */
export const update = {
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Category not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Reorder categories
 */
export const reorder = {
  args: {
    ids: v.array(v.id("categories")),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Update sortOrder for each category based on position in array
    for (let i = 0; i < args.ids.length; i++) {
      await ctx.db.patch(args.ids[i]!, {
        sortOrder: i,
        updatedAt: now,
      })
    }
  },
}

/**
 * Delete a category
 */
export const remove = {
  args: { id: v.id("categories") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
