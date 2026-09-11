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
/**
 * Every string an inline reference to this media could be written as.
 *
 * WHY THIS EXISTS (#432.5). `deleteMedia` checked `cmsBlocks.values[].mediaId`
 * and an article's `coverImageId` / `ogImageId` — every place a media is
 * referenced BY ID. An image dropped into an article's body is not: the editor
 * writes `<img src="…">`, so the reference is a URL in an HTML string, it never
 * increments `usageCount`, and the library showed **Utilisations: 0** beside the
 * delete button for a photograph on a published page.
 *
 * And the delete is not recoverable in the way a row delete is. The S3 bytes go
 * with it (`cmsMediaDelete.ts`), so the published article is left with a broken
 * image and the file is gone.
 *
 * The needles are the media's own identifiers rather than a parse of the HTML:
 * matching "is this string anywhere in that text" is exact, needs no HTML
 * parser in a Convex mutation, and cannot be defeated by an attribute order or
 * a query string the editor happens to append. The cost is a false POSITIVE on
 * a coincidence — which is the right way for this to be wrong: refusing a delete
 * the owner can retry after removing the image beats purging bytes off a live
 * page.
 *
 * `s3Key` is included because an app can serve through `/api/files?key=…`, and
 * the `mediaId` because a block editor may write the id into a data attribute.
 * Short or empty values are dropped: a needle of `""` matches every document.
 */
export function mediaReferenceNeedles(media: {
  _id?: unknown
  s3Key?: string
  sourceUrl?: string
  url?: string
  thumbnailUrl?: string
  variants?: Record<string, { url?: string } | undefined>
}): string[] {
  const needles = new Set<string>()
  for (const candidate of [
    typeof media._id === "string" ? media._id : undefined,
    media.s3Key,
    media.sourceUrl,
    media.url,
    media.thumbnailUrl,
    ...Object.values(media.variants ?? {}).map((variant) => variant?.url),
  ]) {
    // 8 characters is well under any real key, URL or Convex id, and well over
    // anything that could match by accident.
    if (typeof candidate === "string" && candidate.length >= 8) needles.add(candidate)
  }
  return [...needles]
}

/** Does this text carry any of those references? */
export function textReferencesMedia(
  text: unknown,
  needles: readonly string[]
): boolean {
  if (typeof text !== "string" || text.length === 0) return false
  return needles.some((needle) => text.includes(needle))
}

/**
 * Every string inside a CMS block's values, however deeply nested.
 *
 * A block's `values` is `v.any()`, so a rich-text field is a string on one block
 * and an array of nodes on another. Walking it is the only reading that does not
 * depend on which editor wrote the block.
 */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
  return out
}

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

    // Every string this media could be referenced by, for the inline cases the
    // id checks cannot see (#432.5).
    const needles = mediaReferenceNeedles({ ...media, _id: args.mediaId })

    for (const block of allBlocks) {
      // A rich-text block carries `<img src="…">` rather than a `mediaId`, so the
      // block's own text is read as well as its fields.
      if (collectStrings(block.values).some((text) => textReferencesMedia(text, needles))) {
        throw new ConvexError({
          code: "media_in_use_by_block",
          message:
            `Ce média apparaît dans le bloc « ${block.blockKey} » de la page ` +
            `« ${block.pageSlug} » (${block.isDraft ? "brouillon" : "publiée"}). ` +
            "Retirez-le de cette page avant de le supprimer.",
        })
      }
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

      /* The BODY, which is where the hole was (#432.5). An image dropped into
         an article is an `<img src="…">` in the HTML — no `mediaId`, no
         `usageCount`, so the library showed « Utilisations : 0 » beside the
         delete button for a photograph on a published page, and the S3 bytes
         went with the row.

         Draft and published both: a published body is what a reader sees, and a
         draft body is what the owner is about to publish. */
      for (const content of [article.draftContent, article.publishedContent]) {
        if (!content) continue
        if (!textReferencesMedia(content.content, needles)) continue
        throw new ConvexError({
          code: "media_in_use_by_article_body",
          message:
            `Ce média apparaît dans le corps de l'article ` +
            `« ${content.title ?? article.draftContent?.title ?? "Sans titre"} ». ` +
            "Retirez-le de l'article avant de le supprimer.",
        })
      }
    }

    /* And a blog CATEGORY's image, which `blog.ts` writes to
       `blogCategories.imageId` and this check did not read at all — so the one
       reference in the whole set that is a plain `v.id("cmsMedia")` was the one
       nothing looked at. */
    const blogCategories = await ctx.db
      .query("blogCategories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    for (const category of blogCategories) {
      if (category.imageId !== args.mediaId) continue
      throw new ConvexError({
        code: "media_in_use_by_blog_category",
        message:
          `Ce média illustre la catégorie « ${category.name} » du blog. ` +
          "Changez son image avant de le supprimer.",
      })
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
