import { defineTable } from "convex/server"
import { v } from "convex/values"

// ─── Block validators (reused across templates + campaigns) ───────────────────

const textBlockValidator = v.object({
  type: v.literal("text"),
  id: v.string(),
  content: v.string(),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
})

const imageBlockValidator = v.object({
  type: v.literal("image"),
  id: v.string(),
  url: v.string(),
  alt: v.optional(v.string()),
  linkUrl: v.optional(v.string()),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
  width: v.optional(v.number()),
})

const buttonBlockValidator = v.object({
  type: v.literal("button"),
  id: v.string(),
  text: v.string(),
  url: v.string(),
  backgroundColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
})

const productBlockValidator = v.object({
  type: v.literal("product"),
  id: v.string(),
  productIds: v.array(v.string()),
  layout: v.optional(v.union(v.literal("list"), v.literal("grid"))),
})

const dividerBlockValidator = v.object({
  type: v.literal("divider"),
  id: v.string(),
  color: v.optional(v.string()),
  thickness: v.optional(v.number()),
})

const spacerBlockValidator = v.object({
  type: v.literal("spacer"),
  id: v.string(),
  height: v.optional(v.number()),
})

const headingBlockValidator = v.object({
  type: v.literal("heading"),
  id: v.string(),
  content: v.string(),
  level: v.union(v.literal("h1"), v.literal("h2"), v.literal("h3")),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
  color: v.optional(v.string()),
})

const socialBlockValidator = v.object({
  type: v.literal("social"),
  id: v.string(),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
  links: v.array(
    v.object({
      platform: v.string(),
      url: v.string(),
    })
  ),
  style: v.optional(v.union(v.literal("icons"), v.literal("text"))),
})

const couponBlockValidator = v.object({
  type: v.literal("coupon"),
  id: v.string(),
  code: v.string(),
  description: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
  borderColor: v.optional(v.string()),
})

// Blocks allowed inside columns (subset — no recursive nesting)
const columnChildBlockValidator = v.union(
  textBlockValidator,
  imageBlockValidator,
  buttonBlockValidator,
  headingBlockValidator,
  dividerBlockValidator,
  spacerBlockValidator
)

const columnsBlockValidator = v.object({
  type: v.literal("columns"),
  id: v.string(),
  columns: v.array(v.object({ blocks: v.array(columnChildBlockValidator) })),
  layout: v.union(v.literal("2"), v.literal("3")),
})

const videoBlockValidator = v.object({
  type: v.literal("video"),
  id: v.string(),
  thumbnailUrl: v.string(),
  videoUrl: v.string(),
  alt: v.optional(v.string()),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
})

const heroBlockValidator = v.object({
  type: v.literal("hero"),
  id: v.string(),
  imageUrl: v.string(),
  title: v.string(),
  subtitle: v.optional(v.string()),
  buttonText: v.optional(v.string()),
  buttonUrl: v.optional(v.string()),
  overlayColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
})

const menuHighlightBlockValidator = v.object({
  type: v.literal("menu_highlight"),
  id: v.string(),
  title: v.optional(v.string()),
  items: v.array(
    v.object({
      name: v.string(),
      description: v.optional(v.string()),
      price: v.string(),
      imageUrl: v.optional(v.string()),
    })
  ),
  layout: v.optional(v.union(v.literal("list"), v.literal("grid"))),
  accentColor: v.optional(v.string()),
})

const countdownBlockValidator = v.object({
  type: v.literal("countdown"),
  id: v.string(),
  deadlineDate: v.string(),
  title: v.optional(v.string()),
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
})

const galleryBlockValidator = v.object({
  type: v.literal("gallery"),
  id: v.string(),
  images: v.array(
    v.object({
      url: v.string(),
      alt: v.optional(v.string()),
      linkUrl: v.optional(v.string()),
    })
  ),
  columns: v.optional(v.union(v.literal(2), v.literal(3), v.literal(4))),
  gap: v.optional(v.number()),
})

const locationBlockValidator = v.object({
  type: v.literal("location"),
  id: v.string(),
  address: v.string(),
  city: v.optional(v.string()),
  mapUrl: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
})

const hoursBlockValidator = v.object({
  type: v.literal("hours"),
  id: v.string(),
  title: v.optional(v.string()),
  rows: v.array(
    v.object({
      day: v.string(),
      hours: v.string(),
    })
  ),
  accentColor: v.optional(v.string()),
})

const testimonialBlockValidator = v.object({
  type: v.literal("testimonial"),
  id: v.string(),
  quote: v.string(),
  author: v.string(),
  rating: v.optional(v.number()),
  avatarUrl: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textColor: v.optional(v.string()),
})

