import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * CMS Pages table
 * Tracks per-store page status (draft/published state)
 */
export const cmsPagesTable = defineTable({
  storeId: v.id("stores"),
  pageSlug: v.string(), // "sign-in", "sign-up", "forgot-password"
  hasPublished: v.boolean(), // a published version exists
  hasUnpublishedChanges: v.boolean(), // draft differs from published
  publishedAt: v.optional(v.number()),
  draftUpdatedAt: v.optional(v.number()),
  updatedAt: v.number(),
  updatedBy: v.string(), // user identifier
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_pageSlug", ["storeId", "pageSlug"])

/**
 * CMS field value validator
 * Structured payload for a single editable field
 */
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
  mediaId: v.optional(v.string()), // Reference to cmsMedia._id
  altText: v.optional(v.string()),
  embedUrl: v.optional(v.string()),
  embedProvider: v.optional(
    v.union(v.literal("youtube"), v.literal("vimeo")),
  ),
  isCleared: v.optional(v.boolean()),
})

/**
 * CMS Blocks table
 * Section-based content storage with structured payload
 * Each block has at most 1 draft and 1 published version per (storeId, pageSlug, blockKey)
 */
export const cmsBlocksTable = defineTable({
  storeId: v.id("stores"),
  pageSlug: v.string(),
  blockKey: v.string(), // "hero", "form", "footer-help"
  isDraft: v.boolean(), // true = draft, false = published
  values: v.record(v.string(), cmsFieldValueValidator),
  // Draft-only: scheduled translation job ID (never copied to published)
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),
  updatedAt: v.number(),
  updatedBy: v.string(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_pageSlug", ["storeId", "pageSlug"])
  .index("by_storeId_pageSlug_blockKey_isDraft", [
    "storeId",
    "pageSlug",
    "blockKey",
    "isDraft",
  ])

/**
 * CMS Media variant validator
 * Reusable shape for generated image variants (thumb, card, og)
 */
const cmsMediaVariantValidator = v.object({
  url: v.string(),
  width: v.number(),
  height: v.number(),
})

/**
 * CMS Media table
 * Centralized media library for CMS assets
 *
 * Upload flow (v2):
 *   createMedia(status=processing) → presign → PUT S3 → confirmUpload → processImage → setMediaReady
 *
 * Backward compat:
 *   - `url` (legacy, optional): old records store the public URL here
 *   - `sourceUrl` (new): new records store the source URL here
 *   - Reads always do: sourceUrl ?? url
 *   - `thumbnailUrl` (legacy): replaced by variants.thumb
 */
export const cmsMediaTable = defineTable({
  storeId: v.id("stores"),
  brandId: v.optional(v.string()), // dual scope: optional now, required when blog arrives
  kind: v.union(
    v.literal("image"),
    v.literal("video"),
    v.literal("file"),
  ),
  status: v.union(
    v.literal("processing"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  filename: v.string(),
  mimeType: v.string(),
  size: v.number(), // bytes
  s3Key: v.optional(v.string()), // omitted at creation, filled by setMediaReady
  sourceUrl: v.optional(v.string()), // public URL of the source file (new)
  url: v.optional(v.string()), // legacy: public URL (kept for backward compat)
  thumbnailUrl: v.optional(v.string()), // legacy: replaced by variants.thumb
  variants: v.optional(
    v.object({
      thumb: v.optional(cmsMediaVariantValidator), // 400x400 center crop WebP
      card: v.optional(cmsMediaVariantValidator), // 800x450 center crop WebP
      og: v.optional(cmsMediaVariantValidator), // 1200x630 (v2)
    }),
  ),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  folder: v.optional(v.string()),
  usageCount: v.number(), // derived cache, real check at deletion
  uploadedBy: v.string(),
  uploadedAt: v.number(),
  errorCode: v.optional(v.string()), // set when status=failed
  errorMessage: v.optional(v.string()), // set when status=failed
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_kind", ["storeId", "kind"])
  .index("by_storeId_folder", ["storeId", "folder"])
