/**
 * Translation management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"

// === QUERIES ===

/**
 * Get translations for a specific entity
 */
export const getForEntity = {
  args: {
    storeId: v.id("stores"),
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("translations")
      .withIndex("by_storeId_entity", (q: any) =>
        q.eq("storeId", args.storeId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .collect()
  },
}

/**
 * One page of a store's translations for a language.
 *
 * WHY IT PAGES RATHER THAN CAPS. This collected every translated field of every
 * product, category, menu, block and UI string the establishment has in that
 * language — one row per field per entity, so it grows with the catalogue and
 * again with every language added. A `.take()` would have been quieter and
 * worse: a truncated dictionary is missing translations, which the storefront
 * renders as untranslated text rather than as an error anybody notices. Paging
 * makes the caller say how much it wants and tells it when there is more.
 */
export const getByLanguage = {
  args: {
    storeId: v.id("stores"),
    languageCode: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("translations")
      .withIndex("by_storeId_language", (q: any) =>
        q.eq("storeId", args.storeId).eq("languageCode", args.languageCode)
      )
      .paginate(args.paginationOpts)
  },
}

/**
 * Get UI string overrides for a store, grouped by language code
 */
export const getUIOverrides = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("translations")
      .withIndex("by_storeId_entity", (q: any) =>
        q.eq("storeId", args.storeId).eq("entityType", "ui")
      )
      .collect()

    const result: Record<string, Record<string, string>> = {}
    for (const row of rows) {
      if (!result[row.languageCode]) {
        result[row.languageCode] = {}
      }
      const langOverrides = result[row.languageCode]!
      langOverrides[row.field] = row.value
    }
    return result
  },
}

// === MUTATIONS ===

/**
 * Upsert a translation (create or update)
 */
export const upsert = {
  args: {
    storeId: v.id("stores"),
    entityType: v.string(),
    entityId: v.string(),
    field: v.string(),
    languageCode: v.string(),
    value: v.string(),
    isAutoTranslated: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Check if translation already exists
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_storeId_entity", (q: any) =>
        q.eq("storeId", args.storeId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("field"), args.field),
          q.eq(q.field("languageCode"), args.languageCode)
        )
      )
      .unique()

    if (existing) {
      // Update existing translation
      await ctx.db.patch(existing._id, {
        value: args.value,
        isAutoTranslated: args.isAutoTranslated,
        updatedAt: now,
      })
      return existing._id
    } else {
      // Create new translation
      return await ctx.db.insert("translations", {
        ...args,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
}

/**
 * Bulk upsert translations
 */
export const bulkUpsert = {
  args: {
    translations: v.array(v.object({
      storeId: v.id("stores"),
      entityType: v.string(),
      entityId: v.string(),
      field: v.string(),
      languageCode: v.string(),
      value: v.string(),
      isAutoTranslated: v.boolean(),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const results = []

    for (const translation of args.translations) {
      // Check if translation already exists
      const existing = await ctx.db
        .query("translations")
        .withIndex("by_storeId_entity", (q: any) =>
          q.eq("storeId", translation.storeId)
            .eq("entityType", translation.entityType)
            .eq("entityId", translation.entityId)
        )
        .filter((q: any) =>
          q.and(
            q.eq(q.field("field"), translation.field),
            q.eq(q.field("languageCode"), translation.languageCode)
          )
        )
        .unique()

      if (existing) {
        // Update existing translation
        await ctx.db.patch(existing._id, {
          value: translation.value,
          isAutoTranslated: translation.isAutoTranslated,
          updatedAt: now,
        })
        results.push(existing._id)
      } else {
        // Create new translation
        const id = await ctx.db.insert("translations", {
          ...translation,
          createdAt: now,
          updatedAt: now,
        })
        results.push(id)
      }
    }

    return results
  },
}

/**
 * Delete a translation
 */
export const remove = {
  args: { id: v.id("translations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
