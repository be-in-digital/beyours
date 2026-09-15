/**
 * CMS Publish Functions (Package Layer)
 *
 * Atomic publish: copy draft blocks -> published blocks.
 * Handles translation copy, usageCount, and page status.
 */

import { v } from "convex/values"
import { getPageDefinition, getBlockDefinition } from "@be-in-digital/cms"

/** CMS field value shape matching the validator */
interface CmsFieldValue {
  type: "text" | "richtext" | "image" | "video" | "file" | "select"
  textValue?: string
  mediaId?: string
  altText?: string
  isCleared?: boolean
}

/** Block definition from CMS registry */
interface BlockFieldDef {
  type: string
  required?: boolean
  hasCodeFallback?: boolean
}

/*
 * `publishPage` USED TO BE HERE, and it was superseded rather than unfinished
 * (#524).
 *
 * Each app's own `convex/cms.ts:148` is what runs: a `storeMutation` that takes
 * `updatedBy` from the session identity and calls `publishPageCore` directly.
 * This definition took `updatedBy` as an ARGUMENT — from the client — so a
 * caller could have signed somebody else's name to a publish. Nothing wrapped
 * it, so nothing ever could; it was a shape waiting for someone to reach for
 * the wrong one.
 *
 * Deleted rather than left as a second way in. `publishPageCore` below is the
 * shared logic, and it is what both apps call.
 */

/**
 * Core publish logic with optional callback for translation scheduling.
 *
 * When publishing, translations are copied from draft to published.
 * If the draft had no translations yet (race condition: publish before
 * debounced auto-translation fires), onAfterPublish is called for each
 * published block that needs translations, so the app layer can schedule them.
 */
