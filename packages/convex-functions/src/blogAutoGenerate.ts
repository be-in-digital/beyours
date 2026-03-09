/**
 * Blog Auto Generate Functions (Package Layer)
 *
 * Pure logic — no auth, no Convex wrappers (internalQuery etc.).
 * Exports defs/helpers consumed by app-layer wrappers.
 */

import { v } from "convex/values"
import { getCurrentPeriodKey } from "./blogAutoUsage"
import { createArticleCore } from "./blog"
import { generateSlug } from "./helpers"

// ============================================================================
// Validators
// ============================================================================

/** Args for the public generateArticle action (without ownerId) */
export const generateArticleArgs = {
  storeId: v.id("stores"),
  topic: v.string(),
  tone: v.union(
    v.literal("formel"),
    v.literal("decontracte"),
    v.literal("storytelling")
  ),
  locale: v.string(),
  categoryId: v.id("blogCategories"),
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Increment blogAutoUsage for the current month.
 * Upserts the usage record (creates if first generation this month).
 */
export async function incrementUsageCore(
  ctx: any,
  ownerId: string,
): Promise<void> {
  const periodKey = getCurrentPeriodKey()
  const now = Date.now()

  const existing = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      generatedCount: existing.generatedCount + 1,
      updatedAt: now,
    })
  } else {
    await ctx.db.insert("blogAutoUsage", {
      ownerId,
      periodKey,
      generatedCount: 1,
      publishedCount: 0,
      updatedAt: now,
    })
  }
}

/**
 * Increment image generation usage for the current month.
 * Upserts the usage record (creates if first generation this month).
 */
export async function incrementImageUsageCore(
  ctx: any,
  ownerId: string,
): Promise<void> {
  const periodKey = getCurrentPeriodKey()
  const now = Date.now()

  const existing = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      imageGeneratedCount: (existing.imageGeneratedCount ?? 0) + 1,
      updatedAt: now,
    })
  } else {
    await ctx.db.insert("blogAutoUsage", {
      ownerId,
      periodKey,
      generatedCount: 0,
      publishedCount: 0,
      imageGeneratedCount: 1,
      updatedAt: now,
    })
  }
}

/**
 * Get store and category context for the AI prompt.
 */
export async function getGenerationContextCore(
  ctx: any,
  args: { storeId: string; categoryId: string },
): Promise<{ storeName: string; categoryName: string }> {
  const store = await ctx.db.get(args.storeId)
  const storeName = store?.name ?? "Restaurant"

  const category = await ctx.db.get(args.categoryId)
  const categoryName = category?.name ?? "General"

  return { storeName, categoryName }
}

/**
 * Save a generated article as a draft.
 * Creates the article record, patches draftContent with generated HTML,
 * and increments usage.
 */
export async function saveGeneratedArticleCore(
  ctx: any,
  args: {
    storeId: string
    ownerId: string
    title: string
    excerpt: string
    content: string
    categoryId: string
    authorId: string
    coverImageId?: string
    coverImageAlt?: string
    metaTitle?: string
    metaDescription?: string
    tags?: string[]
  },
): Promise<string> {
  // Create article (empty draft)
  const articleId = await createArticleCore(ctx, {
    storeId: args.storeId,
    title: args.title,
    categoryId: args.categoryId,
    authorId: args.authorId,
  })

  // Patch draftContent with generated content
  const slug = generateSlug(args.title)
  const now = Date.now()

  const draftContent: Record<string, unknown> = {
    title: args.title,
    slug,
    excerpt: args.excerpt,
    content: args.content,
    updatedAt: now,
  }

  if (args.coverImageId) draftContent.coverImageId = args.coverImageId
  if (args.coverImageAlt) draftContent.coverImageAlt = args.coverImageAlt
  if (args.metaTitle) draftContent.metaTitle = args.metaTitle
  if (args.metaDescription) draftContent.metaDescription = args.metaDescription

  await ctx.db.patch(articleId, {
    draftContent,
    draftSlug: slug,
    updatedAt: now,
  })

  // Create/find tags and attach them
  if (args.tags && args.tags.length > 0) {
    const tagIds: string[] = []
    for (const tagName of args.tags) {
      const tagSlug = generateSlug(tagName)
      // Find existing tag by slug
      const existing = await ctx.db
        .query("blogTags")
        .withIndex("by_storeId_slug", (q: any) =>
          q.eq("storeId", args.storeId).eq("slug", tagSlug),
        )
        .unique()

      const tagId = existing
        ? existing._id
        : await ctx.db.insert("blogTags", {
            storeId: args.storeId,
            name: tagName,
            slug: tagSlug,
            createdAt: now,
          })

      tagIds.push(tagId)
    }

    // Attach tags to article as draft tags
    for (const tagId of tagIds) {
      await ctx.db.insert("blogArticleTags", {
        storeId: args.storeId,
        articleId,
        tagId,
        isDraft: true,
      })
    }
  }

  // Increment usage
  await incrementUsageCore(ctx, args.ownerId)

  return articleId
}
