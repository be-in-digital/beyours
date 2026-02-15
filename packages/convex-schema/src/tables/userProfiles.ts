import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * User Profiles table (BeInDigital extension)
 * Extends Better Auth user with roles and permissions
 */
export const userProfilesTable = defineTable({
  userId: v.string(), // Reference to Better Auth component user
  role: v.union(
    v.literal("super_admin"),
    v.literal("client_admin"),
    v.literal("manager"),
    v.literal("kitchen"),
    v.literal("waiter"),
    v.literal("delivery"),
    v.literal("customer")
  ),
  storeIds: v.array(v.id("stores")),
  permissions: v.array(v.string()),
  language: v.string(),
  phone: v.optional(v.string()),
  twoFactorEnabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_role", ["role"])
