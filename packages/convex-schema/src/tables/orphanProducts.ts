import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Orphan products table
 * Products imported from platforms that don't match any master catalog product.
 * Requires manual review in the admin UI.
 */
export const orphanProductsTable = defineTable({
  storeId: v.id("stores"),
  platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  externalId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  price: v.number(),
  imageUrl: v.optional(v.string()),
  rawData: v.string(), // JSON-serialized platform-specific data
  status: v.union(
    v.literal("pending"),
    v.literal("matched"),
    v.literal("ignored")
  ),
  matchedProductId: v.optional(v.id("products")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_store_platform", ["storeId", "platform"])
  .index("by_status", ["storeId", "status"])
