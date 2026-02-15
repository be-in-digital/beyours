import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Stores table
 * Each restaurant owner can have unlimited stores
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
  hours: v.array(v.object({
    day: v.number(), // 0=Sunday, 6=Saturday
    open: v.string(), // "09:00"
    close: v.string(), // "22:00"
    isClosed: v.boolean(),
  })),
  status: v.union(
    v.literal("open"),
    v.literal("closed"),
    v.literal("temporarily_unavailable")
  ),
  branding: v.object({
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    fontHeading: v.optional(v.string()),
    fontBody: v.optional(v.string()),
  }),
  settings: v.object({
    currency: v.string(),
    timezone: v.string(),
    deliveryEnabled: v.boolean(),
    pickupEnabled: v.boolean(),
    dineInEnabled: v.boolean(),
    minimumOrderAmount: v.optional(v.number()),
    deliveryFee: v.optional(v.number()),
    deliveryRadius: v.optional(v.number()),
    taxRate: v.optional(v.number()),
  }),
  integrations: v.object({
    uberEats: v.optional(v.object({
      enabled: v.boolean(),
      storeId: v.optional(v.string()),
      autoAccept: v.boolean(),
    })),
    deliveroo: v.optional(v.object({
      enabled: v.boolean(),
      storeId: v.optional(v.string()),
      autoAccept: v.boolean(),
    })),
  }),
  themeId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_status", ["status"])
