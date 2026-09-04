/**
 * Blog Publish Functions (Package Layer)
 *
 * Core publish, schedule, archive logic for blog articles.
 * Pure logic — no auth, no "use node". Called from app wrappers.
 */

import { now } from "./helpers"
import { sanitizeArticleHtml } from "./htmlSanitize"

// ============================================================================
// Publish
// ============================================================================

/**
 * Publish an article: copy draft → published.
 * Validates draft completeness, syncs tags, copies translations.
 */
export async function publishArticleCore(
  ctx: any,
  articleId: string,
  updatedBy: string,
): Promise<void> {
  const article = await ctx.db.get(articleId)
  if (!article) throw new Error("Article not found")

  const draft = article.draftContent
  if (!draft) throw new Error("No draft content to publish")

  // Validate draft completeness
  if (!draft.title?.trim()) throw new Error("Le titre est requis")
  if (!draft.slug?.trim()) throw new Error("Le slug est requis")
  if (!draft.excerpt?.trim()) throw new Error("L'extrait est requis")
  if (!draft.coverImageId) throw new Error("L'image de couverture est requise")
  if (!draft.content?.trim()) throw new Error("Le contenu est requis")

  // Verify slug uniqueness (exclude self)
  const slugConflict = await ctx.db
    .query("blogArticles")
    .withIndex("by_storeId_publishedSlug", (q: any) =>
      q.eq("storeId", article.storeId).eq("publishedSlug", draft.slug),
    )
    .first()
  if (slugConflict && slugConflict._id !== articleId) {
    throw new Error(`Le slug "${draft.slug}" est déjà utilisé par un autre article publié`)
  }

  const timestamp = now()

  // Media usage delta (published old → published new)
  if (article.publishedContent) {
    const oldCover = article.publishedContent.coverImageId
    const newCover = draft.coverImageId
    if (oldCover !== newCover) {
      if (oldCover) await decrementUsageCount(ctx, oldCover)
      if (newCover) await incrementUsageCount(ctx, newCover)
    }
    const oldOg = article.publishedContent.ogImageId
    const newOg = draft.ogImageId
    if (oldOg !== newOg) {
      if (oldOg) await decrementUsageCount(ctx, oldOg)
      if (newOg) await incrementUsageCount(ctx, newOg)
    }
  } else {
    // First publish: increment for published media
    if (draft.coverImageId) await incrementUsageCount(ctx, draft.coverImageId)
    if (draft.ogImageId) await incrementUsageCount(ctx, draft.ogImageId)
  }

  // Sync tags: delete old published tags, copy draft tags as published
  const oldPublishedTags = await ctx.db
    .query("blogArticleTags")
    .withIndex("by_articleId_isDraft", (q: any) =>
      q.eq("articleId", articleId).eq("isDraft", false),
    )
    .collect()
  for (const join of oldPublishedTags) {
    await ctx.db.delete(join._id)
  }

  const draftTags = await ctx.db
    .query("blogArticleTags")
    .withIndex("by_articleId_isDraft", (q: any) =>
      q.eq("articleId", articleId).eq("isDraft", true),
    )
    .collect()
  for (const join of draftTags) {
    await ctx.db.insert("blogArticleTags", {
      storeId: article.storeId,
      articleId,
      tagId: join.tagId,
      isDraft: false,
      publishedAt: timestamp,
    })
  }

  // Copy translations (blogArticleDraft → blogArticlePublished)
  await copyTranslations(ctx, article.storeId, articleId)

  // Patch the article
  await ctx.db.patch(articleId, {
    status: "published",
    hasUnpublishedChanges: false,
    publishedAt: timestamp,
    publishedSlug: draft.slug,
    publishedCategoryId: article.draftCategoryId,
    publishedAuthorId: article.draftAuthorId,
    // Cleaned again on the way out, not only on the way in: a draft written
    // before `saveDraftCore` started sanitising is still sitting in the
    // database, and publishing is what puts it in front of the public.
    publishedContent: {
      ...draft,
      ...(typeof draft.content === "string"
        ? { content: sanitizeArticleHtml(draft.content) }
        : {}),
      updatedAt: timestamp,
    },
    // Clear scheduling fields
    scheduledPublishAt: undefined,
    scheduledPublishJobId: undefined,
    scheduledTranslationJobId: undefined,
    updatedAt: timestamp,
    updatedBy,
  })
}

