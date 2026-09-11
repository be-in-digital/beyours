import { defineTable } from "convex/server"
import { v } from "convex/values"

// ============================================================================
// CMS Block-based system (admin page editor)
// ============================================================================

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
 *   createMedia(status=processing) -> presign -> PUT S3 -> confirmUpload -> processImage -> setMediaReady
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
// Blog tables (admin blog system)
// ============================================================================

/**
 * Blog content fields validator
 * Shared shape for draft/published article payloads
 */
const blogContentFieldsValidator = v.object({
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(), // max ~300 chars
  // Optional on drafts (article creation + auto-blog may start without a cover);
  // publishing enforces its presence (see convex-functions/blogPublish.ts)
  coverImageId: v.optional(v.id("cmsMedia")),
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
 * Workflow: draft -> scheduled -> published -> archived
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

// ============================================================================
// Storefront CMS page tables (per-page localized content)
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Shared CMS validators
// ─────────────────────────────────────────────────────────────────────────────

/** Localized text: { fr: "Bonjour", en: "Hello", ... } */
export const localizedText = v.record(v.string(), v.string())

/** Localized rich text (HTML/markdown per locale) */
export const localizedRichText = v.record(v.string(), v.any())

/** Media asset */
export const media = v.object({
  type: v.union(
    v.literal("image"),
    v.literal("video"),
    v.literal("icon"),
    v.literal("lottie")
  ),
  url: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  alt: v.optional(localizedText),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
})

/** SEO metadata per locale */
export const localizedSeo = v.record(
  v.string(),
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    ogImage: v.optional(v.any()),
  })
)

