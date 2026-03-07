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

// ============================================================================
// Blog tables
// ============================================================================

/**
 * Blog content fields validator
 * Shared shape for draft/published article payloads
 */
const blogContentFieldsValidator = v.object({
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(), // max ~300 chars
  coverImageId: v.id("cmsMedia"),
  coverImageAlt: v.optional(v.string()),
  content: v.string(), // HTML from Tiptap
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  ogImageId: v.optional(v.id("cmsMedia")),
  updatedAt: v.number(),
})

/**
 * Blog Categories table
 * Hierarchical navigation for blog articles (1 category per article)
 */
export const blogCategoriesTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  slug: v.string(), // unique per store, slugified
  description: v.optional(v.string()),
  imageId: v.optional(v.id("cmsMedia")),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_slug", ["storeId", "slug"])

/**
 * Blog Tags table
 * Flexible tagging for blog articles (0..N tags per article)
 */
export const blogTagsTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  slug: v.string(), // unique per store, slugified
  createdAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_slug", ["storeId", "slug"])

/**
 * Blog Articles table
 * Single-document draft/published model:
 *   - draftContent + publishedContent in the same record
 *   - draftSlug/publishedSlug denormalized for index queries
 *   - draftCategoryId/publishedCategoryId versioned
 *   - draftAuthorId/publishedAuthorId versioned
 *
 * Workflow: draft → scheduled → published → archived
 */
export const blogArticlesTable = defineTable({
  storeId: v.id("stores"),

  // Workflow
  status: v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("published"),
    v.literal("archived"),
  ),
  hasUnpublishedChanges: v.boolean(),
  scheduledPublishAt: v.optional(v.number()), // non-null ONLY if status=scheduled
  scheduledPublishJobId: v.optional(v.id("_scheduled_functions")),
  publishedAt: v.optional(v.number()),
  archivedAt: v.optional(v.number()),

  // Slugs denormalized (top-level for indexes)
  draftSlug: v.string(),
  publishedSlug: v.optional(v.string()), // null if never published

  // Category versioned
  draftCategoryId: v.id("blogCategories"),
  publishedCategoryId: v.optional(v.id("blogCategories")),

  // Author versioned (userId string from Better Auth, not v.id("users"))
  draftAuthorId: v.string(),
  publishedAuthorId: v.optional(v.string()),

  // Payloads
  draftContent: blogContentFieldsValidator,
  publishedContent: v.optional(blogContentFieldsValidator),

  // Translation (draft-only, cleared on publish)
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),

  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.string(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_storeId_publishedSlug", ["storeId", "publishedSlug"])
  .index("by_storeId_publishedCategoryId_status_publishedAt", [
    "storeId",
    "publishedCategoryId",
    "status",
    "publishedAt",
  ])
  .index("by_storeId_status_publishedAt", [
    "storeId",
    "status",
    "publishedAt",
  ])
  .index("by_status_scheduledPublishAt", ["status", "scheduledPublishAt"])

/**
 * Blog Article-Tag join table
 * Versioned: isDraft=true for draft tags, isDraft=false for published tags
 * publishedAt denormalized for efficient pagination on /blog/tag/[slug]
 */
export const blogArticleTagsTable = defineTable({
  storeId: v.id("stores"),
  articleId: v.id("blogArticles"),
  tagId: v.id("blogTags"),
  isDraft: v.boolean(),
  publishedAt: v.optional(v.number()), // filled only when isDraft=false
})
  .index("by_articleId", ["articleId"])
  .index("by_articleId_isDraft", ["articleId", "isDraft"])
  .index("by_tagId", ["tagId"])
  .index("by_storeId_tagId_isDraft_publishedAt", [
    "storeId",
    "tagId",
    "isDraft",
    "publishedAt",
  ])
