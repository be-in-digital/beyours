/**
 * Auto Blog Engine — Table Definitions
 *
 * Tables for the premium auto-blog feature:
 * - ownerEntitlements: feature gating per owner (billing-driven)
 * - blogAutoConfig: editorial config per store
 * - blogAutoQueue: job queue for article generation
 * - blogAutoUsage: monthly quota tracking per owner
 */

import { defineTable } from "convex/server"
import { v } from "convex/values"

// ============================================================================
// Owner Entitlements
// ============================================================================

/**
 * Lightweight feature gating for owner accounts.
 * Source of truth: Stripe BeInDigital webhooks (Phase 1B).
 * For now: manually settable by admin.
 * Extensible: other premium features can be added alongside autoBlog.
 */
export const ownerEntitlementsTable = defineTable({
  ownerId: v.string(), // Better Auth userId
  autoBlog: v.object({
    enabled: v.boolean(),
    plan: v.optional(v.union(
      v.literal("starter"),
      v.literal("pro"),
      v.literal("enterprise")
    )), // undefined = no plan
    monthlyQuota: v.number(), // 2, 8, 30
    maxTopics: v.optional(v.number()), // undefined = unlimited
    allowMultiLanguage: v.boolean(),
    allowAutoPublish: v.boolean(),
    monthlyImageQuota: v.optional(v.number()), // 5, 20, 100 — optional for migration safety
  }),
  // Stripe BeInDigital subscription fields
  stripeCustomerId: v.optional(v.string()),    // cus_xxx
  stripeSubscriptionId: v.optional(v.string()), // sub_xxx
  subscriptionStatus: v.optional(v.string()),   // active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused
  // Future: other feature entitlements here (autoEmail, analytics, etc.)
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_ownerId", ["ownerId"])
  .index("by_stripeCustomerId", ["stripeCustomerId"])
  .index("by_stripeSubscriptionId", ["stripeSubscriptionId"])

// ============================================================================
// Blog Auto Config
// ============================================================================

/**
 * Editorial configuration per store.
 * One record per store. Linked to owner via ownerId.
 */
export const blogAutoConfigTable = defineTable({
  ownerId: v.string(),
  storeId: v.id("stores"),
  isEnabled: v.boolean(),
  themes: v.array(v.string()),
  frequency: v.union(v.literal("weekly"), v.literal("monthly")),
  preferredWeekday: v.optional(v.number()), // DEPRECATED — single day, kept for backward compat
  preferredMonthDay: v.optional(v.number()), // DEPRECATED — single day, kept for backward compat
  preferredWeekdays: v.optional(v.array(v.number())), // 0-6, multiple days if weekly
  preferredMonthDays: v.optional(v.array(v.number())), // 1-28, multiple days if monthly
  preferredHour: v.number(), // local hour 0-23
  timezone: v.string(), // e.g. "Europe/Paris"
  tone: v.union(
    v.literal("formel"),
    v.literal("decontracte"),
    v.literal("storytelling")
  ),
  primaryLocale: v.string(),
  autoTranslate: v.boolean(),
  approvalMode: v.union(
    v.literal("draft_review"),
    v.literal("auto_publish")
  ),
  categoryId: v.optional(v.id("blogCategories")),
  targetStoreIds: v.optional(v.array(v.id("stores"))),
  lastPlannedAt: v.optional(v.number()),
  lastGeneratedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_ownerId", ["ownerId"])
  .index("by_isEnabled", ["isEnabled"])

// ============================================================================
// Blog Auto Queue
// ============================================================================

/**
 * Job queue and journal for auto-generated articles.
 * Each record represents one generation job (pending → generating → done/failed).
 */
export const blogAutoQueueTable = defineTable({
  ownerId: v.string(),
  storeId: v.id("stores"),
  configId: v.id("blogAutoConfig"),
  status: v.union(
    v.literal("pending"),
    v.literal("generating"),
    v.literal("draft_created"),
    v.literal("published"),
    v.literal("failed"),
    v.literal("cancelled")
  ),
  scheduledFor: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  theme: v.string(),
  locale: v.string(),
  generatedTitle: v.optional(v.string()),
  generatedSlug: v.optional(v.string()),
  articleId: v.optional(v.id("blogArticles")),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  retryCount: v.number(),
  maxRetries: v.number(), // default 3
  idempotencyKey: v.string(), // e.g. storeId + yyyy-mm + slot + theme
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_status_scheduledFor", ["status", "scheduledFor"])
  .index("by_configId", ["configId"])
  .index("by_idempotencyKey", ["idempotencyKey"])

// ============================================================================
// Blog Auto Usage
// ============================================================================

/**
 * Monthly quota tracking per owner.
 * One record per owner per month (periodKey = "YYYY-MM").
 */
export const blogAutoUsageTable = defineTable({
  ownerId: v.string(),
  periodKey: v.string(), // "2026-02"
  generatedCount: v.number(),
  publishedCount: v.number(),
  imageGeneratedCount: v.optional(v.number()), // optional for migration safety, fallback ?? 0
  updatedAt: v.number(),
}).index("by_ownerId_periodKey", ["ownerId", "periodKey"])
