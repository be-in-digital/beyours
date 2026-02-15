/**
 * Team Member management functions
 *
 * NOTE: Originated from packages/convex-functions/src/teamMembers.ts
 * Imports are resolved by Convex in the app's convex/ directory
 */

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// === QUERIES ===

/**
 * List all team members for a store
 */
export const list = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .collect()
  },
})

/**
 * Get team member by user ID
 */
export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
  },
})

/**
 * Get team members by role
 */
export const getByRole = query({
  args: {
    storeId: v.id("stores"),
    role: v.union(
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_storeId_role", (q) =>
        q.eq("storeId", args.storeId).eq("role", args.role)
      )
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Create a new team member
 */
export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.string(),
    role: v.union(
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery")
    ),
    permissions: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("teamMembers", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update team member
 */
export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    role: v.optional(v.union(
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery")
    )),
    permissions: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Team member not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

/**
 * Toggle team member active status
 */
export const toggleActive = mutation({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id)
    if (!member) throw new Error("Team member not found")

    await ctx.db.patch(args.id, {
      isActive: !member.isActive,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete a team member
 */
export const remove = mutation({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
