/**
 * CMS Functions (Package Layer)
 *
 * Queries and mutation helpers for the CMS system.
 * Pure logic — no auth, no scheduling. Those are handled in app wrappers.
 */

import { v } from "convex/values"
import {
  getPageDefinition,
  getBlockDefinition,
  getAllPageSlugs,
  validateBlockValues,
} from "@be-in-digital/cms"
import { sanitizeRichTextHtml } from "./htmlSanitize"

// ============================================================================
// Validators
// ============================================================================

const cmsFieldValueValidator = v.object({
  type: v.union(
    v.literal("text"),
    v.literal("richtext"),
    v.literal("image"),
    v.literal("video"),
    v.literal("file"),
    v.literal("select"),
  ),
  textValue: v.optional(v.string()),
  mediaId: v.optional(v.string()),
  altText: v.optional(v.string()),
  embedUrl: v.optional(v.string()),
  embedProvider: v.optional(
    v.union(v.literal("youtube"), v.literal("vimeo")),
  ),
  isCleared: v.optional(v.boolean()),
})

/** TypeScript type matching the cmsFieldValueValidator shape */
interface CmsFieldValue {
  type: "text" | "richtext" | "image" | "video" | "file" | "select"
  textValue?: string
  mediaId?: string
  altText?: string
  embedUrl?: string
  embedProvider?: "youtube" | "vimeo"
  isCleared?: boolean
}

// ============================================================================
// Queries
// ============================================================================

/** List all CMS pages for a store (with status from cmsPages table) */
export const listPages = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const pageDocs = await ctx.db
      .query("cmsPages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const slugs = getAllPageSlugs()
    return slugs.map((slug: string) => {
      const pageDoc = pageDocs.find((p: any) => p.pageSlug === slug)
      const pageDef = getPageDefinition(slug)
      return {
        slug,
        label: pageDef?.label ?? slug,
        description: pageDef?.description,
        route: pageDef?.route,
        groupId: pageDef?.groupId,
        hasPublished: pageDoc?.hasPublished ?? false,
        hasUnpublishedChanges: pageDoc?.hasUnpublishedChanges ?? false,
        publishedAt: pageDoc?.publishedAt,
        draftUpdatedAt: pageDoc?.draftUpdatedAt,
      }
    })
  },
}

/** Get a single page status */
export const getPage = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("cmsPages")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .unique()
  },
}

/** Get published blocks for storefront (public, no auth) */
export const getPageBlocks = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const pageDoc = await ctx.db
      .query("cmsPages")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .unique()

    const pageMeta = pageDoc
      ? {
          hasPublished: pageDoc.hasPublished,
          hasUnpublishedChanges: pageDoc.hasUnpublishedChanges,
          publishedAt: pageDoc.publishedAt,
          draftUpdatedAt: pageDoc.draftUpdatedAt,
          updatedBy: pageDoc.updatedBy,
        }
      : null

    // Only published blocks
    const publishedBlocks = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .filter((q: any) => q.eq(q.field("isDraft"), false))
      .collect()

    const blocks = await Promise.all(
      publishedBlocks.map(async (block: any) => {
        const translationsByField = await resolveTranslations(ctx, args.storeId, block._id)
        const resolvedMedia = await resolveMedia(ctx, block.values)
        return {
          blockKey: block.blockKey,
          values: block.values,
          translationsByField,
          resolvedMedia,
        }
      }),
    )

    return { pageMeta, blocks }
  },
}

/** Get draft + published blocks for admin editor (auth-protected at app layer) */
export const getAdminPageBlocks = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const pageDoc = await ctx.db
      .query("cmsPages")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .unique()

    const pageMeta = pageDoc
      ? {
          hasPublished: pageDoc.hasPublished,
          hasUnpublishedChanges: pageDoc.hasUnpublishedChanges,
          publishedAt: pageDoc.publishedAt,
          draftUpdatedAt: pageDoc.draftUpdatedAt,
          updatedBy: pageDoc.updatedBy,
        }
      : null

    const allBlocks = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .collect()

    // Group by blockKey
    const pageDef = getPageDefinition(args.pageSlug)
    const blockKeys = pageDef?.blocks.map((b: any) => b.key) ?? []

    const blocks = await Promise.all(
      blockKeys.map(async (blockKey: string) => {
        const draft = allBlocks.find(
          (b: any) => b.blockKey === blockKey && b.isDraft,
        )
        const published = allBlocks.find(
          (b: any) => b.blockKey === blockKey && !b.isDraft,
        )

        const draftBlock = draft
          ? {
              values: draft.values,
              translationsByField: await resolveTranslations(ctx, args.storeId, draft._id),
              resolvedMedia: await resolveMedia(ctx, draft.values),
              updatedAt: draft.updatedAt,
              updatedBy: draft.updatedBy,
              isTranslating: !!draft.scheduledTranslationJobId,
            }
          : null

        const publishedBlock = published
          ? {
              values: published.values,
              translationsByField: await resolveTranslations(ctx, args.storeId, published._id),
              resolvedMedia: await resolveMedia(ctx, published.values),
            }
          : null

        return { blockKey, draftBlock, publishedBlock }
      }),
    )

    return { pageMeta, blocks }
  },
}

