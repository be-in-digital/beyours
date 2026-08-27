/**
 * Store management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { isPublishedStore } from "@be-in-digital/convex-schema"

// === QUERIES ===

/**
 * The establishments a visitor may order from.
 *
 * Drafts are removed here, not in the storefront, because this query is the
 * only thing standing between `stores.create` — which opens every new
 * establishment in `draft` — and a "Commander ici" button. Every storefront
 * surface reads this list: the selector page, the header dropdown, the
 * automatic selection, the sitemap. Filtering in any one of them leaves the
 * other three wrong.
 *
 * The admin needs the drafts, and asks `listAll` for them.
 */
export const list = {
  args: {},
  handler: async (ctx: any) => {
    const stores = await ctx.db.query("stores").collect()
    return stores.filter(isPublishedStore)
  },
}

/**
 * Every establishment, drafts included — the administration view.
 *
 * This is the list an owner manages: a draft has to be visible to whoever is
 * about to publish it. The app wrappers gate it on `requireStaff`; nothing
 * customer-facing may call it.
 */
export const listAll = {
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("stores").collect()
  },
}

/**
 * Get store by ID
 */
export const getById = {
  args: { id: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Get store by slug
 */
export const getBySlug = {
  args: { slug: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("stores")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .unique()
  },
}

// === MUTATIONS ===

/**
 * Create a new store
 */
export const create = {
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    address: v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("stores", {
      ...args,
      useGlobalHours: true,
      hours: [
        { day: 0, open: "00:00", close: "00:00", isClosed: true },
        { day: 1, open: "09:00", close: "22:00", isClosed: false },
        { day: 2, open: "09:00", close: "22:00", isClosed: false },
        { day: 3, open: "09:00", close: "22:00", isClosed: false },
        { day: 4, open: "09:00", close: "22:00", isClosed: false },
        { day: 5, open: "09:00", close: "23:00", isClosed: false },
        { day: 6, open: "09:00", close: "23:00", isClosed: false },
      ],
      overrides: undefined,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update store basic information
 */
export const update = {
  args: {
    id: v.id("stores"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    useGlobalHours: v.optional(v.boolean()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("closed"),
      v.literal("temporarily_unavailable")
    )),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Update store opening hours
 */
export const updateHours = {
  args: {
    id: v.id("stores"),
    hours: v.array(v.object({
      day: v.number(),
      open: v.string(),
      close: v.string(),
      isClosed: v.boolean(),
    })),
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, { hours: args.hours, updatedAt: Date.now() })
  },
}

/**
 * Update store overrides (store-specific settings that override global settings)
 */
export const updateOverrides = {
  args: {
    id: v.id("stores"),
    overrides: v.optional(v.object({
      services: v.optional(v.object({
        dineIn: v.boolean(),
        takeaway: v.boolean(),
        delivery: v.boolean(),
        clickAndCollect: v.boolean(),
      })),
      minimumOrderAmount: v.optional(v.number()),
      deliveryRadius: v.optional(v.number()),
      deliveryFee: v.optional(v.number()),
      deliveryFreeAbove: v.optional(v.number()),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { overrides: args.overrides, updatedAt: Date.now() })
  },
}

/**
 * Update store address
 */
export const updateAddress = {
  args: {
    id: v.id("stores"),
    address: v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    }),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { address: args.address, updatedAt: Date.now() })
  },
}

/**
 * Update store print configuration
 */
export const updatePrintConfig = {
  args: {
    id: v.id("stores"),
    printConfig: v.optional(v.object({
      provider: v.union(
        v.literal("browser"),
        v.literal("star_cloud"),
        v.literal("epson_cloud"),
        v.literal("sunmi_cloud")
      ),
      printerId: v.optional(v.string()),
      apiKey: v.optional(v.string()),
      triggers: v.array(v.union(
        v.literal("confirmed"),
        v.literal("ready"),
        v.literal("reprint")
      )),
      paperSize: v.union(v.literal("80mm"), v.literal("58mm")),
      enabled: v.boolean(),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { printConfig: args.printConfig, updatedAt: Date.now() })
  },
}

/**
 * Update store display configuration
 */
export const updateDisplayConfig = {
  args: {
    id: v.id("stores"),
    displayConfig: v.optional(v.object({
      autoDismissEnabled: v.boolean(),
      autoDismissMinutes: v.number(),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { displayConfig: args.displayConfig, updatedAt: Date.now() })
  },
}

/**
 * Update store sound configuration
 */
export const updateSoundConfig = {
  args: {
    id: v.id("stores"),
    soundConfig: v.optional(v.object({
      newTicket: v.object({ enabled: v.boolean(), volume: v.number() }),
      overdue: v.object({ enabled: v.boolean(), volume: v.number() }),
      printerOffline: v.object({ enabled: v.boolean(), volume: v.number() }),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { soundConfig: args.soundConfig, updatedAt: Date.now() })
  },
}

/**
 * Update store order confirmation mode
 */
export const updateOrderConfirmation = {
  args: {
    id: v.id("stores"),
    orderConfirmation: v.union(v.literal("auto"), v.literal("manual")),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { orderConfirmation: args.orderConfirmation, updatedAt: Date.now() })
  },
}

/**
 * Update store global order mode (applies to all sources unless overridden per-platform)
 */
export const updateOrderMode = {
  args: {
    id: v.id("stores"),
    orderMode: v.union(
      v.literal("auto_accept"),
      v.literal("auto_reject"),
      v.literal("manual")
    ),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { orderMode: args.orderMode, updatedAt: Date.now() })
  },
}

/**
 * Update store trending mode (manual or automatic)
 */
export const updateTrendingMode = {
  args: {
    id: v.id("stores"),
    trendingMode: v.union(v.literal("manual"), v.literal("automatic")),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Store not found")
    await ctx.db.patch(args.id, { trendingMode: args.trendingMode, updatedAt: Date.now() })
  },
}

/**
 * Delete a store
 */
export const remove = {
  args: { id: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
