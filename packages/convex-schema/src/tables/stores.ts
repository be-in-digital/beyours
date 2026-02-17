import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Stores table
 * Each restaurant owner can have unlimited stores.
 * Settings inherit from globalSettings unless overridden.
 */
export const storesTable = defineTable({
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

  // Hours: store-specific or inherited from globalSettings
  useGlobalHours: v.optional(v.boolean()),
  hours: v.array(v.object({
    day: v.number(), // 0=Sunday, 1=Monday, ..., 6=Saturday
    open: v.string(), // "09:00"
    close: v.string(), // "22:00"
    isClosed: v.boolean(),
  })),

  status: v.union(
    v.literal("draft"),
    v.literal("open"),
    v.literal("closed"),
    v.literal("temporarily_unavailable")
  ),

  // Optional overrides for globalSettings values
  // If a field is present here, it overrides the global default
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

  themeId: v.optional(v.string()),

  // Legacy fields (kept for backward compatibility with existing data)
  // Will be removed after data migration
  branding: v.optional(v.any()),
  integrations: v.optional(v.any()),
  settings: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_status", ["status"])