/** Get preview blocks: draft > published resolved (auth-protected at app layer) */
export const getPreviewPageBlocks = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const pageDoc = await ctx.db
      .query("cmsPages")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .unique()

    const pageMeta = pageDoc
      ? {
          hasPublished: pageDoc.hasPublished,
          hasUnpublishedChanges: pageDoc.hasUnpublishedChanges,
          publishedAt: pageDoc.publishedAt,
          draftUpdatedAt: pageDoc.draftUpdatedAt,
          updatedBy: pageDoc.updatedBy,
        }
      : null

    const allBlocks = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .collect()

    const pageDef = getPageDefinition(args.pageSlug)
    const blockKeys = pageDef?.blocks.map((b: any) => b.key) ?? []

    const blocks = await Promise.all(
      blockKeys.map(async (blockKey: string) => {
        const draft = allBlocks.find(
          (b: any) => b.blockKey === blockKey && b.isDraft,
        )
        const published = allBlocks.find(
          (b: any) => b.blockKey === blockKey && !b.isDraft,
        )

        // Draft > Published resolution (fallback code stays on hook/UI side)
        const resolved = draft ?? published
        if (!resolved) return null

        const translationsByField = await resolveTranslations(ctx, args.storeId, resolved._id)
        const resolvedMedia = await resolveMedia(ctx, resolved.values)

        return {
          blockKey,
          source: (draft ? "draft" : "published") as "draft" | "published",
          values: resolved.values,
          translationsByField,
          resolvedMedia,
        }
      }),
    )

    return {
      pageMeta,
      blocks: blocks.filter((b: any) => b !== null),
    }
  },
}

/** Get a single block draft */
export const getBlockDraft = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
    blockKey: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug_blockKey_isDraft", (q: any) =>
        q
          .eq("storeId", args.storeId)
          .eq("pageSlug", args.pageSlug)
          .eq("blockKey", args.blockKey)
          .eq("isDraft", true),
      )
      .unique()
  },
}

// ============================================================================
// Mutations (plain def objects for app wrappers)
// ============================================================================

/**
 * Core save draft block logic.
 * This is a helper function (not a Convex def), called from app-level wrapper.
 */
