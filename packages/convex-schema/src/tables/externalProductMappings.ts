import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * External product mappings table
 * Links internal products to their platform-specific IDs (Uber Eats, Deliveroo).
 */
export const externalProductMappingsTable = defineTable({
  storeId: v.id("stores"),
  platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  internalProductId: v.id("products"),
  externalId: v.string(),
  externalName: v.optional(v.string()),
  externalPrice: v.optional(v.number()),
  lastSyncAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_store_platform", ["storeId", "platform"])
  .index("by_external", ["platform", "externalId"])
  .index("by_internal", ["internalProductId", "platform"])
