import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Payments table
 * Multi-provider payment tracking with refund support
 */
export const paymentsTable = defineTable({
  orderId: v.id("orders"),
  storeId: v.id("stores"),
  amount: v.number(),
  currency: v.string(),
  provider: v.union(
    v.literal("stripe"),
    v.literal("sumup"),
    v.literal("paypal"),
    v.literal("square"),
    v.literal("cash")
  ),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("refunded"),
    v.literal("partially_refunded")
  ),
  externalId: v.optional(v.string()), // Stripe payment intent ID, etc.
  metadata: v.optional(v.object({
    last4: v.optional(v.string()),
    brand: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
  })),
  refundedAmount: v.optional(v.number()),
  refundReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_orderId", ["orderId"])
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_externalId", ["externalId"])