export async function publishPageCore(
  ctx: any,
  args: {
    storeId: string
    pageSlug: string
    updatedBy: string
  },
  options?: {
    onAfterPublish?: (ctx: any, blockId: string, storeId: string) => Promise<void>
  },
): Promise<{ publishedBlocks: number }> {
  const now = Date.now()

  // Get all blocks for this page
  const allBlocks = await ctx.db
    .query("cmsBlocks")
    .withIndex("by_storeId_pageSlug", (q: any) =>
      q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
    )
    .collect()

  const pageDef = getPageDefinition(args.pageSlug)
  if (!pageDef) throw new Error(`Page "${args.pageSlug}" not found in registry`)

  const publishedBlockIds: string[] = []
  const blocksNeedingTranslation: string[] = []

  for (const blockDef of pageDef.blocks) {
    const draft = allBlocks.find(
      (b: any) => b.blockKey === blockDef.key && b.isDraft,
    )
    const published = allBlocks.find(
      (b: any) => b.blockKey === blockDef.key && !b.isDraft,
    )

    if (!draft) {
      // No draft for this block — keep existing published as-is
      if (published) publishedBlockIds.push(published._id)
      continue
    }

    // Cancel any pending translation job on the draft
    if (draft.scheduledTranslationJobId) {
      try {
        await ctx.scheduler.cancel(draft.scheduledTranslationJobId)
      } catch {
        // Job already executed or cancelled
      }
    }

    // Validate required fields without fallback
    validateRequiredFields(draft.values, blockDef)

    let publishedId: string

    if (published) {
      // Update existing published block
      // Decrement old media usageCount, increment new
      await updateMediaUsageDelta(ctx, published.values, draft.values)

      await ctx.db.patch(published._id, {
        values: draft.values,
        updatedAt: now,
        updatedBy: args.updatedBy,
      })

      // Copy translations from draft to published
      const copied = await copyTranslations(ctx, args.storeId, draft._id, published._id)

      publishedId = published._id
      publishedBlockIds.push(published._id)

      if (copied === 0) blocksNeedingTranslation.push(published._id)
    } else {
      // Create new published block (media usageCount already tracked from draft)
      publishedId = await ctx.db.insert("cmsBlocks", {
        storeId: args.storeId,
        pageSlug: args.pageSlug,
        blockKey: blockDef.key,
        isDraft: false,
        values: draft.values,
        updatedAt: now,
        updatedBy: args.updatedBy,
      })

      // Copy translations from draft to new published
      const copied = await copyTranslations(ctx, args.storeId, draft._id, publishedId)

      publishedBlockIds.push(publishedId)

      if (copied === 0) blocksNeedingTranslation.push(publishedId)
    }

    // Delete the draft after publishing
    await ctx.db.delete(draft._id)
  }

  // Update page status
  const pageDoc = await ctx.db
    .query("cmsPages")
    .withIndex("by_storeId_pageSlug", (q: any) =>
      q.eq("storeId", args.storeId).eq("pageSlug", args.pageSlug),
    )
    .unique()

  if (pageDoc) {
    await ctx.db.patch(pageDoc._id, {
      hasPublished: true,
      hasUnpublishedChanges: false,
      publishedAt: now,
      updatedAt: now,
      updatedBy: args.updatedBy,
    })
  } else {
    await ctx.db.insert("cmsPages", {
      storeId: args.storeId,
      pageSlug: args.pageSlug,
      hasPublished: true,
      hasUnpublishedChanges: false,
      publishedAt: now,
      updatedAt: now,
      updatedBy: args.updatedBy,
    })
  }

  // Schedule translations for published blocks that had none copied
  if (options?.onAfterPublish) {
    for (const blockId of blocksNeedingTranslation) {
      await options.onAfterPublish(ctx, blockId, args.storeId)
    }
  }

  return { publishedBlocks: publishedBlockIds.length }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function validateRequiredFields(values: Record<string, CmsFieldValue>, blockDef: { key: string; fields: Record<string, BlockFieldDef> }): void {
  for (const [fieldKey, fieldDef] of Object.entries(blockDef.fields)) {
    if (!fieldDef.required || fieldDef.hasCodeFallback) continue

    const value = values[fieldKey]
    if (!value || value.isCleared) {
      throw new Error(
        `Cannot publish: required field "${fieldKey}" in block "${blockDef.key}" is empty and has no code fallback`,
      )
    }

    // Check for actual content
    if (["text", "richtext"].includes(fieldDef.type)) {
      if (!value.textValue || value.textValue.trim().length === 0) {
        throw new Error(
          `Cannot publish: required field "${fieldKey}" in block "${blockDef.key}" has empty text`,
        )
      }
    }

    if (["image", "file"].includes(fieldDef.type)) {
      if (!value.mediaId) {
        throw new Error(
          `Cannot publish: required field "${fieldKey}" in block "${blockDef.key}" has no media`,
        )
      }
    }
  }
}

async function copyTranslations(
  ctx: any,
  storeId: string,
  fromBlockId: string,
  toBlockId: string,
): Promise<number> {
  // Get all translations for the source block
  const sourceTranslations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q
        .eq("storeId", storeId)
        .eq("entityType", "cms")
        .eq("entityId", fromBlockId),
    )
    .collect()

  // Delete existing translations for the target block
  const existingTarget = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q
        .eq("storeId", storeId)
        .eq("entityType", "cms")
        .eq("entityId", toBlockId),
    )
    .collect()

  for (const t of existingTarget) {
    await ctx.db.delete(t._id)
  }

  // Copy translations from source to target
  const now = Date.now()
  for (const t of sourceTranslations) {
    await ctx.db.insert("translations", {
      storeId,
      entityType: "cms",
      entityId: toBlockId,
      field: t.field,
      languageCode: t.languageCode,
      value: t.value,
      isAutoTranslated: t.isAutoTranslated,
      createdAt: now,
      updatedAt: now,
    })
  }

  return sourceTranslations.length
}

async function updateMediaUsageDelta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex ctx type is dynamic
  ctx: any,
  oldValues: Record<string, CmsFieldValue>,
  newValues: Record<string, CmsFieldValue>,
): Promise<void> {
  const oldIds = new Set<string>()
  const newIds = new Set<string>()

  for (const fv of Object.values(oldValues)) {
    if (fv?.mediaId) oldIds.add(fv.mediaId)
  }
  for (const fv of Object.values(newValues)) {
    if (fv?.mediaId) newIds.add(fv.mediaId)
  }

  // Decrement removed
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      try {
        const media = await ctx.db.get(id)
        if (media) {
          await ctx.db.patch(id, { usageCount: Math.max(0, (media.usageCount ?? 0) - 1) })
        }
      } catch { /* */ }
    }
  }

  // Increment added
  for (const id of newIds) {
    if (!oldIds.has(id)) {
      try {
        const media = await ctx.db.get(id)
        if (media) {
          await ctx.db.patch(id, { usageCount: (media.usageCount ?? 0) + 1 })
        }
      } catch { /* */ }
    }
  }
}
