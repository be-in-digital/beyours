/**
 * CMS Media Functions (Package Layer)
 *
 * Queries and mutations for the media library.
 * setMediaReady/setMediaFailed are plain defs here, wrapped as internalMutation in app.
 *
 * Upload flow (v2):
 *   createMedia(status=processing) → presign → PUT S3 → confirmUpload → processImage → setMediaReady
 */

import { v } from "convex/values"
import { getExtensionFromMimeType } from "@beindigital-engine/cms"

// ============================================================================
// Queries
// ============================================================================

/** List media for a store with optional filters */
export const listMedia = {
  args: {
    storeId: v.id("stores"),
    kind: v.optional(
      v.union(v.literal("image"), v.literal("video"), v.literal("file")),
    ),
    folder: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    let query = ctx.db
      .query("cmsMedia")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))

    let results = await query.collect()

    // Filter by kind
    if (args.kind) {
      results = results.filter((m: any) => m.kind === args.kind)
    }

    // Filter by folder
    if (args.folder) {
      results = results.filter((m: any) => m.folder === args.folder)
    }

    // Search by filename
    if (args.search) {
      const searchLower = args.search.toLowerCase()
      results = results.filter((m: any) =>
        m.filename.toLowerCase().includes(searchLower),
      )
    }

    // Sort by most recent first
    return results.sort((a: any, b: any) => b.uploadedAt - a.uploadedAt)
  },
}

/** Get a single media item */
export const getMedia = {
  args: { mediaId: v.id("cmsMedia") },
  handler: async (ctx: any, args: any) => {
    try {
      return await ctx.db.get(args.mediaId)
    } catch {
      return null
    }
  },
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Reserve a media record before upload.
 * Returns { mediaId } — the canonical S3 key is derived server-side
 * by getPresignedUrlForMedia using: cms/{mediaId}/source.{ext}
 */
export const createMedia = {
  args: {
    storeId: v.id("stores"),
    brandId: v.optional(v.string()),
    kind: v.union(v.literal("image"), v.literal("video"), v.literal("file")),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    folder: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const mediaId = await ctx.db.insert("cmsMedia", {
      storeId: args.storeId,
      ...(args.brandId !== undefined && { brandId: args.brandId }),
      kind: args.kind,
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      ...(args.folder !== undefined && { folder: args.folder }),
      uploadedBy: args.uploadedBy,
      status: "processing",
      usageCount: 0,
      uploadedAt: now,
    })
    return mediaId
  },
}

/** Delete a media item (blocked if referenced in any cmsBlock) */
export const deleteMedia = {
  args: {
    storeId: v.id("stores"),
    mediaId: v.id("cmsMedia"),
  },
  handler: async (ctx: any, args: any) => {
    const media = await ctx.db.get(args.mediaId)
    if (!media) throw new Error("Media not found")
    if (media.storeId !== args.storeId) throw new Error("Unauthorized")

    // Real reference check (don't trust usageCount alone)
    const allBlocks = await ctx.db
      .query("cmsBlocks")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    for (const block of allBlocks) {
      for (const fv of Object.values(block.values)) {
        if ((fv as any)?.mediaId === args.mediaId) {
          throw new Error(
            `Cannot delete: media is referenced in block "${block.blockKey}" (page "${block.pageSlug}", ${block.isDraft ? "draft" : "published"})`,
          )
        }
      }
    }

    await ctx.db.delete(args.mediaId)
    return { deleted: true }
  },
}

/**
 * Mark media as ready after processing completes.
 * Sets s3Key, sourceUrl, dimensions, variants.
 * Clears any previous error fields (for retry scenarios).
 */
export const setMediaReady = {
  args: {
    mediaId: v.id("cmsMedia"),
    s3Key: v.optional(v.string()),
    sourceUrl: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    variants: v.optional(
      v.object({
        thumb: v.optional(
          v.object({
            url: v.string(),
            width: v.number(),
            height: v.number(),
          }),
        ),
        card: v.optional(
          v.object({
            url: v.string(),
            width: v.number(),
            height: v.number(),
          }),
        ),
        og: v.optional(
          v.object({
            url: v.string(),
            width: v.number(),
            height: v.number(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx: any, args: any) => {
    const media = await ctx.db.get(args.mediaId)
    if (!media) throw new Error("Media not found")

    await ctx.db.patch(args.mediaId, {
      status: "ready",
      sourceUrl: args.sourceUrl,
      ...(args.s3Key !== undefined && { s3Key: args.s3Key }),
      ...(args.width !== undefined && { width: args.width }),
      ...(args.height !== undefined && { height: args.height }),
      ...(args.variants !== undefined && { variants: args.variants }),
      // Clear error fields on successful retry
      errorCode: undefined,
      errorMessage: undefined,
    })
  },
}

/**
 * Mark media as failed after processing error.
 * Stores errorCode and errorMessage for debugging and admin UI display.
 */
export const setMediaFailed = {
  args: {
    mediaId: v.id("cmsMedia"),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const media = await ctx.db.get(args.mediaId)
    if (!media) throw new Error("Media not found")

    await ctx.db.patch(args.mediaId, {
      status: "failed",
      ...(args.errorCode !== undefined && { errorCode: args.errorCode }),
      ...(args.errorMessage !== undefined && {
        errorMessage: args.errorMessage,
      }),
    })
  },
}

/**
 * Builds the canonical S3 key for a media record.
 * Pattern: cms/{mediaId}/source.{ext}
 */
export function buildSourceKey(
  mediaId: string,
  mimeType: string,
): string {
  const ext = getExtensionFromMimeType(mimeType)
  return `cms/${mediaId}/source.${ext}`
}
