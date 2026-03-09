/**
 * Language management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * List all languages for a store
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const langs = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return langs.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  },
}

/**
 * List active languages for a store (public — used by storefront)
 */
export const listActive = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const all = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return all
      .filter((lang: any) => lang.isActive)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  },
}

// === MUTATIONS ===

/**
 * Create a new language
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    code: v.string(),
    name: v.string(),
    nativeName: v.string(),
    flagEmoji: v.optional(v.string()),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    isRtl: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // If this is set as default, unset all other defaults for this store
    if (args.isDefault) {
      const existingLanguages = await ctx.db
        .query("languages")
        .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
        .collect()

      for (const lang of existingLanguages) {
        if (lang.isDefault) {
          await ctx.db.patch(lang._id, { isDefault: false, updatedAt: now })
        }
      }
    }

    // Assign sortOrder: default language gets 0, others get next available
    const existingLanguages = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const maxOrder = existingLanguages.reduce(
      (max: number, l: any) => Math.max(max, l.sortOrder ?? 0),
      -1
    )
    const sortOrder = args.isDefault ? 0 : maxOrder + 1

    // If new language is default, bump all existing sortOrders
    if (args.isDefault) {
      for (const lang of existingLanguages) {
        await ctx.db.patch(lang._id, {
          sortOrder: (lang.sortOrder ?? 0) + 1,
          updatedAt: now,
        })
      }
    }

    return await ctx.db.insert("languages", {
      ...args,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update language
 */
export const update = {
  args: {
    id: v.id("languages"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    nativeName: v.optional(v.string()),
    flagEmoji: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isRtl: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Language not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Toggle language active status
 */
export const toggleActive = {
  args: { id: v.id("languages") },
  handler: async (ctx: any, args: any) => {
    const language = await ctx.db.get(args.id)
    if (!language) throw new Error("Language not found")

    await ctx.db.patch(args.id, {
      isActive: !language.isActive,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Set a language as default for the store
 */
export const setDefault = {
  args: {
    storeId: v.id("stores"),
    languageId: v.id("languages"),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Unset all defaults for this store
    const existingLanguages = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    for (const lang of existingLanguages) {
      if (lang.isDefault) {
        await ctx.db.patch(lang._id, { isDefault: false, updatedAt: now })
      }
    }

    // Set the new default and move it to position 0
    const newDefault = await ctx.db.get(args.languageId)
    if (!newDefault) throw new Error("Language not found")

    const oldOrder = newDefault.sortOrder ?? 0

    // Shift languages that were above the new default down
    for (const lang of existingLanguages) {
      if (lang._id !== args.languageId && (lang.sortOrder ?? 0) < oldOrder) {
        await ctx.db.patch(lang._id, {
          sortOrder: (lang.sortOrder ?? 0) + 1,
          updatedAt: now,
        })
      }
    }

    await ctx.db.patch(args.languageId, {
      isDefault: true,
      sortOrder: 0,
      updatedAt: now,
    })
  },
}

/**
 * Delete a language
 */
export const remove = {
  args: { id: v.id("languages") },
  handler: async (ctx: any, args: any) => {
    const language = await ctx.db.get(args.id)
    if (!language) throw new Error("Language not found")

    // Don't allow deletion of default language
    if (language.isDefault) {
      throw new Error("Cannot delete the default language")
    }

    await ctx.db.delete(args.id)
  },
}

/**
 * Reorder languages for a store.
 * Receives the full ordered list of language IDs.
 * The default language must remain at index 0.
 */
export const reorder = {
  args: {
    storeId: v.id("stores"),
    orderedIds: v.array(v.id("languages")),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Validate all language IDs belong to this store
    for (const langId of args.orderedIds) {
      const lang = await ctx.db.get(langId)
      if (!lang || lang.storeId !== args.storeId) {
        throw new Error("Invalid language ID: does not belong to this store")
      }
    }

    // Validate: default language must be first
    if (args.orderedIds.length > 0) {
      const first = await ctx.db.get(args.orderedIds[0])
      if (!first || !first.isDefault) {
        throw new Error("La langue par défaut doit rester en première position")
      }
    }

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], {
        sortOrder: i,
        updatedAt: now,
      })
    }
  },
}
