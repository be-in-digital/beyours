# Blog CMS & Media Library v2 — Design Spec

**Date**: 2026-02-27
**Status**: Validated

---

## Understanding Summary

- **What**: Blog CMS for articles + Media Library v2 (image processing + folders)
- **Why**: SEO (Google ranking) + customer communication (news, promotions)
- **Who**: Admins (restaurant owners) create/manage, visitors read
- **Scope**: Blog is global to the brand (brandId), not per store, with optional local targeting
- **Non-goals**: No comments, no dedicated author page, no newsletter/RSS, no composable blocks

---

## Assumptions

- Articles inherit the existing translation system (GPT-3.5-turbo)
- The existing Tiptap rich text editor is reused and extended
- Article images use the existing CMS media library (`cmsMedia`)
- Server-side pagination (Convex cursor-based)
- The existing sitemap will be extended to include articles
- `brandId` is a string that uniquely identifies the brand/tenant

---

## Decision Log

### D1: Blog architecture
- **Decision**: Dedicated tables (Option A), shared infra (cmsMedia, translations, Tiptap, S3)
- **Alternative**: Extending the CMS registry model (Option B)
- **Rationale**: The blog is endless dynamic content, the CMS registry is designed for a finite set of static pages. Dedicated tables = optimized indexes, data model that fits

### D2: Article structure
- **Decision**: Hybrid — fixed skeleton (title, cover, excerpt, author) + free-form rich content area
- **Alternatives**: Simple (title + content), Modular (composable blocks)
- **Rationale**: Balances simplicity and flexibility, without the needless complexity of blocks

### D3: Categorization
- **Decision**: 1 mandatory category + 0..N optional tags
- **Alternatives**: Categories only, tags only
- **Rationale**: Clean navigation (categories) + flexible filtering (tags)

### D4: Tags — join table
- **Decision**: `blogArticleTags` with denormalized `publishedAt`
- **Alternative**: `tagIds` array on the article
- **Rationale**: Efficient pagination/sorting for `/blog/tag/[slug]`, no N+1 and no in-memory sort

### D5: Publication workflow
- **Decision**: Draft -> Scheduled -> Published -> Archived
- **Rationale**: Complete workflow, archived = still reachable by URL, removed from lists

### D6: Draft/Published
- **Decision**: 2 payloads in the same record (`draftContent` / `publishedContent`) + `hasUnpublishedChanges`
- **Alternative**: Single record with status only
- **Rationale**: Lets you edit a published article without breaking the live version

### D7: Versioned fields
- **Decision**: slug, categoryId, authorId all versioned (draft/published)
- **Rationale**: A change made in a draft must not affect the live version

### D8: SEO
- **Decision**: Semi-automatic on the admin side (auto slug, AI meta suggestions) + fully automatic on the system side (sitemap, JSON-LD Article, canonical)
- **Alternative**: Fully manual, fully automatic
- **Rationale**: Balances admin control and technical automation

### D9: Author
- **Decision**: Simple — name + photo, linked to the admin user, versioned
- **Alternative**: Full profile with a dedicated page
- **Rationale**: YAGNI, no author page needed

### D10: Article scope
- **Decision**: Global `brandId` + `scope` (global/store_specific/multi_store) + optional `storeIds`
- **Alternative**: storeId per article
- **Rationale**: Blog is global to the brand, local targeting optional

### D11: Image pipeline
- **Decision**: Hybrid — client-side compression (resize to 2048px, format preserved) + server-side variants (sharp, WebP)
- **Alternatives**: Client only, server only, external CDN
- **Rationale**: Good performance/quality tradeoff, no double lossy pass

### D12: Image variants
- **Decision**: A `variants: { thumb, card, og? }` field instead of individual fields
- **Alternative**: `thumbnailUrl`, `optimizedUrl`, etc.
- **Rationale**: Scalable, extensible without a schema migration

### D13: Media library folders
- **Decision**: Virtual folders (`folder` string field, no dedicated table)
- **Alternative**: A `mediaFolders` table
- **Rationale**: No hierarchy, no metadata, maximum simplicity

