/**
 * Store management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * List all stores
 */
export const list = {
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
    settings: v.optional(v.any()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const { settings, ...rest } = args
    return await ctx.db.insert("stores", {
      ...rest,
      settings: settings ?? undefined,
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
 * Delete a store
 */
export const remove = {
  args: { id: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
