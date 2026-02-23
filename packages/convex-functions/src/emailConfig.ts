/**
 * Email config functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

const brandingValidator = v.object({
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
})

const automationSettingsValidator = v.object({
  welcomeEnabled: v.boolean(),
  postOrderEnabled: v.boolean(),
  birthdayEnabled: v.boolean(),
  inactiveEnabled: v.boolean(),
  abandonedCartEnabled: v.boolean(),
})

// === QUERIES ===

export const get = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailConfig")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .first()
  },
}

// === MUTATIONS ===

export const upsert = {
  args: {
    storeId: v.id("stores"),
    senderName: v.string(),
    replyToEmail: v.string(),
    fromEmail: v.string(),
    branding: brandingValidator,
    unsubscribeText: v.string(),
    maxEmailsPerWeek: v.number(),
    automationSettings: automationSettingsValidator,
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("emailConfig")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now })
      return existing._id
    } else {
      return await ctx.db.insert("emailConfig", {
        ...args,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
}