### D14: Publish pattern
- **Decision**: `publishArticleCore` (no auth) + admin wrapper + cron internalMutation wrapper
- **Rationale**: Clean separation, the cron does not call an admin mutation

---

## Final Design

### Convex Schema

#### `blogCategories`

```typescript
blogCategories: defineTable({
  brandId: v.string(),
  name: v.string(),
  slug: v.string(),                    // unique per brand, slugified
  description: v.optional(v.string()),
  imageId: v.optional(v.id("cmsMedia")),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_brandId", ["brandId"])
  .index("by_brandId_slug", ["brandId", "slug"])
```

#### `blogTags`

```typescript
blogTags: defineTable({
  brandId: v.string(),
  name: v.string(),
  slug: v.string(),                    // unique per brand, slugified
  createdAt: v.number(),
})
  .index("by_brandId", ["brandId"])
  .index("by_brandId_slug", ["brandId", "slug"])
```

#### `blogArticles`

```typescript
// Shared content shape for draft/published
const blogContentFields = {
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),                 // max ~300 chars
  coverImageId: v.id("cmsMedia"),
  coverImageAlt: v.optional(v.string()),
  content: v.string(),                 // Tiptap HTML
  metaTitle: v.optional(v.string()),   // falls back to title
  metaDescription: v.optional(v.string()), // falls back to excerpt
  ogImageId: v.optional(v.id("cmsMedia")), // falls back to coverImage
  updatedAt: v.number(),
}

blogArticles: defineTable({
  brandId: v.string(),

  // Scope
  scope: v.union(
    v.literal("global"),
    v.literal("store_specific"),
    v.literal("multi_store")
  ),
  storeIds: v.optional(v.array(v.id("stores"))),

  // Workflow
  status: v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("published"),
    v.literal("archived")
  ),
  hasUnpublishedChanges: v.boolean(),
  scheduledPublishAt: v.optional(v.number()), // non-null ONLY if status=scheduled
  publishedAt: v.optional(v.number()),
  archivedAt: v.optional(v.number()),

  // Denormalized slugs (top-level for indexes)
  draftSlug: v.string(),
  publishedSlug: v.optional(v.string()),       // null if never published

  // Versioned category
  draftCategoryId: v.id("blogCategories"),
  publishedCategoryId: v.optional(v.id("blogCategories")), // null if never published

  // Versioned author
  draftAuthorId: v.id("users"),
  publishedAuthorId: v.optional(v.id("users")), // null if never published

  // Payloads
  draftContent: v.object(blogContentFields),
  publishedContent: v.optional(v.object(blogContentFields)), // null if never published

  // Translation (draft-only, cleared on publish)
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),

  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.string(),
})
  .index("by_brandId", ["brandId"])
  .index("by_brandId_status", ["brandId", "status"])
  .index("by_brandId_publishedSlug", ["brandId", "publishedSlug"])
  .index("by_brandId_publishedCategoryId_status_publishedAt", [
    "brandId", "publishedCategoryId", "status", "publishedAt"
  ])
  .index("by_brandId_status_publishedAt", ["brandId", "status", "publishedAt"])
  .index("by_status_scheduledPublishAt", ["status", "scheduledPublishAt"])
```

#### `blogArticleTags`

```typescript
blogArticleTags: defineTable({
  brandId: v.string(),
  articleId: v.id("blogArticles"),
  tagId: v.id("blogTags"),
  isDraft: v.boolean(),
  publishedAt: v.optional(v.number()), // filled only if isDraft=false
})
  .index("by_articleId", ["articleId"])
  .index("by_articleId_isDraft", ["articleId", "isDraft"])
  .index("by_tagId", ["tagId"])
  .index("by_brandId_tagId_isDraft_publishedAt", [
    "brandId", "tagId", "isDraft", "publishedAt"
  ])
```

#### `cmsMedia` — Changes

```typescript
// Added/modified fields:
// - url → sourceUrl
// - thumbnailUrl → REMOVED
// + variants: { thumb?, card?, og? }
// + errorCode?, errorMessage?

// New variants field
variants: v.optional(v.object({
  thumb: v.optional(v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })),
  card: v.optional(v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })),
  og: v.optional(v.object({
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })),
})),
errorCode: v.optional(v.string()),
errorMessage: v.optional(v.string()),

// Updated index
.index("by_brandId_folder", ["brandId", "folder"])
```

