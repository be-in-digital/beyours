/**
 * Language management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"

// === QUERIES ===

/**
 * List all languages for a store
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * List active languages for a store (sorted by sortOrder)
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

/**
 * List all active languages across the entire instance (global)
 */
export const listAll = {
  args: {},
  handler: async (ctx: any) => {
    const all = await ctx.db.query("languages").collect()
    // Deduplicate by code, keep first occurrence (active preferred)
    const seen = new Set<string>()
    return all.filter((lang: any) => {
      if (!lang.isActive || seen.has(lang.code)) return false
      seen.add(lang.code)
      return true
    })
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

    return await ctx.db.insert("languages", {
      ...args,
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

    // Set the new default
    await ctx.db.patch(args.languageId, { isDefault: true, updatedAt: now })
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

    // Don't allow deletion of default language.
    //
    // `ConvexError` and in French, for two separate reasons. A plainly thrown
    // `Error` is redacted by Convex in production, so the owner saw
    // "Server Error" on a click that was refused for a perfectly good reason;
    // and the message reaches a French screen, where an English sentence is
    // the product speaking a language its user did not choose.
    if (language.isDefault) {
      throw new ConvexError({
        code: "language_is_default",
        message:
          "Cette langue est la langue par défaut de l'établissement. " +
          "Désignez-en une autre par défaut avant de la supprimer.",
      })
    }

    await ctx.db.delete(args.id)
  },
}
