/**
 * Owner Entitlements Functions (Package Layer)
 *
 * Pure logic — no auth. Auth is handled in app wrappers.
 * Manages feature entitlements for owner accounts.
 * Currently: autoBlog. Extensible to other premium features.
 */

import { v } from "convex/values"
import { now } from "./helpers"

// ============================================================================
// Validators (reusable)
// ============================================================================

export const autoBlogEntitlementValidator = v.object({
  enabled: v.boolean(),
  plan: v.optional(v.union(
    v.literal("starter"),
    v.literal("pro"),
    v.literal("enterprise")
  )), // undefined = no plan
  monthlyQuota: v.number(),
  maxTopics: v.optional(v.number()), // undefined = unlimited
  allowMultiLanguage: v.boolean(),
  allowAutoPublish: v.boolean(),
  monthlyImageQuota: v.optional(v.number()),
})

export const imageToProductEntitlementValidator = v.object({
  enabled: v.boolean(),
  monthlyAnalysisQuota: v.number(),
})

// ============================================================================
// Queries
// ============================================================================

/** Get entitlements for an owner */
export const getByOwnerId = {
  args: { ownerId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("ownerEntitlements")
      .withIndex("by_ownerId", (q: any) => q.eq("ownerId", args.ownerId))
      .first()
  },
}

// ============================================================================
// Mutations
// ============================================================================

/** Upsert owner entitlements */
export const upsert = {
  args: {
    ownerId: v.string(),
    autoBlog: autoBlogEntitlementValidator,
    imageToProduct: v.optional(imageToProductEntitlementValidator),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("ownerEntitlements")
      .withIndex("by_ownerId", (q: any) => q.eq("ownerId", args.ownerId))
      .first()

    const timestamp = now()

    const patch: Record<string, unknown> = {
      autoBlog: args.autoBlog,
      updatedAt: timestamp,
    }
    if (args.imageToProduct !== undefined) {
      patch.imageToProduct = args.imageToProduct
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
      return existing._id
    }

    return await ctx.db.insert("ownerEntitlements", {
      ownerId: args.ownerId,
      ...patch,
      createdAt: timestamp,
    })
  },
}

// ============================================================================
// Plan Presets (TypeScript constants, not Convex functions)
// ============================================================================

export const PLAN_PRESETS = {
  starter: {
    autoBlog: {
      enabled: true,
      plan: "starter" as const,
      monthlyQuota: 2,
      maxTopics: 3,
      allowMultiLanguage: false,
      allowAutoPublish: false,
      monthlyImageQuota: 5,
    },
    imageToProduct: {
      enabled: true,
      monthlyAnalysisQuota: 3,
    },
  },
  pro: {
    autoBlog: {
      enabled: true,
      plan: "pro" as const,
      monthlyQuota: 8,
      maxTopics: undefined,
      allowMultiLanguage: false,
      allowAutoPublish: true,
      monthlyImageQuota: 20,
    },
    imageToProduct: {
      enabled: true,
      monthlyAnalysisQuota: 15,
    },
  },
  enterprise: {
    autoBlog: {
      enabled: true,
      plan: "enterprise" as const,
      monthlyQuota: 30,
      maxTopics: undefined,
      allowMultiLanguage: true,
      allowAutoPublish: true,
      monthlyImageQuota: 100,
    },
    imageToProduct: {
      enabled: true,
      monthlyAnalysisQuota: 50,
    },
  },
  disabled: {
    autoBlog: {
      enabled: false,
      plan: undefined,
      monthlyQuota: 0,
      maxTopics: undefined,
      allowMultiLanguage: false,
      allowAutoPublish: false,
      monthlyImageQuota: 0,
    },
    imageToProduct: {
      enabled: false,
      monthlyAnalysisQuota: 0,
    },
  },
} as const
