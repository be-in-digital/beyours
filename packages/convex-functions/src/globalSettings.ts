/**
 * Global settings management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * Get the global settings (there's only one row)
 */
export const get = {
  args: {},
  handler: async (ctx: any) => {
    const settings = await ctx.db.query("globalSettings").first()
    return settings
  },
}

// === MUTATIONS ===

/**
 * Create or update global settings
 * Uses upsert pattern: if settings exist, patch them; otherwise create new
 */
export const upsert = {
  args: {
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    services: v.optional(v.object({
      dineIn: v.boolean(),
      takeaway: v.boolean(),
      delivery: v.boolean(),
      clickAndCollect: v.boolean(),
    })),
    minimumOrderAmount: v.optional(v.number()),
    hours: v.optional(v.array(v.object({
      day: v.number(),
      open: v.string(),
      close: v.string(),
      isClosed: v.boolean(),
    }))),
    delivery: v.optional(v.object({
      feeMode: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
      fee: v.optional(v.number()),
      percentage: v.optional(v.number()),
      maxFee: v.optional(v.number()),
      freeAbove: v.optional(v.number()),
      radius: v.optional(v.number()),
    })),
    payments: v.optional(v.object({
      cardProvider: v.union(v.literal("stripe"), v.literal("sumup")),
      paypal: v.boolean(),
      paypalEmail: v.optional(v.string()),
      cash: v.boolean(),
    })),
    integrations: v.optional(v.object({
      uberDirect: v.optional(v.object({
        customerId: v.optional(v.string()),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
        enabled: v.boolean(),
      })),
      uberEats: v.optional(v.object({
        enabled: v.boolean(),
      })),
      deliveroo: v.optional(v.object({
        enabled: v.boolean(),
      })),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.query("globalSettings").first()
    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: Date.now() }
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined) {
          updates[key] = value
        }
      }
      await ctx.db.patch(existing._id, updates)
      return existing._id
    }
    // Create with defaults
    return await ctx.db.insert("globalSettings", {
      currency: args.currency ?? "EUR",
      timezone: args.timezone ?? "Europe/Paris",
      taxRate: args.taxRate ?? 20,
      services: args.services ?? {
        dineIn: true,
        takeaway: true,
        delivery: false,
        clickAndCollect: false,
      },
      minimumOrderAmount: args.minimumOrderAmount,
      hours: args.hours ?? [
        { day: 0, open: "00:00", close: "00:00", isClosed: true },
        { day: 1, open: "09:00", close: "22:00", isClosed: false },
        { day: 2, open: "09:00", close: "22:00", isClosed: false },
        { day: 3, open: "09:00", close: "22:00", isClosed: false },
        { day: 4, open: "09:00", close: "22:00", isClosed: false },
        { day: 5, open: "09:00", close: "23:00", isClosed: false },
        { day: 6, open: "09:00", close: "23:00", isClosed: false },
      ],
      delivery: args.delivery ?? { feeMode: "fixed", radius: 10, fee: 350, freeAbove: 3000 },
      payments: args.payments ?? { cardProvider: "stripe", paypal: false, cash: false },
      integrations: args.integrations ?? {},
      updatedAt: Date.now(),
    })
  },
}
