import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * User Profiles table (BeYours extension)
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
  phones: v.optional(v.array(v.object({
    label: v.string(),                    // e.g. "Personnel", "Travail", "Autre"
    countryCode: v.optional(v.string()),  // e.g. "+33" (optional for backward compat)
    number: v.string(),                   // local number e.g. "6 12 34 56 78"
  }))),
  avatarUrl: v.optional(v.string()),
  /**
   * How this person wants to be reached about their own orders.
   *
   * Optional because every profile written before this field existed predates
   * the choice, and a missing value is not the same as a refusal: the reader
   * applies the defaults rather than treating absence as "contact me by
   * nothing". Marketing consent is not this — that lives in
   * `emailSubscribers`, behind a double opt-in, and must not be inferred from
   * a transactional preference.
   */
  notificationPreferences: v.optional(v.object({
    email: v.boolean(),
    sms: v.boolean(),
  })),
  twoFactorEnabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_role", ["role"])
