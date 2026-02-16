/**
 * User Profile management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * Get user profile by Better Auth user ID
 */
export const getByUserId = {
  args: { userId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first()
  },
}

// === MUTATIONS ===

/**
 * Create or update a user profile
 */
export const upsert = {
  args: {
    userId: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("client_admin"),
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery"),
      v.literal("customer")
    ),
    storeIds: v.array(v.id("stores")),
    permissions: v.optional(v.array(v.string())),
    language: v.optional(v.string()),
    phone: v.optional(v.string()),
    twoFactorEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        storeIds: args.storeIds,
        permissions: args.permissions ?? existing.permissions,
        language: args.language ?? existing.language,
        phone: args.phone ?? existing.phone,
        twoFactorEnabled: args.twoFactorEnabled ?? existing.twoFactorEnabled,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      role: args.role,
      storeIds: args.storeIds,
      permissions: args.permissions ?? [],
      language: args.language ?? "fr",
      phone: args.phone,
      twoFactorEnabled: args.twoFactorEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    })
  },
}