---

### Convex Functions

#### Public queries (storefront, no auth)

| Function | Description | Index |
|---|---|---|
| `listPublishedArticles` | Paginated list, status=published, sorted by publishedAt desc | `by_brandId_status_publishedAt` |
| `listByCategory` | Published articles in a category, paginated | `by_brandId_publishedCategoryId_status_publishedAt` |
| `listByTag` | Join lookup (isDraft=false), paginated by publishedAt | `by_brandId_tagId_isDraft_publishedAt` |
| `getArticleBySlug` | Published article by slug + resolved media + translations | `by_brandId_publishedSlug` |
| `listCategories` | All categories for the brand, sorted | `by_brandId` |
| `listTags` | All tags for the brand | `by_brandId` |

#### Admin queries (auth required)

| Function | Description |
|---|---|
| `listAdminArticles` | Paginated + optional `status?` filter |
| `getAdminArticle` | Draft + published side by side, resolved media, translations |
| `listAdminCategories` | Categories with article count |
| `listAdminTags` | Tags with article count |

#### Admin mutations (auth required)

| Function | Key logic |
|---|---|
| `createArticle` | Init draftContent, `status=draft`, slug auto-generated from title, `hasUnpublishedChanges=false` |
| `saveDraft` | Update draft*, recompute `hasUnpublishedChanges`, check slug uniqueness (draft+published), schedule translation |
| `publishArticle` | Auth → `publishArticleCore` |
| `scheduleArticle` | Validate complete draft + future date → `status=scheduled`, set `scheduledPublishAt` |
| `unscheduleArticle` | `status=draft`, `scheduledPublishAt=null` |
| `archiveArticle` | `status=archived`, `archivedAt=now()`, `scheduledPublishAt=null` |
| `unarchiveArticle` | `publishedContent !== null` → published, otherwise → draft |
| `deleteArticle` | Permanent deletion + cleanup of tags + translations + media usageCount |
| `createCategory` | Auto slug, uniqueness validation |
| `updateCategory` | Update name/slug/description/image |
| `deleteCategory` | Blocked if articles are linked |
| `createTag` | Auto slug, uniqueness validation |
| `deleteTag` | Cleanup of `blogArticleTags` |
| `updateArticleTags` | Sync the join table (isDraft=true) — add/remove diff |

#### Internal functions

| Function | Description |
|---|---|
| `publishArticleCore` | Pure logic without auth: copies draft→published (content, slug, category, author), syncs tags (isDraft=false, publishedAt=last publication), syncs translations, `hasUnpublishedChanges=false`, `scheduledTranslationJobId=null`, `scheduledPublishAt=null` |
| `_publishScheduled` | internalMutation → calls publishArticleCore |
| `executeScheduledPublish` | Cron action → query `by_status_scheduledPublishAt` <= now() → `_publishScheduled` per article |

#### Mutation invariants

- `scheduledPublishAt` non-null **only** if `status === "scheduled"`
- `hasUnpublishedChanges` recomputed on every save/publish
- `scheduledTranslationJobId = null` on publish
- Media `usageCount` incremented/decremented on save/publish/delete
- Slug uniqueness checked in `saveDraft` AND in `publishArticleCore`
- `publishedAt` in `blogArticleTags` = date of the last live publication
- `scheduleArticle` validates: complete draftContent + non-null draftCategoryId + strictly future date
- Translations: `entityType: "blogArticleDraft"` / `"blogArticlePublished"` to keep draft/published separate

---

### Image Pipeline (Media Library v2)

#### S3 Keys
```
cms/{mediaId}/source.{ext}     ← format preserved from the client
cms/{mediaId}/thumb.webp        ← 400x400 square, center crop
cms/{mediaId}/card.webp         ← 800x450 landscape
cms/{mediaId}/og.webp           ← 1200x630 (V2)
```

