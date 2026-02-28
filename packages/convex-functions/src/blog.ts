/**
 * Blog Functions (Package Layer)
 *
 * Queries and mutation helpers for the blog CMS.
 * Pure logic — no auth, no scheduling. Those are handled in app wrappers.
 *
 * Single-document draft/published model:
 *   - draftContent + publishedContent in the same blogArticles record
 *   - Tags versioned via blogArticleTags.isDraft
 */

import { v } from "convex/values"
import { generateSlug, now } from "./helpers"

// ============================================================================
// Validators (reusable across queries and mutations)
// ============================================================================

const blogContentValidator = v.object({
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),
  coverImageId: v.id("cmsMedia"),
  coverImageAlt: v.optional(v.string()),
  content: v.string(),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  ogImageId: v.optional(v.id("cmsMedia")),
  updatedAt: v.number(),
})

// ============================================================================
// Public Queries (storefront, no auth at package level)
// ============================================================================

/** List published articles, sorted by publishedAt desc */
export const listPublishedArticles = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const articles = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId_status_publishedAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "published"),
      )
      .order("desc")
      .collect()

    const limited = args.limit ? articles.slice(0, args.limit) : articles

    return Promise.all(
      limited.map(async (article: any) => {
        const media = await resolveArticleMedia(ctx, article.publishedContent)
        const category = article.publishedCategoryId
          ? await ctx.db.get(article.publishedCategoryId)
          : null
        return {
          _id: article._id,
          slug: article.publishedSlug,
          title: article.publishedContent.title,
          excerpt: article.publishedContent.excerpt,
          coverImage: media.coverImage,
          category: category ? { _id: category._id, name: category.name, slug: category.slug } : null,
          publishedAt: article.publishedAt,
          authorId: article.publishedAuthorId,
        }
      }),
    )
  },
}

/** List published articles by category slug */
export const listByCategory = {
  args: {
    storeId: v.id("stores"),
    categorySlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    // Resolve category by slug
    const category = await ctx.db
      .query("blogCategories")
      .withIndex("by_storeId_slug", (q: any) =>
        q.eq("storeId", args.storeId).eq("slug", args.categorySlug),
      )
      .unique()
    if (!category) return []

    const articles = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId_publishedCategoryId_status_publishedAt", (q: any) =>
        q
          .eq("storeId", args.storeId)
          .eq("publishedCategoryId", category._id)
          .eq("status", "published"),
      )
      .order("desc")
      .collect()

    const limited = args.limit ? articles.slice(0, args.limit) : articles

    return Promise.all(
      limited.map(async (article: any) => {
        const media = await resolveArticleMedia(ctx, article.publishedContent)
        return {
          _id: article._id,
          slug: article.publishedSlug,
          title: article.publishedContent.title,
          excerpt: article.publishedContent.excerpt,
          coverImage: media.coverImage,
          category: { _id: category._id, name: category.name, slug: category.slug },
          publishedAt: article.publishedAt,
          authorId: article.publishedAuthorId,
        }
      }),
    )
  },
}

/** List published articles by tag slug */
export const listByTag = {
  args: {
    storeId: v.id("stores"),
    tagSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    // Resolve tag by slug
    const tag = await ctx.db
      .query("blogTags")
      .withIndex("by_storeId_slug", (q: any) =>
        q.eq("storeId", args.storeId).eq("slug", args.tagSlug),
      )
      .unique()
    if (!tag) return []

    // Get published tag joins, sorted by publishedAt desc
    const tagJoins = await ctx.db
      .query("blogArticleTags")
      .withIndex("by_storeId_tagId_isDraft_publishedAt", (q: any) =>
        q
          .eq("storeId", args.storeId)
          .eq("tagId", tag._id)
          .eq("isDraft", false),
      )
      .order("desc")
      .collect()

    const limited = args.limit ? tagJoins.slice(0, args.limit) : tagJoins

    const articles = await Promise.all(
      limited.map(async (join: any) => {
        const article = await ctx.db.get(join.articleId)
        if (!article || article.status !== "published" || !article.publishedContent) return null
        const media = await resolveArticleMedia(ctx, article.publishedContent)
        const category = article.publishedCategoryId
          ? await ctx.db.get(article.publishedCategoryId)
          : null
        return {
          _id: article._id,
          slug: article.publishedSlug,
          title: article.publishedContent.title,
          excerpt: article.publishedContent.excerpt,
          coverImage: media.coverImage,
          category: category ? { _id: category._id, name: category.name, slug: category.slug } : null,
          publishedAt: article.publishedAt,
          authorId: article.publishedAuthorId,
        }
      }),
    )

    return articles.filter(Boolean)
  },
}