/** Common page metadata */
export const pageMetadata = {
  version: v.number(),
  status: v.union(v.literal("draft"), v.literal("published")),
  publishedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS Global Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE SIXTEEN LEGACY `cms*` SINGLETONS BELOW HAVE NO READER AND NO WRITER.
 *
 * Measured (#434.7), across every non-schema source in the repository — each
 * engine package, each app's `convex/` and each app's `components/`:
 *
 *     cms, cmsHome, cmsMenu, cmsAbout, cmsContact, cmsBlogPosts, cmsCart,
 *     cmsCheckout, cmsTracking, cmsSignin, cmsSignup, cmsPrivacy, cmsTerms,
 *     cms404, cmsMaintenance, cmsAccount          reads=0  inserts=0
 *
 * They were superseded by the block-based `cmsPages` / `cmsBlocks` / `cmsMedia`
 * and nothing has written one since.
 *
 * WHY THEY ARE STILL DECLARED, which is a decision rather than an omission.
 * Convex refuses a deploy that drops a table while documents exist in it, and
 * "zero writers in this repository" is a measurement of the CODE. It says
 * nothing about a deployment provisioned two years ago against a version that
 * had them — and a schema change that bricks the deploy of a live restaurant
 * is a worse outcome than sixteen empty declarations.
 *
 * WHAT REMOVING THEM ACTUALLY NEEDS, so the next person does not have to
 * rediscover it: a migration that counts the rows on each deployment first,
 * deletes what it finds, and only then drops the declaration — in that order,
 * across every client. `convex/migrations/` is where that goes.
 *
 * WHAT HAS BEEN FIXED HERE IS THE PART THAT REACHED A PERSON. `privacy.ts`
 * listed `cmsHome` as a diner table and printed, on EVERY erasure report, an
 * instruction to check the homepage testimonials by hand — for testimonials
 * that cannot exist. That is worse than noise on a legally-facing document:
 * it makes every erasure read as incomplete, and an operator who checks and
 * finds nothing learns to skip the notes, including the four that are real.
 *
 * They remain in `backupTables.ts`, and that is also deliberate. Exporting an
 * empty table is one paginated read since #432.4, and a backup that silently
 * stopped carrying a table on the strength of "it should be empty" is the
 * trade this comment exists to refuse.
 */

export const cmsTable = defineTable({
  name: v.string(),
  defaultLocale: v.string(),
  supportedLocales: v.array(v.string()),

  identity: v.optional(
    v.object({
      siteName: localizedText,
      description: localizedText,
      logo: v.optional(media),
      favicon: v.optional(media),
    })
  ),

  socials: v.optional(
    v.array(
      v.object({
        platform: v.string(),
        url: v.string(),
        active: v.boolean(),
      })
    )
  ),

  contactInfo: v.optional(
    v.object({
      address: v.optional(localizedText),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      openingHours: v.optional(localizedText),
    })
  ),

  footer: v.optional(
    v.object({
      description: localizedText,
      newsletterTitle: localizedText,
      newsletterDescription: localizedText,
      newsletterPlaceholder: v.optional(localizedText),
      newsletterButtonText: v.optional(localizedText),
      copyrightText: localizedText,
      sections: v.optional(
        v.array(
          v.object({
            title: localizedText,
            links: v.array(
              v.object({
                label: localizedText,
                href: v.string(),
              })
            ),
          })
        )
      ),
    })
  ),

  consent: v.optional(
    v.object({
      title: localizedText,
      description: localizedText,
      acceptButton: localizedText,
      declineButton: localizedText,
      privacyPolicyLabel: localizedText,
      privacyPolicyUrl: v.string(),
    })
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_name", ["name"])

// ─────────────────────────────────────────────────────────────────────────────
// Homepage
// ─────────────────────────────────────────────────────────────────────────────

export const cmsHomeTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    badge: v.optional(localizedText),
    title: localizedText,
    subtitle: localizedText,
    ctaText: localizedText,
    image: v.optional(media),
  }),
  features: v.object({
    sectionTitle: localizedText,
    items: v.array(
      v.object({
        icon: v.string(),
        title: localizedText,
        description: localizedText,
      })
    ),
  }),
  trendingMeals: v.optional(
    v.object({
      sectionTitle: v.optional(localizedText),
      description: v.optional(localizedText),
      viewAllText: v.optional(localizedText),
      isAutomated: v.optional(v.boolean()),
    })
  ),
  categories: v.optional(
    v.object({
      badge: v.optional(localizedText),
      sectionTitle: v.optional(localizedText),
      description: v.optional(localizedText),
    })
  ),
  testimonials: v.optional(
    v.object({
      badge: v.optional(localizedText),
      sectionTitle: localizedText,
      items: v.array(
        v.object({
          quote: localizedText,
          authorName: v.string(),
          authorImage: v.optional(v.string()),
          rating: v.optional(v.number()),
        })
      ),
    })
  ),
  cta: v.object({
    badge: v.optional(localizedText),
    title: localizedText,
    subtitle: localizedText,
    buttonText: localizedText,
    buttonHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Menu Page
// ─────────────────────────────────────────────────────────────────────────────

export const cmsMenuTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    badge: v.optional(localizedText),
    title: localizedText,
    subtitle: localizedText,
  }),
  ui: v.object({
    searchPlaceholder: localizedText,
    addToCartButton: localizedText,
    emptyStateText: localizedText,
    pricePrefix: localizedText,
    filterLabel: v.optional(localizedText),
    sortByLabel: v.optional(localizedText),
  }),
  deliveryApps: v.optional(
    v.object({
      badge: v.optional(localizedText),
      title: localizedText,
      apps: v.array(
        v.object({
          name: v.string(),
          title: localizedText,
          description: localizedText,
          buttonText: localizedText,
          href: v.string(),
          color: v.string(),
          type: v.string(),
        })
      ),
    })
  ),
  cta: v.optional(
    v.object({
      title: localizedText,
      subtitle: localizedText,
      buttonText: localizedText,
      buttonHref: v.string(),
    })
  ),
  blog: v.optional(
    v.object({
      title: localizedText,
      isAutomated: v.optional(v.boolean()),
      viewAllText: v.optional(localizedText),
    })
  ),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// About Page
// ─────────────────────────────────────────────────────────────────────────────

export const cmsAboutTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
  }),
  story: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
    image: v.optional(v.string()),
    features: v.array(localizedText),
  }),
  values: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
    items: v.array(
      v.object({
        icon: v.string(),
        title: localizedText,
        description: localizedText,
        color: v.optional(v.string()),
      })
    ),
  }),
  cta: v.object({
    title: localizedText,
    buttonText: localizedText,
    buttonHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Contact Page
// ─────────────────────────────────────────────────────────────────────────────

export const cmsContactTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
  }),
  formHeader: v.object({
    badge: localizedText,
    title: localizedText,
  }),
  info: v.array(
    v.object({
      icon: v.string(),
      label: localizedText,
      value: v.string(),
      description: localizedText,
      href: v.string(),
      color: v.optional(v.string()),
    })
  ),
  social: v.object({
    title: localizedText,
    links: v.array(v.object({ platform: v.string(), href: v.string() })),
  }),
  chatCta: v.object({
    title: localizedText,
    description: localizedText,
    buttonText: localizedText,
    href: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Blog Posts
// ─────────────────────────────────────────────────────────────────────────────

export const cmsBlogPostsTable = defineTable({
  cmsId: v.id("cms"),
  slug: v.string(),
  title: localizedText,
  excerpt: v.optional(localizedText),
  content: localizedText,
  mainImage: v.optional(v.string()),
  author: v.optional(v.string()),
  category: v.optional(v.string()),
  ...pageMetadata,
})
  .index("by_cms", ["cmsId"])
  .index("by_slug", ["slug"])

// ─────────────────────────────────────────────────────────────────────────────
// Cart
// ─────────────────────────────────────────────────────────────────────────────

export const cmsCartTable = defineTable({
  cmsId: v.id("cms"),
  labels: v.object({
    title: localizedText,
    itemsSelected: localizedText,
    clearAll: localizedText,
    emptyStateTitle: localizedText,
    emptyStateDescription: localizedText,
    emptyStateAction: localizedText,
    subtotal: localizedText,
    delivery: localizedText,
    deliveryFree: localizedText,
    totalPrice: localizedText,
    checkoutBtn: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────────────────────────────────────

export const cmsCheckoutTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    backToMenu: localizedText,
    title: localizedText,
    guestNotice: localizedText,
  }),
  fulfillment: v.object({
    delivery: localizedText,
    pickup: localizedText,
  }),
  sections: v.object({
    contact: v.object({
      title: localizedText,
      description: localizedText,
      emailLabel: localizedText,
      phoneLabel: localizedText,
    }),
    delivery: v.object({
      title: localizedText,
      description: localizedText,
      firstNameLabel: localizedText,
      lastNameLabel: localizedText,
      addressLabel: localizedText,
      cityLabel: localizedText,
      postalCodeLabel: localizedText,
    }),
    payment: v.object({
      title: localizedText,
      description: localizedText,
      cardLabel: localizedText,
      cashLabel: localizedText,
      cashNotice: localizedText,
    }),
  }),
  summary: v.object({
    title: localizedText,
    subtotal: localizedText,
    delivery: localizedText,
    discount: localizedText,
    total: localizedText,
    submitBtn: localizedText,
    calculating: localizedText,
    freeLabel: localizedText,
    promoPlaceholder: localizedText,
    promoBtn: localizedText,
  }),
  success: v.object({
    title: localizedText,
    message: localizedText,
    orderLabel: localizedText,
    homeBtn: localizedText,
    menuBtn: localizedText,
  }),
  empty: v.object({
    title: localizedText,
    description: localizedText,
    action: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Tracking
// ─────────────────────────────────────────────────────────────────────────────

export const cmsTrackingTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    title: localizedText,
    titleHighlight: localizedText,
  }),
  steps: v.object({
    pending: v.object({ label: localizedText, description: localizedText }),
    preparing: v.object({ label: localizedText, description: localizedText }),
    ready: v.object({ label: localizedText, description: localizedText }),
    completed: v.object({ label: localizedText, description: localizedText }),
  }),
  cancelled: v.object({
    title: localizedText,
    description: localizedText,
  }),
  estimatedTime: v.object({ label: localizedText }),
  summary: v.object({
    title: localizedText,
    subtotalLabel: localizedText,
    deliveryLabel: localizedText,
    totalLabel: localizedText,
  }),
  contact: v.object({
    title: localizedText,
    buttonText: localizedText,
  }),
  footer: v.object({
    dateLabel: localizedText,
    backLinkText: localizedText,
  }),
  actions: v.object({
    cancelButton: localizedText,
    cancelConfirmMessage: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Auth pages (sign-in, sign-up)
// ─────────────────────────────────────────────────────────────────────────────

export const cmsSigninTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    title: localizedText,
    subtitle: localizedText,
  }),
  form: v.object({
    emailLabel: localizedText,
    emailPlaceholder: localizedText,
    passwordLabel: localizedText,
    submitButton: localizedText,
    forgotPasswordText: localizedText,
    forgotPasswordHref: v.string(),
  }),
  footer: v.object({
    text: localizedText,
    linkText: localizedText,
    linkHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

export const cmsSignupTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    titleLine1: localizedText,
    titleLine2: localizedText,
  }),
  form: v.object({
    nameLabel: localizedText,
    namePlaceholder: localizedText,
    emailLabel: localizedText,
    emailPlaceholder: localizedText,
    passwordLabel: localizedText,
    confirmLabel: localizedText,
    submitButton: localizedText,
  }),
  footer: v.object({
    text: localizedText,
    linkText: localizedText,
    linkHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Legal pages (privacy, terms)
// ─────────────────────────────────────────────────────────────────────────────

export const cmsPrivacyTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    badge: localizedText,
    title: localizedText,
    lastUpdatedLabel: localizedText,
  }),
  intro: v.object({ text: localizedRichText }),
  sections: v.array(
    v.object({
      icon: v.string(),
      title: localizedText,
      content: localizedRichText,
    })
  ),
  footer: v.object({
    copyright: localizedText,
    legalNote: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

export const cmsTermsTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    badge: localizedText,
    title: localizedText,
    lastUpdatedLabel: localizedText,
  }),
  intro: v.object({ text: localizedRichText }),
  sections: v.array(
    v.object({
      icon: v.string(),
      title: localizedText,
      content: localizedRichText,
    })
  ),
  footer: v.object({
    copyright: localizedText,
    legalNote: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Error & Maintenance pages
// ─────────────────────────────────────────────────────────────────────────────

export const cms404Table = defineTable({
  cmsId: v.id("cms"),
  errorCode: localizedText,
  title: localizedText,
  description: localizedText,
  actionText: localizedText,
  actionLink: v.string(),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

export const cmsMaintenanceTable = defineTable({
  cmsId: v.id("cms"),
  enabled: v.boolean(),
  title: localizedText,
  description: localizedText,
  estimatedEndTime: v.optional(localizedText),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Account pages
// ─────────────────────────────────────────────────────────────────────────────

export const cmsAccountTable = defineTable({
  cmsId: v.id("cms"),
  menu: v.object({
    profile: localizedText,
    orders: localizedText,
    favorites: localizedText,
    addresses: localizedText,
    logout: localizedText,
  }),
  profile: v.object({
    title: localizedText,
    description: localizedText,
    labels: v.object({
      fullName: localizedText,
      email: localizedText,
      phone: localizedText,
      saveBtn: localizedText,
    }),
  }),
  orders: v.object({
    title: localizedText,
    description: localizedText,
    emptyTitle: localizedText,
    emptyDesc: localizedText,
    emptyAction: localizedText,
    status: v.object({
      pending: localizedText,
      preparing: localizedText,
      ready: localizedText,
      completed: localizedText,
      cancelled: localizedText,
    }),
  }),
  addresses: v.object({
    title: localizedText,
    description: localizedText,
    addBtn: localizedText,
    emptyTitle: localizedText,
    emptyDesc: localizedText,
  }),
  favorites: v.object({
    title: localizedText,
    description: localizedText,
    emptyTitle: localizedText,
    emptyDesc: localizedText,
    emptyAction: localizedText,
  }),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])
