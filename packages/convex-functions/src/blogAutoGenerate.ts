/**
 * Blog Auto Generate Functions (Package Layer)
 *
 * Pure logic — no auth, no Convex wrappers (internalQuery etc.).
 * Exports defs/helpers consumed by app-layer wrappers.
 */

import { v } from "convex/values"
import { getCurrentPeriodKey } from "./blogAutoUsage"
import { createArticleCore } from "./blog"
import { publishArticleCore } from "./blogPublish"
import { generateSlug } from "./helpers"
import { sanitizeArticleHtml } from "./htmlSanitize"

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
    /**
     * What the owner configured and their plan allows. The caller resolves
     * both — this function is not the place to read entitlements — and passes
     * the answer. Anything other than "auto_publish" leaves a draft.
     */
    approvalMode?: "draft_review" | "auto_publish"
  },
): Promise<{ articleId: string; status: "draft" | "published" }> {
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
    content: sanitizeArticleHtml(args.content),
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

  // The quota is reserved before the first paid call, not here: incrementing
  // after the fact is what let ten concurrent requests past a quota of two.
  // See `reserveArticleQuota` in blogAutoGuards.

  // Publish only where the plan allows it AND the draft is complete. An
  // article the model produced without a cover image cannot pass
  // `publishArticleCore`'s validation, and failing the whole generation over
  // it would throw away work the owner has already paid for — so it stays a
  // draft they can finish.
  if (args.approvalMode === "auto_publish") {
    try {
      await publishArticleCore(ctx, articleId, args.authorId)
      return { articleId, status: "published" }
    } catch (error) {
      console.warn(
        `[autoBlog] auto-publish refused for ${articleId}, left as draft:`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  return { articleId, status: "draft" }
}
