/**
 * User Profile management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

const phoneValidator = v.object({
  label: v.string(),
  countryCode: v.optional(v.string()),
  number: v.string(),
})

/**
 * How the customer wants to hear about their own orders.
 *
 * Both channels are required once the object is sent, so a caller cannot patch
 * one and silently leave the other at whatever it happened to be: the account
 * screen submits the pair it is showing, which is the pair the customer just
 * read.
 */
export const notificationPreferencesValidator = v.object({
  email: v.boolean(),
  sms: v.boolean(),
})

/** How the customer wants to hear about their own orders. */
export type NotificationPreferences = { email: boolean; sms: boolean }

/**
 * Applied when a profile predates the field: reachable, but not by SMS.
 *
 * Typed rather than `as const` on purpose. `as const` would make these the
 * literal types `true` and `false`, and a `useState` seeded from them infers
 * `useState<true>` — so the switch that reads this default could no longer be
 * turned off.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
}

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
    phones: v.optional(v.array(phoneValidator)),
    avatarUrl: v.optional(v.string()),
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
        phones: args.phones ?? existing.phones,
        avatarUrl: args.avatarUrl ?? existing.avatarUrl,
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
      phones: args.phones ?? [],
      avatarUrl: args.avatarUrl,
      twoFactorEnabled: args.twoFactorEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update profile fields for the authenticated user (name, phones, language, avatar)
 * Does NOT touch role, permissions, or storeIds — those are admin-only.
 */
export const updateProfile = {
  args: {
    userId: v.string(),
    phones: v.optional(v.array(phoneValidator)),
    language: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    notificationPreferences: v.optional(notificationPreferencesValidator),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first()

    const now = Date.now()

    const updates: Record<string, unknown> = { updatedAt: now }
    if (args.phones !== undefined) updates.phones = args.phones
    if (args.language !== undefined) updates.language = args.language
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl
    if (args.notificationPreferences !== undefined) {
      updates.notificationPreferences = args.notificationPreferences
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates)
      return existing._id
    }

    // Auto-create a customer profile if none exists
    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      role: "customer",
      storeIds: [],
      permissions: [],
      language: args.language ?? "fr",
      phones: args.phones ?? [],
      avatarUrl: args.avatarUrl,
      notificationPreferences: args.notificationPreferences,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
  },
}