// ============================================================================
// Schedule
// ============================================================================

/**
 * Schedule an article for future publication.
 * Validates draft completeness and future date.
 * The actual scheduling (ctx.scheduler.runAt) is done in the app wrapper.
 */
export async function scheduleArticleCore(
  ctx: any,
  articleId: string,
  publishAt: number,
  scheduledJobId: string,
): Promise<void> {
  const article = await ctx.db.get(articleId)
  if (!article) throw new Error("Article not found")

  if (publishAt <= Date.now()) {
    throw new Error("La date de publication doit être dans le futur")
  }

  // Validate draft completeness
  const draft = article.draftContent
  if (!draft?.title?.trim() || !draft?.slug?.trim() || !draft?.excerpt?.trim() || !draft?.coverImageId || !draft?.content?.trim()) {
    throw new Error("Le brouillon doit être complet pour planifier la publication")
  }

  // Cancel any existing scheduled job
  if (article.scheduledPublishJobId) {
    try {
      await ctx.scheduler.cancel(article.scheduledPublishJobId)
    } catch { /* already ran */ }
  }

  await ctx.db.patch(articleId, {
    status: "scheduled",
    scheduledPublishAt: publishAt,
    scheduledPublishJobId: scheduledJobId,
    updatedAt: now(),
  })
}

/** Unschedule an article (revert to draft) */
export async function unscheduleArticleCore(
  ctx: any,
  articleId: string,
): Promise<void> {
  const article = await ctx.db.get(articleId)
  if (!article) throw new Error("Article not found")
  if (article.status !== "scheduled") throw new Error("L'article n'est pas planifié")

  // Cancel scheduled job
  if (article.scheduledPublishJobId) {
    try {
      await ctx.scheduler.cancel(article.scheduledPublishJobId)
    } catch { /* already ran */ }
  }

  await ctx.db.patch(articleId, {
    status: "draft",
    scheduledPublishAt: undefined,
    scheduledPublishJobId: undefined,
    updatedAt: now(),
  })
}

// ============================================================================
// Archive
// ============================================================================

/** Archive an article (keeps published URL accessible but removes from lists) */
export async function archiveArticleCore(
  ctx: any,
  articleId: string,
): Promise<void> {
  const article = await ctx.db.get(articleId)
  if (!article) throw new Error("Article not found")

  // Cancel any scheduled job
  if (article.scheduledPublishJobId) {
    try {
      await ctx.scheduler.cancel(article.scheduledPublishJobId)
    } catch { /* already ran */ }
  }

  await ctx.db.patch(articleId, {
    status: "archived",
    archivedAt: now(),
    scheduledPublishAt: undefined,
    scheduledPublishJobId: undefined,
    updatedAt: now(),
  })
}

/** Unarchive an article (restore to published if content exists, else draft) */
export async function unarchiveArticleCore(
  ctx: any,
  articleId: string,
): Promise<void> {
  const article = await ctx.db.get(articleId)
  if (!article) throw new Error("Article not found")
  if (article.status !== "archived") throw new Error("L'article n'est pas archivé")

  const newStatus = article.publishedContent ? "published" : "draft"

  await ctx.db.patch(articleId, {
    status: newStatus,
    archivedAt: undefined,
    updatedAt: now(),
  })
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Copy translations from blogArticleDraft → blogArticlePublished */
async function copyTranslations(
  ctx: any,
  storeId: string,
  articleId: string,
): Promise<void> {
  // Delete existing published translations
  const pubTranslations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q
        .eq("storeId", storeId)
        .eq("entityType", "blogArticlePublished")
        .eq("entityId", articleId),
    )
    .collect()
  for (const t of pubTranslations) {
    await ctx.db.delete(t._id)
  }

  // Copy draft translations as published
  const draftTranslations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q
        .eq("storeId", storeId)
        .eq("entityType", "blogArticleDraft")
        .eq("entityId", articleId),
    )
    .collect()
  for (const t of draftTranslations) {
    await ctx.db.insert("translations", {
      storeId,
      entityType: "blogArticlePublished",
      entityId: articleId,
      field: t.field,
      languageCode: t.languageCode,
      value: t.value,
      isAutoTranslated: t.isAutoTranslated,
      updatedAt: now(),
    })
  }
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
