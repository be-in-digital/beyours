import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Favorites table — stores user product favorites
 *
 * Each row represents a single user-product-store favorite.
 * Compound index ensures uniqueness per (userId, productId, storeId).
 */
export const favoritesTable = defineTable({
  userId: v.string(),
  productId: v.id("products"),
  storeId: v.id("stores"),
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_storeId", ["userId", "storeId"])
  .index("by_userId_productId_storeId", ["userId", "productId", "storeId"])
