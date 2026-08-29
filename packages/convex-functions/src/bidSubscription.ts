/**
 * BeYours Subscription Functions (Package Layer)
 *
 * Pure logic — no auth, no Stripe SDK.
 * Manages the mapping between Stripe subscriptions and ownerEntitlements.
 * Called from app-layer actions (checkout, portal, webhook processor).
 */

import { v } from "convex/values"
import { PLAN_PRESETS } from "./ownerEntitlements"
import { now } from "./helpers"

// ============================================================================
// Types
// ============================================================================

type AutoBlogPlan = "starter" | "pro" | "enterprise"

/** Mapping strict priceId → plan */
export type StripePriceMap = Record<string, AutoBlogPlan>

// ============================================================================
// Pure Functions
// ============================================================================

/** Resolve plan from a Stripe price ID. Returns undefined if priceId unknown. */
export function resolvePlanFromPriceId(
  priceId: string,
  priceMap: StripePriceMap
): AutoBlogPlan | undefined {
  return priceMap[priceId]
}

/** Build StripePriceMap from env vars (monthly + annual prices) */
export function buildPriceMap(env: {
  STRIPE_BID_PRICE_STARTER?: string
  STRIPE_BID_PRICE_PRO?: string
  STRIPE_BID_PRICE_ENTERPRISE?: string
  STRIPE_BID_PRICE_STARTER_ANNUAL?: string
  STRIPE_BID_PRICE_PRO_ANNUAL?: string
  STRIPE_BID_PRICE_ENTERPRISE_ANNUAL?: string
}): StripePriceMap {
  const map: StripePriceMap = {}
  // Monthly prices
  if (env.STRIPE_BID_PRICE_STARTER) map[env.STRIPE_BID_PRICE_STARTER] = "starter"
  if (env.STRIPE_BID_PRICE_PRO) map[env.STRIPE_BID_PRICE_PRO] = "pro"
  if (env.STRIPE_BID_PRICE_ENTERPRISE) map[env.STRIPE_BID_PRICE_ENTERPRISE] = "enterprise"
  // Annual prices (same plan, different billing interval)
  if (env.STRIPE_BID_PRICE_STARTER_ANNUAL) map[env.STRIPE_BID_PRICE_STARTER_ANNUAL] = "starter"
  if (env.STRIPE_BID_PRICE_PRO_ANNUAL) map[env.STRIPE_BID_PRICE_PRO_ANNUAL] = "pro"
  if (env.STRIPE_BID_PRICE_ENTERPRISE_ANNUAL) map[env.STRIPE_BID_PRICE_ENTERPRISE_ANNUAL] = "enterprise"
  return map
}

export type BillingInterval = "monthly" | "annual"

/** Resolve priceId from plan name + billing interval + env vars. Throws if env var missing. */
export function resolvePriceIdFromPlan(
  plan: AutoBlogPlan,
  env: {
    STRIPE_BID_PRICE_STARTER?: string
    STRIPE_BID_PRICE_PRO?: string
    STRIPE_BID_PRICE_ENTERPRISE?: string
    STRIPE_BID_PRICE_STARTER_ANNUAL?: string
    STRIPE_BID_PRICE_PRO_ANNUAL?: string
    STRIPE_BID_PRICE_ENTERPRISE_ANNUAL?: string
  },
  billing: BillingInterval = "monthly"
): string {
  const suffix = billing === "annual" ? "_ANNUAL" : ""
  const monthlyMap: Record<AutoBlogPlan, string | undefined> = {
    starter: env.STRIPE_BID_PRICE_STARTER,
    pro: env.STRIPE_BID_PRICE_PRO,
    enterprise: env.STRIPE_BID_PRICE_ENTERPRISE,
  }
  const annualMap: Record<AutoBlogPlan, string | undefined> = {
    starter: env.STRIPE_BID_PRICE_STARTER_ANNUAL,
    pro: env.STRIPE_BID_PRICE_PRO_ANNUAL,
    enterprise: env.STRIPE_BID_PRICE_ENTERPRISE_ANNUAL,
  }
  const priceId = billing === "annual" ? annualMap[plan] : monthlyMap[plan]
  if (!priceId) throw new Error(`STRIPE_BID_PRICE_${plan.toUpperCase()}${suffix} non configure`)
  return priceId
}

