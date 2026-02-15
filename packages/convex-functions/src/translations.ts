// NOTE: This file will be copied to the convex/ directory of each app
// Imports will be resolved by Convex

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// === QUERIES ===

/**
 * Get translations for a specific entity
 */
export const getForEntity = query({
  args: {
    storeId: v.id("stores"),
    entityType: v.union(
      v.literal("product"),
      v.literal("category"),
      v.literal("page"),
      v.literal("menu"),
      v.literal("option")
    ),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("translations")
      .withIndex("by_entity", (q) =>
        q.eq("storeId", args.storeId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .collect()
  },
})

/**
 * Get all translations for a specific language
 */
export const getByLanguage = query({
  args: {
    storeId: v.id("stores"),
    languageCode: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("translations")
      .withIndex("by_language", (q) =>
        q.eq("storeId", args.storeId).eq("languageCode", args.languageCode)
      )
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Upsert a translation (create or update)
 */
export const upsert = mutation({
  args: {
    storeId: v.id("stores"),
    entityType: v.union(
      v.literal("product"),
      v.literal("category"),
      v.literal("page"),
      v.literal("menu"),
      v.literal("option")
    ),
    entityId: v.string(),
    field: v.string(),
    languageCode: v.string(),
    value: v.string(),
    isAutoTranslated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Check if translation already exists
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_entity", (q) =>
        q.eq("storeId", args.storeId)
          .eq("entityType", args.entityType)
          .eq("entityId", args.entityId)
      )
      .filter((q) =>
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
})

/**
 * Bulk upsert translations
 */
export const bulkUpsert = mutation({
  args: {
    translations: v.array(v.object({
      storeId: v.id("stores"),
      entityType: v.union(
        v.literal("product"),
        v.literal("category"),
        v.literal("page"),
        v.literal("menu"),
        v.literal("option")
      ),
      entityId: v.string(),
      field: v.string(),
      languageCode: v.string(),
      value: v.string(),
      isAutoTranslated: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const results = []

    for (const translation of args.translations) {
      // Check if translation already exists
      const existing = await ctx.db
        .query("translations")
        .withIndex("by_entity", (q) =>
          q.eq("storeId", translation.storeId)
            .eq("entityType", translation.entityType)
            .eq("entityId", translation.entityId)
        )
        .filter((q) =>
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
})

/**
 * Delete a translation
 */
export const remove = mutation({
  args: { id: v.id("translations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