export async function saveDraftBlockCore(
  ctx: any,
  args: {
    storeId: string
    pageSlug: string
    blockKey: string
    values: Record<string, any>
    updatedBy: string
  },
  options?: {
    onAfterSave?: (ctx: any, blockId: string, storeId: string) => Promise<void>
  },
): Promise<string> {
  const now = Date.now()

  // Validate against registry
  const blockDef = getBlockDefinition(args.pageSlug, args.blockKey)
  if (!blockDef) {
    throw new Error(`Block "${args.blockKey}" not found in page "${args.pageSlug}"`)
  }

  // Clean rich text before anything else looks at it, so validation measures
  // and the table stores the same string the visitor's browser will be asked
  // to run. Sanitising after validation would leave the two able to disagree.
  const values = sanitizeRichTextValues(args.values, blockDef)

  const validation = validateBlockValues(values, blockDef)
  if (!validation.valid) {
    throw new Error(
      `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
    )
  }

  // Upsert draft block
  const existing = await ctx.db
    .query("cmsBlocks")
    .withIndex("by_storeId_pageSlug_blockKey_isDraft", (q: any) =>
      q
        .eq("storeId", args.storeId)
        .eq("pageSlug", args.pageSlug)
        .eq("blockKey", args.blockKey)
        .eq("isDraft", true),
    )
    .unique()

  let blockId: string

  if (existing) {
    // Update usageCount for media changes
    await updateMediaUsageDelta(ctx, existing.values, values)

    await ctx.db.patch(existing._id, {
      values,
      updatedAt: now,
      updatedBy: args.updatedBy,
    })
    blockId = existing._id
  } else {
    // Update usageCount for new media references
    await updateMediaUsageForNewValues(ctx, values)

    blockId = await ctx.db.insert("cmsBlocks", {
      storeId: args.storeId,
      pageSlug: args.pageSlug,
      blockKey: args.blockKey,
      isDraft: true,
      values,
      updatedAt: now,
      updatedBy: args.updatedBy,
    })
  }

  // Upsert cmsPages record
  await upsertPageStatus(ctx, args.storeId, args.pageSlug, args.updatedBy, {
    hasUnpublishedChanges: true,
    draftUpdatedAt: now,
  })

  // Call auto-translation hook (no-op if not provided)
  if (options?.onAfterSave) {
    await options.onAfterSave(ctx, blockId, args.storeId)
  }

  return blockId
}

/** Reset a single field to fallback (set isCleared) */
export const resetField = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
    blockKey: v.string(),
    fieldKey: v.string(),
    updatedBy: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    const draft = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug_blockKey_isDraft", (q: any) =>
        q
          .eq("storeId", args.storeId)
          .eq("pageSlug", args.pageSlug)
          .eq("blockKey", args.blockKey)
          .eq("isDraft", true),
      )
      .unique()

    if (!draft) return null

    const oldValue = draft.values[args.fieldKey]
    if (oldValue?.mediaId) {
      await decrementUsageCount(ctx, oldValue.mediaId)
    }

    const newValues = { ...draft.values }
    newValues[args.fieldKey] = {
      type: oldValue?.type ?? "text",
      isCleared: true,
    }

    await ctx.db.patch(draft._id, {
      values: newValues,
      updatedAt: now,
      updatedBy: args.updatedBy,
    })

    await upsertPageStatus(ctx, args.storeId, args.pageSlug, args.updatedBy, {
      hasUnpublishedChanges: true,
      draftUpdatedAt: now,
    })

    return draft._id
  },
}

/** Reset an entire block (delete draft) */
export const resetBlock = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
    blockKey: v.string(),
    updatedBy: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    const draft = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug_blockKey_isDraft", (q: any) =>
        q
          .eq("storeId", args.storeId)
          .eq("pageSlug", args.pageSlug)
          .eq("blockKey", args.blockKey)
          .eq("isDraft", true),
      )
      .unique()

    if (!draft) return null

    // Decrement usageCount for all media in the draft
    await decrementAllMediaUsage(ctx, draft.values)

    await ctx.db.delete(draft._id)

    await upsertPageStatus(ctx, args.storeId, args.pageSlug, args.updatedBy, {
      hasUnpublishedChanges: true,
      draftUpdatedAt: now,
    })

    return draft._id
  },
}

/** Reset all blocks for a page (delete all drafts) */
export const resetPage = {
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
    updatedBy: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    const drafts = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId_pageSlug", (q: any) =>
        q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
      )
      .filter((q: any) => q.eq(q.field("isDraft"), true))
      .collect()

    for (const draft of drafts) {
      await decrementAllMediaUsage(ctx, draft.values)
      await ctx.db.delete(draft._id)
    }

    await upsertPageStatus(ctx, args.storeId, args.pageSlug, args.updatedBy, {
      hasUnpublishedChanges: false,
      draftUpdatedAt: now,
    })

    return drafts.length
  },
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Run every `richtext` field of a block through the shared allow-list.
 *
 * The CMS editor is Tiptap and what it hands the mutation is
 * `editor.getHTML()` — markup, written by whoever has `content:write` on the
 * store. It was stored verbatim, which was harmless only for as long as the
 * storefront printed it as text instead of rendering it. It renders it now
 * (`components/storefront/cms-rich-text.tsx`), so the string has to be clean
 * before it reaches the table.
 *
 * Only fields the *registry* declares `richtext` are touched. The `type` on the
 * incoming value is the client's word for it and is not trusted here; a `text`
 * field stays untouched, because a plain-text field is escaped on render and
 * silently stripping its angle brackets would corrupt legitimate content.
 *
 * The values object is copied rather than mutated: the caller's argument is
 * also what the app wrapper logs and what the auto-translation hook may read.
 */
function sanitizeRichTextValues(
  values: Record<string, CmsFieldValue>,
  blockDef: { fields: Record<string, { type: string }> },
): Record<string, CmsFieldValue> {
  const cleaned: Record<string, CmsFieldValue> = { ...values }

  for (const [fieldKey, fieldDef] of Object.entries(blockDef.fields)) {
    if (fieldDef.type !== "richtext") continue

    const value = cleaned[fieldKey]
    if (!value || typeof value.textValue !== "string") continue

    cleaned[fieldKey] = {
      ...value,
      textValue: sanitizeRichTextHtml(value.textValue),
    }
  }

  return cleaned
}

async function resolveTranslations(
  ctx: any,
  storeId: string,
  blockId: string,
): Promise<Record<string, Record<string, { value: string; isAutoTranslated: boolean }>>> {
  const translations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q.eq("storeId", storeId).eq("entityType", "cms").eq("entityId", blockId),
    )
    .collect()

  const result: Record<string, Record<string, { value: string; isAutoTranslated: boolean }>> = {}
  for (const t of translations) {
    if (!result[t.field]) result[t.field] = {}
    const fieldTranslations = result[t.field]!
    fieldTranslations[t.languageCode] = {
      value: t.value,
      isAutoTranslated: t.isAutoTranslated,
    }
  }
  return result
}

async function resolveMedia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex ctx type is dynamic
  ctx: any,
  values: Record<string, CmsFieldValue>,
): Promise<Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [fieldKey, fieldValue] of Object.entries(values)) {
    const fv = fieldValue
    if (fv?.mediaId) {
      try {
        const media = await ctx.db.get(fv.mediaId)
        if (media && media.status === "ready") {
          const mainUrl = media.sourceUrl ?? media.url ?? ""
          result[fieldKey] = {
            url: mainUrl,
            sourceUrl: mainUrl,
            thumbnailUrl: media.variants?.thumb?.url ?? media.thumbnailUrl,
            filename: media.filename,
            mimeType: media.mimeType,
            width: media.width,
            height: media.height,
            variants: media.variants,
          }
        }
      } catch {
        // Media deleted or invalid ID
      }
    }
  }
  return result
}

async function upsertPageStatus(
  ctx: any,
  storeId: string,
  pageSlug: string,
  updatedBy: string,
  patch: Record<string, any>,
): Promise<void> {
  const now = Date.now()
  const existing = await ctx.db
    .query("cmsPages")
    .withIndex("by_storeId_pageSlug", (q: any) =>
      q.eq("storeId", storeId).eq("pageSlug", pageSlug),
    )
    .unique()

  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: now, updatedBy })
  } else {
    await ctx.db.insert("cmsPages", {
      storeId,
      pageSlug,
      hasPublished: false,
      hasUnpublishedChanges: true,
      updatedAt: now,
      updatedBy,
      ...patch,
    })
  }
}

async function updateMediaUsageDelta(
  ctx: any,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
): Promise<void> {
  const oldMediaIds = extractMediaIds(oldValues)
  const newMediaIds = extractMediaIds(newValues)

  // Decrement removed
  for (const id of oldMediaIds) {
    if (!newMediaIds.has(id)) {
      await decrementUsageCount(ctx, id)
    }
  }

  // Increment added
  for (const id of newMediaIds) {
    if (!oldMediaIds.has(id)) {
      await incrementUsageCount(ctx, id)
    }
  }
}

async function updateMediaUsageForNewValues(
  ctx: any,
  values: Record<string, any>,
): Promise<void> {
  const mediaIds = extractMediaIds(values)
  for (const id of mediaIds) {
    await incrementUsageCount(ctx, id)
  }
}

async function decrementAllMediaUsage(
  ctx: any,
  values: Record<string, any>,
): Promise<void> {
  const mediaIds = extractMediaIds(values)
  for (const id of mediaIds) {
    await decrementUsageCount(ctx, id)
  }
}

function extractMediaIds(values: Record<string, CmsFieldValue>): Set<string> {
  const ids = new Set<string>()
  for (const fv of Object.values(values)) {
    if (fv?.mediaId) ids.add(fv.mediaId)
  }
  return ids
}

async function incrementUsageCount(ctx: any, mediaId: string): Promise<void> {
  try {
    const media = await ctx.db.get(mediaId)
    if (media) {
      await ctx.db.patch(mediaId, { usageCount: (media.usageCount ?? 0) + 1 })
    }
  } catch {
    // Media may not exist
  }
}

async function decrementUsageCount(ctx: any, mediaId: string): Promise<void> {
  try {
    const media = await ctx.db.get(mediaId)
    if (media) {
      await ctx.db.patch(mediaId, {
        usageCount: Math.max(0, (media.usageCount ?? 0) - 1),
      })
    }
  } catch {
    // Media may not exist
  }
}