const decorativeDividerBlockValidator = v.object({
  type: v.literal("decorative_divider"),
  id: v.string(),
  style: v.union(
    v.literal("dots"),
    v.literal("stars"),
    v.literal("wave"),
    v.literal("diamond")
  ),
  color: v.optional(v.string()),
  alignment: v.optional(
    v.union(v.literal("left"), v.literal("center"), v.literal("right"))
  ),
})

export const emailBlockValidator = v.union(
  textBlockValidator,
  imageBlockValidator,
  buttonBlockValidator,
  productBlockValidator,
  dividerBlockValidator,
  spacerBlockValidator,
  headingBlockValidator,
  socialBlockValidator,
  couponBlockValidator,
  columnsBlockValidator,
  videoBlockValidator,
  heroBlockValidator,
  menuHighlightBlockValidator,
  countdownBlockValidator,
  galleryBlockValidator,
  locationBlockValidator,
  hoursBlockValidator,
  testimonialBlockValidator,
  decorativeDividerBlockValidator
)

// ─── Campaign stats object (shared shape) ─────────────────────────────────────

const campaignStatsValidator = v.object({
  sent: v.number(),
  delivered: v.number(),
  opened: v.number(),
  clicked: v.number(),
  bounced: v.number(),
  unsubscribed: v.number(),
  converted: v.number(),
  revenue: v.number(),
})

// ─── Segment rule validator ───────────────────────────────────────────────────

const segmentRuleValidator = v.object({
  id: v.string(),
  field: v.string(),
  operator: v.union(
    v.literal("equals"),
    v.literal("not_equals"),
    v.literal("gt"),
    v.literal("lt"),
    v.literal("gte"),
    v.literal("lte"),
    v.literal("contains"),
    v.literal("not_contains"),
    v.literal("before"),
    v.literal("after"),
    v.literal("in_last_days")
  ),
  value: v.string(),
})

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * Email subscribers table
 * Manages the mailing list with GDPR compliance (double opt-in, consent tracking)
 */
export const emailSubscribersTable = defineTable({
  storeId: v.id("stores"),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),

  status: v.union(
    v.literal("pending"), // Awaiting double opt-in confirmation
    v.literal("active"), // Confirmed and active
    v.literal("unsubscribed"), // Unsubscribed
    v.literal("bounced"), // Invalid email
    v.literal("complained") // Reported as spam
  ),

  source: v.union(
    v.literal("order"), // Added automatically after a confirmed order
    v.literal("import"), // Imported via CSV
    v.literal("storefront_form"), // Subscribed via storefront form
    v.literal("gamification"), // Collected during a game play
    v.literal("api"), // Added via API
    v.literal("manual") // Added manually by admin
  ),

  tags: v.array(v.string()),

  // GDPR compliance fields
  consentAt: v.number(),
  consentSource: v.string(), // Human-readable description of consent origin
  doubleOptInAt: v.optional(v.number()), // null = pending confirmation
  doubleOptInToken: v.optional(v.string()), // Single-use token, cleared after use
  doubleOptInExpiresAt: v.optional(v.number()), // 48h expiry

  unsubscribedAt: v.optional(v.number()),
  bounceCount: v.number(),

  // Denormalized order metadata — updated incrementally on each confirmed order
  metadata: v.object({
    language: v.optional(v.string()),
    city: v.optional(v.string()),
    totalOrders: v.number(),
    totalSpent: v.number(), // in cents
    lastOrderAt: v.optional(v.number()),
    averageOrderValue: v.number(), // in cents
    favoriteProducts: v.array(v.string()), // product IDs
    orderTypes: v.array(v.string()), // e.g. ["delivery", "dine-in"]
  }),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_storeId_email", ["storeId", "email"])
  .index("by_doubleOptInToken", ["doubleOptInToken"])

/**
 * Email templates table
 * Block-based email templates (text, image, button, product, divider, spacer)
 */
export const emailTemplatesTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  subject: v.string(),
  previewText: v.optional(v.string()),
  blocks: v.array(emailBlockValidator),
  category: v.union(
    v.literal("marketing"),
    v.literal("transactional"),
    v.literal("automation")
  ),
  thumbnailUrl: v.optional(v.string()),
  isDefault: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_category", ["storeId", "category"])

/**
 * Email campaigns table
 * Manages the lifecycle of email campaigns (draft → scheduled → sending → sent)
 * Stats are updated in real-time via incrementStats — never aggregated from emailEvents
 */
export const emailCampaignsTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  subject: v.string(),
  previewText: v.optional(v.string()),
  templateId: v.id("emailTemplates"),

  status: v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("paused"),
    v.literal("cancelled")
  ),

  // null = all active subscribers
  segmentId: v.optional(v.id("emailSegments")),

  scheduledAt: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),

  /**
   * Where the send has got to, as a Convex pagination cursor.
   *
   * Sending used to be one synchronous loop from the browser over the whole
   * list, so there was nowhere to record progress and nothing to resume from:
   * around 3,000 subscribers the action hit the Convex time limit, the campaign
   * stayed at `sending` forever, and the only way out was "Relancer", which
   * started again from the first subscriber.
   */
  sendCursor: v.optional(v.string()),

  // A/B testing
  abTestEnabled: v.boolean(),
  variants: v.optional(
    v.array(
      v.object({
        id: v.string(),
        subject: v.string(),
        percentage: v.number(), // % of audience for this variant
      })
    )
  ),

  // Primary stats source for dashboard — incremented in real-time by SES webhook
  stats: campaignStatsValidator,

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])

