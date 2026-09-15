/**
 * Translation management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { clampPagination } from "./pagination"

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
      .paginate(clampPagination(args.paginationOpts))
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
/*
 * `bulkUpsert` USED TO BE HERE (#524).
 *
 * It took an array whose every element carried its own `storeId`, which is a
 * shape `authorize()` cannot gate: a store-scoped guard reads ONE establishment
 * off the arguments, and this asked for as many as the caller cared to send.
 * So it could never be wrapped as written, and no app ever wrapped it.
 *
 * Deleted rather than rewritten, because there is nothing to call it. The
 * catalogue's bulk translation goes through `autoTranslate`, and UI strings are
 * translated one at a time through the admin's « Traductions UI » tab
 * (`translations.upsert`) — see CLAUDE.md § i18n, which records that the one
 * bulk UI-string translator this product had was deleted for having no callers
 * and a docblock claiming otherwise.
 *
 * If a bulk path is ever wanted, the shape is `storeId` as a top-level argument
 * and the rows beneath it, so one `authorize()` covers the whole batch.
 */

/**
 * Delete a translation
 */
export const remove = {
  args: { id: v.id("translations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
