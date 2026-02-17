import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Global settings table
 * Stores default configuration inherited by all stores.
 * Individual stores can override specific values.
 */
export const globalSettingsTable = defineTable({
  // General
  currency: v.string(), // e.g. "EUR"
  timezone: v.string(), // e.g. "Europe/Paris"
  taxRate: v.number(), // e.g. 20 (percentage)

  // Services
  services: v.object({
    dineIn: v.boolean(),
    takeaway: v.boolean(),
    delivery: v.boolean(),
    clickAndCollect: v.boolean(),
  }),

  minimumOrderAmount: v.optional(v.number()), // in cents

  // Default hours (inherited by stores unless overridden)
  hours: v.array(v.object({
    day: v.number(), // 0=Sunday, 1=Monday, ..., 6=Saturday
    open: v.string(), // "09:00"
    close: v.string(), // "22:00"
    isClosed: v.boolean(),
  })),

  // Delivery settings
  delivery: v.object({
    radius: v.optional(v.number()), // in km
    fee: v.optional(v.number()), // in cents
    freeAbove: v.optional(v.number()), // free delivery above this amount (cents)
  }),

  // Integration credentials (global level)
  integrations: v.object({
    uberDirect: v.optional(v.object({
      customerId: v.optional(v.string()),
      apiKey: v.optional(v.string()),
      enabled: v.boolean(),
    })),
    uberEats: v.optional(v.object({
      enabled: v.boolean(),
    })),
    deliveroo: v.optional(v.object({
      enabled: v.boolean(),
    })),
  }),

  updatedAt: v.number(),
})