/** Get a published article by slug (storefront) */
export const getArticleBySlug = {
  args: {
    storeId: v.id("stores"),
    slug: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const article = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId_publishedSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("publishedSlug", args.slug),
      )
      .unique()

    if (!article || article.status === "draft" || !article.publishedContent) return null

    const media = await resolveArticleMedia(ctx, article.publishedContent)
    const category = article.publishedCategoryId
      ? await ctx.db.get(article.publishedCategoryId)
      : null

    // Get published tags
    const tagJoins = await ctx.db
      .query("blogArticleTags")
      .withIndex("by_articleId_isDraft", (q: any) =>
        q.eq("articleId", article._id).eq("isDraft", false),
      )
      .collect()
    const tags = await Promise.all(
      tagJoins.map(async (join: any) => {
        const tag = await ctx.db.get(join.tagId)
        return tag ? { _id: tag._id, name: tag.name, slug: tag.slug } : null
      }),
    )

    return {
      _id: article._id,
      slug: article.publishedSlug,
      status: article.status,
      publishedAt: article.publishedAt,
      authorId: article.publishedAuthorId,
      content: article.publishedContent,
      coverImage: media.coverImage,
      ogImage: media.ogImage,
      category: category ? { _id: category._id, name: category.name, slug: category.slug } : null,
      tags: tags.filter(Boolean),
    }
  },
}

/** List all categories for a store (sorted by sortOrder) */
export const listCategories = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const categories = await ctx.db
      .query("blogCategories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return categories.sort((a: any, b: any) => a.sortOrder - b.sortOrder)
  },
}

/** List all tags for a store (sorted alphabetically) */
export const listTags = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const tags = await ctx.db
      .query("blogTags")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return tags.sort((a: any, b: any) => a.name.localeCompare(b.name))
  },
}

// ============================================================================
// Admin Queries
// ============================================================================

/** List all articles for admin (with optional status filter) */
export const listAdminArticles = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("published"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx: any, args: any) => {
    let articles
    if (args.status) {
      articles = await ctx.db
        .query("blogArticles")
        .withIndex("by_storeId_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status),
        )
        .collect()
    } else {
      articles = await ctx.db
        .query("blogArticles")
        .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
        .collect()
    }

    // Sort by updatedAt desc
    articles.sort((a: any, b: any) => b.updatedAt - a.updatedAt)

    return Promise.all(
      articles.map(async (article: any) => {
        const category = article.draftCategoryId
          ? await ctx.db.get(article.draftCategoryId)
          : null
        return {
          _id: article._id,
          status: article.status,
          hasUnpublishedChanges: article.hasUnpublishedChanges,
          scheduledPublishAt: article.scheduledPublishAt,
          publishedAt: article.publishedAt,
          draftTitle: article.draftContent.title,
          draftSlug: article.draftSlug,
          publishedSlug: article.publishedSlug,
          category: category ? { _id: category._id, name: category.name } : null,
          authorId: article.draftAuthorId,
          updatedAt: article.updatedAt,
          createdAt: article.createdAt,
        }
      }),
    )
  },
}

