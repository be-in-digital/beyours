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
 * How many `translations` rows one pass may delete.
 *
 * Same shape and the same reason as `MENU_TRANSLATION_BATCH`: a transaction has
 * a document ceiling, and an establishment that added a language and ran the
 * bulk translator has one row per product, per category, per menu and per CMS
 * field in it. A catalogue of four hundred dishes is already four hundred rows
 * for that one language.
 */
export const LANGUAGE_TRANSLATION_BATCH = 500

export interface LanguagePurgeResult {
  deleted: number
  hasMore: boolean
}

/**
 * Delete one batch of a language's translations.
 *
 * `take(budget + 1)`: the extra row is how the caller learns there is more to
 * do without paying for a count.
 */
async function deleteLanguageTranslationBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown,
  languageCode: string,
  budget: number = LANGUAGE_TRANSLATION_BATCH
): Promise<LanguagePurgeResult> {
  const rows = await ctx.db
    .query("translations")
    .withIndex("by_storeId_language", (q: any) =>
      q.eq("storeId", storeId).eq("languageCode", languageCode)
    )
    .take(budget + 1)

  const hasMore = rows.length > budget
  const batch = hasMore ? rows.slice(0, budget) : rows
  for (const row of batch) {
    await ctx.db.delete(row._id)
  }
  return { deleted: batch.length, hasMore }
}

/**
 * The rest of the sweep, one batch per run. Internal only: it takes a language
 * CODE rather than an id, because the language row went in the first pass.
 */
export const purgeTranslations = {
  args: { storeId: v.id("stores"), languageCode: v.string() },
  handler: async (ctx: any, args: any): Promise<LanguagePurgeResult> =>
    deleteLanguageTranslationBatch(ctx, args.storeId, args.languageCode),
}

/**
 * Delete a language, and the translations that only ever described it.
 *
 * WHAT WENT WRONG (#432.6). A bare `ctx.db.delete(args.id)`, leaving every
 * `translations` row for that language behind — the product names, the category
 * names, the menu descriptions and the CMS fields the owner had translated or
 * the bulk translator had written.
 *
 * Invisible to every validator, and this is why: `translations.languageCode` is
 * a `v.string()`, not a `v.id("languages")`. A language is identified by its BCP
 * 47 code throughout the product, so the schema cannot see that the column is a
 * foreign key and nothing has ever complained about an orphan.
 *
 * And then the consequence, which is the part that reaches a diner: re-adding
 * the same language **resurrects the stale rows**. An owner who removes German,
 * spends a month rewriting the carte, and adds German back gets last month's
 * German on the storefront — silently, because there is no state in which the
 * product could tell that those rows are older than the text they translate.
 *
 * CASCADED, not refused. The rows describe entities in a language the
 * establishment no longer offers; they are of no use to anything else, which is
 * the same test `menus.remove` applies to its own translations. Refusing would
 * ask the owner to delete four hundred rows they cannot see from a screen that
 * does not list them.
 *
 * Batched, with the first batch inside this transaction and the rest drained by
 * the app wrapper — the shape `menus.remove` already uses, for the same ceiling.
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

    /* The language row goes first, so the storefront stops offering it even if
       the drain below is interrupted. A language with half its translations gone
       is a worse screen than one that is simply no longer offered. */
    const { storeId, code } = language
    await ctx.db.delete(args.id)

    return {
      ...(await deleteLanguageTranslationBatch(ctx, storeId, code)),
      storeId,
      languageCode: code as string,
    }
  },
}
