/**
 * CMS Media Functions (Package Layer)
 *
 * Queries and mutations for the media library.
 * setMediaReady/setMediaFailed are plain defs here, wrapped as internalMutation in app.
 *
 * Upload flow (v2):
 *   createMedia(status=processing) → presign → PUT S3 → confirmUpload → processImage → setMediaReady
 */

import { ConvexError, v } from "convex/values"
import {
  getExtensionFromMimeType,
  getMediaKind,
  validateMediaUpload,
} from "@be-in-digital/cms"
import { mediaKeyFromUrl } from "@be-in-digital/core/aws/media-url"

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
 * Refuses an upload the media library must not accept.
 *
 * `validateMediaUpload` is the allow-list — MIME type, declared extension,
 * size — and it lived only in the browser: `CmsMediaPicker` and
 * `CmsMediaLibrary` called it, nothing on the server did. A client-side check
 * is a courtesy to the editor, not a boundary; `createMedia` is a public
 * mutation and a caller who skips the component reaches it directly. It
 * accepted `text/html` and a 5 GB SVG.
 *
 * `kind` is checked against the MIME type as well, because it is a separate
 * argument the caller chooses: declaring an `image/svg+xml` as kind `"file"`
 * routed it around `confirmUpload`'s image branch.
 *
 * Throws rather than returning a result: the caller is a mutation, and there is
 * nothing useful it could do with a refusal but propagate it.
 */
export function assertMediaUploadAllowed(args: {
  filename: string
  mimeType: string
  size: number
  kind: string
}): void {
  const result = validateMediaUpload(args.filename, args.mimeType, args.size)
  if (!result.valid) {
    throw new Error(result.error?.message ?? "Upload refusé")
  }

  const derivedKind = getMediaKind(args.mimeType)
  if (derivedKind !== args.kind) {
    throw new Error(
      `Le type de média "${args.kind}" ne correspond pas au type MIME "${args.mimeType}" (attendu : "${derivedKind}")`,
    )
  }
}

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
    assertMediaUploadAllowed({
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      kind: args.kind,
    })

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

/**
 * Every S3 object a media row owns: the source, and each generated variant.
 *
 * Two sources, because rows were written two ways. A row with an `s3Key` is a
 * v2 upload, and `processImage` writes its variants as siblings of the source
 * (`cms/{mediaId}/thumb.webp`), so the variant keys are derivable — deriving
 * them is exact and needs no environment. Older rows carry only URLs, which
 * `mediaKeyFromUrl` turns back into keys when they are this deployment's own.
 *
 * Deduplicated, because the two agree for a v2 row.
 */
export function collectMediaS3Keys(
  media: {
    s3Key?: string
    sourceUrl?: string
    url?: string
    thumbnailUrl?: string
    variants?: Record<string, { url?: string } | undefined>
  },
  origin: { publicBaseUrl?: string; bucketName?: string } = {},
): string[] {
  const keys = new Set<string>()

  const add = (key: string | null | undefined) => {
    if (key && !key.includes("..")) keys.add(key)
  }

  add(media.s3Key)

  // Variants sit beside the source under the same `cms/{mediaId}/` prefix.
  if (media.s3Key) {
    const slash = media.s3Key.lastIndexOf("/")
    if (slash > 0) {
      const prefix = media.s3Key.slice(0, slash)
      for (const name of Object.keys(media.variants ?? {})) {
        if (media.variants?.[name]) add(`${prefix}/${name}.webp`)
      }
    }
  }

  for (const url of [
    media.sourceUrl,
    media.url,
    media.thumbnailUrl,
    ...Object.values(media.variants ?? {}).map((variant) => variant?.url),
  ]) {
    if (url) add(mediaKeyFromUrl(url, origin))
  }

  return [...keys]
}

/**
 * Delete a media item (blocked if referenced in any cmsBlock or blog article).
 *
 * Returns the S3 keys the row owned. Deleting the row was the whole of this
 * function — `DeleteObjectCommand` appeared nowhere in the repository — so an
 * erasure request left every byte in the bucket. A mutation cannot reach S3,
 * so the keys are read here, while the row still exists, and handed to the app
 * wrapper to schedule against; looking them up after the commit is impossible.
 */
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
        if ((fv as { mediaId?: string })?.mediaId === args.mediaId) {
          // `ConvexError`, and in French. Thrown plainly this was redacted to
          // "Server Error" in production, on a media library that shows a
          // delete button beside every file — so the owner learned nothing
          // about which page was still using it.
          throw new ConvexError({
            code: "media_in_use_by_block",
            message:
              `Ce média est utilisé par le bloc « ${block.blockKey} » de la page ` +
              `« ${block.pageSlug} » (${block.isDraft ? "brouillon" : "publiée"}). ` +
              "Retirez-le de cette page avant de le supprimer.",
          })
        }
      }
    }

    // Check blog article references (coverImageId, ogImageId)
    const blogArticles = await ctx.db
      .query("blogArticles")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    for (const article of blogArticles) {
      const mediaIds = [
        article.draftContent?.coverImageId,
        article.draftContent?.ogImageId,
        article.publishedContent?.coverImageId,
        article.publishedContent?.ogImageId,
      ].filter(Boolean)

      if (mediaIds.includes(args.mediaId)) {
        throw new ConvexError({
          code: "media_in_use_by_article",
          message:
            `Ce média illustre l'article « ${article.draftContent?.title ?? "Sans titre"} ». ` +
            "Changez son image avant de le supprimer.",
        })
      }
    }

    // Read before the delete: once the mutation commits the row is gone and
    // the keys with it, so the caller has to be handed them, not a lookup.
    const s3Keys = collectMediaS3Keys(media, {
      publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
    })

    await ctx.db.delete(args.mediaId)
    return { deleted: true, s3Keys }
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