#### Flow
1. `createMedia(status="processing")` → reserves ID + S3 keys
2. Client: compress (resize to 2048px, light compression, source format preserved)
3. `getPresignedUrl(s3Key)` → presigned URL
4. Client: PUT source to S3
5. `confirmUpload(mediaId)` → S3 HEAD request to check existence, otherwise → `setMediaFailed`
6. `processImage` (Convex Node.js action, sharp):
   - Fetch source from S3
   - Extract width/height
   - Generate thumb 400x400 (center crop, WebP)
   - Generate card 800x450 (center crop, WebP)
   - PUT variants to S3
7. `setMediaReady(mediaId, { width, height, sourceUrl, variants })`

#### Rules per type

| Type | Client | Server |
|---|---|---|
| Image (jpeg/png/webp) | Resize to 2048px + compress, format preserved | sharp: dimensions + thumb + card as WebP |
| SVG | Sanitize only | None, status=ready immediately |
| Video | None | None in V1, status=ready immediately |
| File | None | None, status=ready immediately |

#### Pipeline invariants
- `confirmUpload` checks S3 existence (HEAD) before processing
- `setMediaFailed` includes `errorCode` + `errorMessage`
- `processImage` is idempotent (same keys, overwrite, retry safe)

---

### Media Library Folders

#### Model: virtual folders (`folder` string field)
- `null` = root (never `""`)
- Normalization: trim + slugify/lowercase (`"Blog Covers"` → `"blog-covers"`)
- A folder is "born" when a media item gets that value, and "dies" when no media item has it anymore

#### Queries
- `listFolders`: query media by brandId → dedupe folder → returns `{ name, count }[]`
- `listMedia`: adds a `folder?` param to filter

#### Mutations
- `moveToFolder`: update `folder` on one or several media items (bulk)
- `renameFolder`: update `folder` on every media item in the folder (bulk rename)

#### UI
- Left sidebar: folder list + "Tous" + "Nouveau dossier" button
- Multi-select → "Deplacer vers..."
- New folder = target name, an empty folder is shown client-side but not persisted in the backend

---

### Storefront Pages

#### Routes
```
app/blog/page.tsx                    → paginated list
app/blog/[slug]/page.tsx             → full article
app/blog/category/[slug]/page.tsx    → articles by category
app/blog/tag/[slug]/page.tsx         → articles by tag
```

#### Automatic SEO

| Route | meta title | JSON-LD | sitemap |
|---|---|---|---|
| `/blog` | "Blog - {restaurant}" | CollectionPage | yes |
| `/blog/[slug]` | `metaTitle \|\| title` | Article (author, publishedAt, image) | yes (lastmod=updatedAt) |
| `/blog/category/[slug]` | "Categorie: {name}" | CollectionPage | yes |
| `/blog/tag/[slug]` | "Tag: {name}" | CollectionPage | yes |

#### Storefront components
- `BlogArticleCard` — card used in lists (cover `card` variant, title, excerpt, date, category)
- `BlogArticlePage` — full article page (cover, title, author, date, rendered Tiptap content, tags)
- `BlogPagination` — paginated navigation (cursor-based)
- `BlogCategoryFilter` — category list (header or sidebar)

---

## Implementation Priority

### Phase 1: Media Library v2 — Image processing
- Processing pipeline (sharp, variants)
- cmsMedia schema change (sourceUrl, variants, errorCode/errorMessage)
- Updated upload flow (createMedia→upload→confirmUpload→processImage→setMediaReady)

### Phase 2: Media Library v2 — Folders
- Folders UI (sidebar, move, rename)
- Folder normalization (slugify)

### Phase 3: Blog — Schema & Functions
- blogCategories, blogTags, blogArticles, blogArticleTags tables
- All admin mutations (CRUD for categories, tags, articles)
- publishArticleCore + wrappers
- Scheduled publication cron
- Auto-translation

### Phase 4: Blog — Admin UI
- Article list page (paginated, status filter)
- Article editor (fixed skeleton + extended Tiptap)
- Category and tag management
- Preview

### Phase 5: Blog — Storefront
- Routes /blog, /blog/[slug], /blog/category/[slug], /blog/tag/[slug]
- Components (ArticleCard, ArticlePage, Pagination, CategoryFilter)
- SEO (meta, JSON-LD, sitemap, canonical)
