// NOTE: This file will be copied to the convex/ directory of each app
// Imports will be resolved by Convex

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// === QUERIES ===

/**
 * List all languages for a store
 */
export const list = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("languages")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Create a new language
 */
export const create = mutation({
  args: {
    storeId: v.id("stores"),
    code: v.string(),
    name: v.string(),
    nativeName: v.string(),
    isDefault: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // If this is set as default, unset all other defaults for this store
    if (args.isDefault) {
      const existingLanguages = await ctx.db
        .query("languages")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
        .collect()

      for (const lang of existingLanguages) {
        if (lang.isDefault) {
          await ctx.db.patch(lang._id, { isDefault: false, updatedAt: now })
        }
      }
    }

    return await ctx.db.insert("languages", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update language
 */
export const update = mutation({
  args: {
    id: v.id("languages"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    nativeName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Language not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

/**
 * Toggle language active status
 */
export const toggleActive = mutation({
  args: { id: v.id("languages") },
  handler: async (ctx, args) => {
    const language = await ctx.db.get(args.id)
    if (!language) throw new Error("Language not found")

    await ctx.db.patch(args.id, {
      isActive: !language.isActive,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Set a language as default for the store
 */
export const setDefault = mutation({
  args: {
    storeId: v.id("stores"),
    languageId: v.id("languages"),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Unset all defaults for this store
    const existingLanguages = await ctx.db
      .query("languages")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect()

    for (const lang of existingLanguages) {
      if (lang.isDefault) {
        await ctx.db.patch(lang._id, { isDefault: false, updatedAt: now })
      }
    }

    // Set the new default
    await ctx.db.patch(args.languageId, { isDefault: true, updatedAt: now })
  },
})

/**
 * Delete a language
 */
export const remove = mutation({
  args: { id: v.id("languages") },
  handler: async (ctx, args) => {
    const language = await ctx.db.get(args.id)
    if (!language) throw new Error("Language not found")

    // Don't allow deletion of default language
    if (language.isDefault) {
      throw new Error("Cannot delete the default language")
    }

    await ctx.db.delete(args.id)
  },
})