/** Get a single article for admin (draft + published side-by-side) */
export const getAdminArticle = {
  args: { articleId: v.id("blogArticles") },
  handler: async (ctx: any, args: any) => {
    const article = await ctx.db.get(args.articleId)
    if (!article) return null

    // Resolve media for draft
    const draftMedia = await resolveArticleMedia(ctx, article.draftContent)

    // Resolve media for published (if exists)
    const publishedMedia = article.publishedContent
      ? await resolveArticleMedia(ctx, article.publishedContent)
      : null

    // Get draft tags
    const draftTagJoins = await ctx.db
      .query("blogArticleTags")
      .withIndex("by_articleId_isDraft", (q: any) =>
        q.eq("articleId", article._id).eq("isDraft", true),
      )
      .collect()
    const draftTags = await Promise.all(
      draftTagJoins.map(async (join: any) => {
        const tag = await ctx.db.get(join.tagId)
        return tag ? { _id: tag._id, name: tag.name, slug: tag.slug } : null
      }),
    )

    // Get published tags
    const publishedTagJoins = await ctx.db
      .query("blogArticleTags")
      .withIndex("by_articleId_isDraft", (q: any) =>
        q.eq("articleId", article._id).eq("isDraft", false),
      )
      .collect()
    const publishedTags = await Promise.all(
      publishedTagJoins.map(async (join: any) => {
        const tag = await ctx.db.get(join.tagId)
        return tag ? { _id: tag._id, name: tag.name, slug: tag.slug } : null
      }),
    )

    // Get draft category
    const draftCategory = article.draftCategoryId
      ? await ctx.db.get(article.draftCategoryId)
      : null

    return {
      ...article,
      draftMedia,
      publishedMedia,
      draftTags: draftTags.filter(Boolean),
      publishedTags: publishedTags.filter(Boolean),
      draftCategory: draftCategory
        ? { _id: draftCategory._id, name: draftCategory.name, slug: draftCategory.slug }
        : null,
    }
  },
}

// ============================================================================
// Core Mutation Functions (called from app wrappers)
// ============================================================================

/**
 * Create a new blog article (draft).
 * Auto-generates slug from title, verifies uniqueness.
 */