// ============================================================================
// Queries
// ============================================================================

/** Get entitlements by Stripe customer ID */
export const getByStripeCustomerId = {
  args: { stripeCustomerId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("ownerEntitlements")
      .withIndex("by_stripeCustomerId", (q: any) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first()
  },
}

/** Get entitlements by Stripe subscription ID */
export const getByStripeSubscriptionId = {
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("ownerEntitlements")
      .withIndex("by_stripeSubscriptionId", (q: any) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first()
  },
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Attach a stripeCustomerId to an existing (or new) ownerEntitlements record.
 * Called IMMEDIATELY after stripe.customers.create(), BEFORE the checkout session.
 * Prevents duplicate Stripe customers if the user abandons and retries.
 */
export const attachStripeCustomerId = {
  args: {
    ownerId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("ownerEntitlements")
      .withIndex("by_ownerId", (q: any) => q.eq("ownerId", args.ownerId))
      .first()

    const timestamp = now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        updatedAt: timestamp,
      })
      return existing._id
    }

    // First time: create minimal record with disabled plan
    return await ctx.db.insert("ownerEntitlements", {
      ownerId: args.ownerId,
      autoBlog: PLAN_PRESETS.disabled.autoBlog,
      imageToProduct: PLAN_PRESETS.disabled.imageToProduct,
      stripeCustomerId: args.stripeCustomerId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
}

/**
 * Upsert ownerEntitlements from a Stripe webhook event.
 * Lookup priority: stripeSubscriptionId → stripeCustomerId → ownerId (first checkout only).
 */
export const upsertFromStripe = {
  args: {
    ownerId: v.optional(v.string()),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    subscriptionStatus: v.string(),
    plan: v.optional(
      v.union(
        v.literal("starter"),
        v.literal("pro"),
        v.literal("enterprise")
      )
    ),
  },
  handler: async (ctx: any, args: any) => {
    // 1. Lookup existing record
    let existing = await ctx.db
      .query("ownerEntitlements")
      .withIndex("by_stripeSubscriptionId", (q: any) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first()

    if (!existing) {
      existing = await ctx.db
        .query("ownerEntitlements")
        .withIndex("by_stripeCustomerId", (q: any) =>
          q.eq("stripeCustomerId", args.stripeCustomerId)
        )
        .first()
    }

    if (!existing && args.ownerId) {
      existing = await ctx.db
        .query("ownerEntitlements")
        .withIndex("by_ownerId", (q: any) =>
          q.eq("ownerId", args.ownerId)
        )
        .first()
    }

    // 2. Determine plan preset
    const preset = args.plan
      ? PLAN_PRESETS[args.plan as AutoBlogPlan]
      : PLAN_PRESETS.disabled

    const timestamp = now()

    const stripeFields = {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionStatus: args.subscriptionStatus,
    }

    // 3. Patch or insert
    if (existing) {
      await ctx.db.patch(existing._id, {
        autoBlog: preset.autoBlog,
        imageToProduct: preset.imageToProduct,
        ...stripeFields,
        updatedAt: timestamp,
      })
      return existing._id
    }

    // No existing record — create new (should be rare, attachStripeCustomerId usually runs first)
    if (!args.ownerId) {
      throw new Error("Impossible de créer un entitlement sans ownerId")
    }

    return await ctx.db.insert("ownerEntitlements", {
      ownerId: args.ownerId,
      autoBlog: preset.autoBlog,
      imageToProduct: preset.imageToProduct,
      ...stripeFields,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
}
