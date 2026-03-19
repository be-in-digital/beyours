import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Contact Messages table
 * Stores messages submitted through the storefront contact form.
 */
export const contactMessagesTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  subject: v.string(),
  message: v.string(),
  status: v.union(v.literal("new"), v.literal("read"), v.literal("archived")),
  createdAt: v.number(),
}).index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
