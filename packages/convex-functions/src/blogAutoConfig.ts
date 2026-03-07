/**
 * Blog Auto Config Functions (Package Layer)
 *
 * Pure logic — no auth. Auth is handled in app wrappers.
 * CRUD for editorial configuration per store.
 */

import { v } from "convex/values"
import { now } from "./helpers"

// ============================================================================
// Queries
// ============================================================================

/** Get auto blog config for a store */
export const getByStoreId = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("blogAutoConfig")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .first()
  },
}

/** List all configs for an owner */
export const listByOwnerId = {
  args: { ownerId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("blogAutoConfig")
      .withIndex("by_ownerId", (q: any) => q.eq("ownerId", args.ownerId))
      .collect()
  },
}

// ============================================================================
// Mutations
// ============================================================================

/** Upsert auto blog config for a store */
export const upsert = {
  args: {
    ownerId: v.string(),
    storeId: v.id("stores"),
    isEnabled: v.boolean(),
    themes: v.array(v.string()),
    frequency: v.union(v.literal("weekly"), v.literal("monthly")),
    preferredWeekdays: v.optional(v.array(v.number())),
    preferredMonthDays: v.optional(v.array(v.number())),
    preferredHour: v.number(),
    timezone: v.string(),
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
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("blogAutoConfig")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .first()

    const timestamp = now()

    if (existing) {
      const { ownerId: _, ...updateFields } = args
      await ctx.db.patch(existing._id, {
        ...updateFields,
        updatedAt: timestamp,
      })
      return existing._id
    }

    return await ctx.db.insert("blogAutoConfig", {
      ...args,
      lastPlannedAt: undefined,
      lastGeneratedAt: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
}
