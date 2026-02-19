import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Team Members table
 * Links users to stores with specific roles and module-level permissions.
 * Supports invitation flow: a record is created with invitationStatus "pending"
 * and userId is set once the member accepts the invitation.
 */
export const teamMembersTable = defineTable({
  storeId: v.optional(v.id("stores")), // Optional when allStores is true
  allStores: v.boolean(), // true = member has access to all stores in the chain
  userId: v.optional(v.string()), // Set when invitation is accepted
  name: v.string(),
  email: v.string(),
  role: v.union(
    v.literal("manager"),
    v.literal("kitchen"),
    v.literal("waiter"),
    v.literal("delivery")
  ),
  permissions: v.array(v.string()), // Module-level: ["dashboard", "orders", ...]
  invitationStatus: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("expired")
  ),
  invitationToken: v.optional(v.string()),
  invitedAt: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_userId", ["userId"])
  .index("by_storeId_role", ["storeId", "role"])
  .index("by_email", ["email"])
  .index("by_invitationToken", ["invitationToken"])