export async function createArticleCore(
  ctx: any,
  args: {
    storeId: string
    title: string
    categoryId: string
    authorId: string
  },
): Promise<string> {
  const slug = await ensureUniqueSlug(ctx, args.storeId, generateSlug(args.title), null)
  const timestamp = now()

  const articleId = await ctx.db.insert("blogArticles", {
    storeId: args.storeId,
    status: "draft",
    hasUnpublishedChanges: true,
    draftSlug: slug,
    draftCategoryId: args.categoryId,
    draftAuthorId: args.authorId,
    draftContent: {
      title: args.title,
      slug,
      excerpt: "",
      coverImageId: undefined as any, // will be set on first save
      content: "",
      updatedAt: timestamp,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedBy: args.authorId,
  })

  return articleId
}

/**
 * Save draft content for an article.
 * Updates media usage, recalculates hasUnpublishedChanges.
 * If status=scheduled, reverts to draft.
 */
export async function saveDraftCore(
  ctx: any,
  args: {
    articleId: string
    draftContent: any
    categoryId: string
    authorId: string
    updatedBy: string
  },
  options?: {
    onAfterSave?: (ctx: any, articleId: string, storeId: string) => Promise<void>
  },
): Promise<void> {
  const article = await ctx.db.get(args.articleId)
  if (!article) throw new Error("Article not found")

  const timestamp = now()

  // Media usage delta for coverImageId
  const oldCoverId = article.draftContent?.coverImageId
  const newCoverId = args.draftContent.coverImageId
  if (oldCoverId !== newCoverId) {
    if (oldCoverId) await decrementUsageCount(ctx, oldCoverId)
    if (newCoverId) await incrementUsageCount(ctx, newCoverId)
  }

  // Media usage delta for ogImageId
  const oldOgId = article.draftContent?.ogImageId
  const newOgId = args.draftContent.ogImageId
  if (oldOgId !== newOgId) {
    if (oldOgId) await decrementUsageCount(ctx, oldOgId)
    if (newOgId) await incrementUsageCount(ctx, newOgId)
  }

  // Verify slug uniqueness if changed
  const newSlug = args.draftContent.slug || generateSlug(args.draftContent.title)
  const slug = await ensureUniqueSlug(ctx, article.storeId, newSlug, article._id)

  const draftContent = {
    ...args.draftContent,
    slug,
    updatedAt: timestamp,
  }

  // Recalculate hasUnpublishedChanges
  const hasUnpublishedChanges = !article.publishedContent || !contentEquals(draftContent, article.publishedContent)

  // If scheduled, revert to draft (editing a scheduled article cancels the schedule)
  const statusPatch: any = {}
  if (article.status === "scheduled") {
    statusPatch.status = "draft"
    statusPatch.scheduledPublishAt = undefined
    // Cancel scheduled job
    if (article.scheduledPublishJobId) {
      try {
        await ctx.scheduler.cancel(article.scheduledPublishJobId)
      } catch {
        // Job may have already run
      }
    }
    statusPatch.scheduledPublishJobId = undefined
  }

  await ctx.db.patch(args.articleId, {
    draftContent,
    draftSlug: slug,
    draftCategoryId: args.categoryId,
    draftAuthorId: args.authorId,
    hasUnpublishedChanges,
    updatedAt: timestamp,
    updatedBy: args.updatedBy,
    ...statusPatch,
  })

  // Trigger auto-translation
  if (options?.onAfterSave) {
    await options.onAfterSave(ctx, args.articleId, article.storeId)
  }
}

/**
 * Delete an article and all related data.
 * Cleans up tags, translations, and media usage.
 */
export async function deleteArticleCore(
  ctx: any,
  args: { articleId: string },
): Promise<void> {
  const article = await ctx.db.get(args.articleId)
  if (!article) throw new Error("Article not found")

  // Decrement media usage for draft content
  if (article.draftContent) {
    const draftMediaIds = extractArticleMediaIds(article.draftContent)
    for (const id of draftMediaIds) {
      await decrementUsageCount(ctx, id)
    }
  }

  // Decrement media usage for published content (only media not in draft)
  if (article.publishedContent) {
    const draftMediaIds = article.draftContent ? extractArticleMediaIds(article.draftContent) : new Set()
    const publishedMediaIds = extractArticleMediaIds(article.publishedContent)
    for (const id of publishedMediaIds) {
      if (!draftMediaIds.has(id)) {
        await decrementUsageCount(ctx, id)
      }
    }
  }

  // Delete all tag joins
  const tagJoins = await ctx.db
    .query("blogArticleTags")
    .withIndex("by_articleId", (q: any) => q.eq("articleId", args.articleId))
    .collect()
  for (const join of tagJoins) {
    await ctx.db.delete(join._id)
  }

  // Delete translations
  const translations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q
        .eq("storeId", article.storeId)
        .eq("entityType", "blogArticleDraft")
        .eq("entityId", args.articleId),
    )
    .collect()
  for (const t of translations) {
    await ctx.db.delete(t._id)
  }
  const pubTranslations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q
        .eq("storeId", article.storeId)
        .eq("entityType", "blogArticlePublished")
        .eq("entityId", args.articleId),
    )
    .collect()
  for (const t of pubTranslations) {
    await ctx.db.delete(t._id)
  }

  // Cancel any scheduled jobs
  if (article.scheduledPublishJobId) {
    try {
      await ctx.scheduler.cancel(article.scheduledPublishJobId)
    } catch { /* already ran */ }
  }
  if (article.scheduledTranslationJobId) {
    try {
      await ctx.scheduler.cancel(article.scheduledTranslationJobId)
    } catch { /* already ran */ }
  }

  // Delete the article
  await ctx.db.delete(args.articleId)
}

// ============================================================================
// Category CRUD
// ============================================================================

