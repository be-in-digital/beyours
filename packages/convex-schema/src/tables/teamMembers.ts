import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Team Members table
 * Links users to stores with specific roles
 */
export const teamMembersTable = defineTable({
  storeId: v.id("stores"),
  userId: v.string(), // Reference to Better Auth component user
  role: v.union(
    v.literal("manager"),
    v.literal("kitchen"),
    v.literal("waiter"),
    v.literal("delivery")
  ),
  permissions: v.array(v.string()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_userId", ["userId"])
  .index("by_storeId_role", ["storeId", "role"])