/**
 * Email segments table
 * Rule-based audience segmentation with debounced subscriber count cache
 */
export const emailSegmentsTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  description: v.optional(v.string()),
  rules: v.array(segmentRuleValidator),
  ruleOperator: v.union(v.literal("and"), v.literal("or")),
  subscriberCount: v.number(), // Cached count, refreshed periodically
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])

/**
 * Email automations table
 * Trigger-based automated email sequences (welcome, birthday, post-order, etc.)
 */
export const emailAutomationsTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),

  trigger: v.union(
    v.literal("welcome"),
    v.literal("birthday"),
    v.literal("inactive"),
    v.literal("post_order"),
    v.literal("abandoned_cart")
  ),

  status: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("paused")
  ),

  steps: v.array(
    v.object({
      id: v.string(),
      delayMinutes: v.number(), // 0 = immediate
      templateId: v.id("emailTemplates"),
      segmentId: v.optional(v.id("emailSegments")),
    })
  ),

  // Same shape as campaign stats
  stats: campaignStatsValidator,

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_trigger", ["storeId", "trigger"])
  .index("by_storeId_status", ["storeId", "status"])

/**
 * Email events table
 * Granular event tracking — used for subscriber timelines and debug only.
 * Never aggregated for dashboard analytics (use campaign.stats instead).
 * Future: events older than 90 days can be purged (V2).
 */
export const emailEventsTable = defineTable({
  storeId: v.id("stores"),
  campaignId: v.optional(v.id("emailCampaigns")),
  automationId: v.optional(v.id("emailAutomations")),
  subscriberId: v.id("emailSubscribers"),

  type: v.union(
    v.literal("sent"),
    v.literal("delivered"),
    v.literal("opened"),
    v.literal("clicked"),
    v.literal("bounced"),
    v.literal("unsubscribed"),
    v.literal("complained"),
    v.literal("converted")
  ),

  metadata: v.optional(
    v.object({
      linkUrl: v.optional(v.string()),
      orderId: v.optional(v.string()),
      revenue: v.optional(v.number()), // in cents
      userAgent: v.optional(v.string()),
      variantId: v.optional(v.string()), // For A/B testing
    })
  ),

  occurredAt: v.number(),
})
  .index("by_campaignId", ["campaignId"])
  .index("by_subscriberId", ["subscriberId"])
  .index("by_storeId_type", ["storeId", "type"])
  // "Has this campaign already reached this subscriber?" — the question that
  // makes a resumed send idempotent. Answering it from `by_campaignId` would
  // read every event the campaign has produced, once per subscriber, which is
  // quadratic on the exact campaigns that need resuming.
  .index("by_campaignId_subscriberId", ["campaignId", "subscriberId"])

/**
 * Email config table
 * Per-store email marketing configuration (sender, branding, frequency, automations)
 */
export const emailConfigTable = defineTable({
  storeId: v.id("stores"),
  senderName: v.string(),
  replyToEmail: v.string(),
  fromEmail: v.string(), // Must be verified in AWS SES

  branding: v.object({
    logoUrl: v.optional(v.string()),
    primaryColor: v.string(),
    secondaryColor: v.string(),
    footerText: v.optional(v.string()),
    socialLinks: v.optional(
      v.object({
        facebook: v.optional(v.string()),
        instagram: v.optional(v.string()),
        website: v.optional(v.string()),
      })
    ),
  }),

  unsubscribeText: v.string(), // Customizable unsubscribe link text
  maxEmailsPerWeek: v.number(), // Anti-spam: max emails per subscriber per week

  automationSettings: v.object({
    welcomeEnabled: v.boolean(),
    postOrderEnabled: v.boolean(),
    birthdayEnabled: v.boolean(),
    inactiveEnabled: v.boolean(),
    abandonedCartEnabled: v.boolean(),
  }),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
