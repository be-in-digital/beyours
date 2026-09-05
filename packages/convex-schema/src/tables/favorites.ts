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
  // Every other store-scoped table can be swept by store id; this one could
  // only be scanned whole, because both compound indexes start with `userId`.
  // Deleting an establishment has to reach these rows (#169).
  .index("by_storeId", ["storeId"])
  // And deleting a single dish has to reach the customers who favourited it.
  // `productId` is a required column, so a favourite left behind holds an id
  // that resolves to nothing. Without this index the cleanup would collect
  // every favourite in the establishment to find the handful pointing at one
  // product — a whole-store read inside a mutation that deletes one row.
  .index("by_productId", ["productId"])