/** Create a blog category */
export const createCategory = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("cmsMedia")),
  },
  handler: async (ctx: any, args: any) => {
    const slug = generateSlug(args.name)

    // Verify uniqueness
    const existing = await ctx.db
      .query("blogCategories")
      .withIndex("by_storeId_slug", (q: any) =>
        q.eq("storeId", args.storeId).eq("slug", slug),
      )
      .unique()
    if (existing) throw new Error(`Une catégorie avec le slug "${slug}" existe déjà`)

    // Get max sortOrder
    const categories = await ctx.db
      .query("blogCategories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    const maxSort = categories.reduce((max: number, c: any) => Math.max(max, c.sortOrder), 0)

    const timestamp = now()
    return await ctx.db.insert("blogCategories", {
      storeId: args.storeId,
      name: args.name,
      slug,
      ...(args.description !== undefined && { description: args.description }),
      ...(args.imageId !== undefined && { imageId: args.imageId }),
      sortOrder: maxSort + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
}

/** Update a blog category */
export const updateCategory = {
  args: {
    categoryId: v.id("blogCategories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("cmsMedia")),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const category = await ctx.db.get(args.categoryId)
    if (!category) throw new Error("Category not found")

    const patch: any = { updatedAt: now() }

    if (args.name !== undefined) {
      patch.name = args.name
      const newSlug = generateSlug(args.name)
      // Verify uniqueness if slug changes
      if (newSlug !== category.slug) {
        const existing = await ctx.db
          .query("blogCategories")
          .withIndex("by_storeId_slug", (q: any) =>
            q.eq("storeId", category.storeId).eq("slug", newSlug),
          )
          .unique()
        if (existing && existing._id !== category._id) {
          throw new Error(`Une catégorie avec le slug "${newSlug}" existe déjà`)
        }
        patch.slug = newSlug
      }
    }
    if (args.description !== undefined) patch.description = args.description
    if (args.imageId !== undefined) patch.imageId = args.imageId
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder

    await ctx.db.patch(args.categoryId, patch)
  },
}

/** Delete a blog category (blocked if articles reference it) */
export const deleteCategory = {
  args: { categoryId: v.id("blogCategories") },
  handler: async (ctx: any, args: any) => {
    const category = await ctx.db.get(args.categoryId)
    if (!category) throw new Error("Category not found")

    // Check if any articles reference this category (draft or published)
    const articles = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", category.storeId))
      .collect()

    const hasRefs = articles.some(
      (a: any) => a.draftCategoryId === args.categoryId || a.publishedCategoryId === args.categoryId,
    )
    if (hasRefs) {
      throw new Error("Impossible de supprimer : des articles utilisent cette catégorie")
    }

    await ctx.db.delete(args.categoryId)
  },
}

// ============================================================================
// Tag CRUD
// ============================================================================

/** Create a blog tag */
export const createTag = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const slug = generateSlug(args.name)

    const existing = await ctx.db
      .query("blogTags")
      .withIndex("by_storeId_slug", (q: any) =>
        q.eq("storeId", args.storeId).eq("slug", slug),
      )
      .unique()
    if (existing) throw new Error(`Un tag avec le slug "${slug}" existe déjà`)

    return await ctx.db.insert("blogTags", {
      storeId: args.storeId,
      name: args.name,
      slug,
      createdAt: now(),
    })
  },
}

/** Delete a blog tag (cleanup join table) */
export const deleteTag = {
  args: { tagId: v.id("blogTags") },
  handler: async (ctx: any, args: any) => {
    const tag = await ctx.db.get(args.tagId)
    if (!tag) throw new Error("Tag not found")

    // Cleanup blogArticleTags
    const joins = await ctx.db
      .query("blogArticleTags")
      .withIndex("by_tagId", (q: any) => q.eq("tagId", args.tagId))
      .collect()
    for (const join of joins) {
      await ctx.db.delete(join._id)
    }

    await ctx.db.delete(args.tagId)
  },
}

/** Sync draft tags for an article (replace all isDraft=true with new tagIds) */
export const updateArticleTags = {
  args: {
    articleId: v.id("blogArticles"),
    tagIds: v.array(v.id("blogTags")),
  },
  handler: async (ctx: any, args: any) => {
    const article = await ctx.db.get(args.articleId)
    if (!article) throw new Error("Article not found")

    // Delete existing draft tags
    const existingDraftTags = await ctx.db
      .query("blogArticleTags")
      .withIndex("by_articleId_isDraft", (q: any) =>
        q.eq("articleId", args.articleId).eq("isDraft", true),
      )
      .collect()
    for (const join of existingDraftTags) {
      await ctx.db.delete(join._id)
    }

    // Insert new draft tags
    for (const tagId of args.tagIds) {
      await ctx.db.insert("blogArticleTags", {
        storeId: article.storeId,
        articleId: args.articleId,
        tagId,
        isDraft: true,
      })
    }
  },
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Resolve media for article content (coverImage + ogImage) */
async function resolveArticleMedia(
  ctx: any,
  content: any,
): Promise<{ coverImage: any; ogImage: any }> {
  let coverImage = null
  let ogImage = null

  if (content?.coverImageId) {
    try {
      const media = await ctx.db.get(content.coverImageId)
      if (media && media.status === "ready") {
        const mainUrl = media.sourceUrl ?? media.url ?? ""
        coverImage = {
          url: mainUrl,
          sourceUrl: mainUrl,
          thumbnailUrl: media.variants?.thumb?.url ?? media.thumbnailUrl,
          filename: media.filename,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
          variants: media.variants,
          alt: content.coverImageAlt,
        }
      }
    } catch { /* media deleted */ }
  }

  if (content?.ogImageId) {
    try {
      const media = await ctx.db.get(content.ogImageId)
      if (media && media.status === "ready") {
        const mainUrl = media.sourceUrl ?? media.url ?? ""
        ogImage = {
          url: mainUrl,
          width: media.width,
          height: media.height,
          variants: media.variants,
        }
      }
    } catch { /* media deleted */ }
  }

  return { coverImage, ogImage }
}

/** Extract all media IDs from article content */
function extractArticleMediaIds(content: any): Set<string> {
  const ids = new Set<string>()
  if (content?.coverImageId) ids.add(content.coverImageId)
  if (content?.ogImageId) ids.add(content.ogImageId)
  return ids
}

/** Compare two content objects for equality (shallow on key fields) */
function contentEquals(draft: any, published: any): boolean {
  if (!draft || !published) return false
  return (
    draft.title === published.title &&
    draft.slug === published.slug &&
    draft.excerpt === published.excerpt &&
    draft.content === published.content &&
    draft.coverImageId === published.coverImageId &&
    draft.coverImageAlt === published.coverImageAlt &&
    draft.ogImageId === published.ogImageId &&
    draft.metaTitle === published.metaTitle &&
    draft.metaDescription === published.metaDescription
  )
}

/** Ensure a slug is unique for a store (appends -2, -3, etc. if needed) */
async function ensureUniqueSlug(
  ctx: any,
  storeId: string,
  baseSlug: string,
  excludeArticleId: string | null,
): Promise<string> {
  let slug = baseSlug
  let suffix = 2

  while (true) {
    // Check draftSlug
    const draftMatch = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", storeId))
      .filter((q: any) => q.eq(q.field("draftSlug"), slug))
      .first()
    if (draftMatch && draftMatch._id !== excludeArticleId) {
      slug = `${baseSlug}-${suffix++}`
      continue
    }

    // Check publishedSlug
    const pubMatch = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId_publishedSlug", (q: any) =>
        q.eq("storeId", storeId).eq("publishedSlug", slug),
      )
      .first()
    if (pubMatch && pubMatch._id !== excludeArticleId) {
      slug = `${baseSlug}-${suffix++}`
      continue
    }

    break
  }

  return slug
}

async function incrementUsageCount(ctx: any, mediaId: string): Promise<void> {
  try {
    const media = await ctx.db.get(mediaId)
    if (media) {
      await ctx.db.patch(mediaId, { usageCount: (media.usageCount ?? 0) + 1 })
    }
  } catch { /* media may not exist */ }
}

async function decrementUsageCount(ctx: any, mediaId: string): Promise<void> {
  try {
    const media = await ctx.db.get(mediaId)
    if (media) {
      await ctx.db.patch(mediaId, { usageCount: Math.max(0, (media.usageCount ?? 0) - 1) })
    }
  } catch { /* media may not exist */ }
}
