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
  // Proof the money actually moved. The refund used to be a database patch with
  // no provider call at all, so "refunded" meant nothing. These two fields exist
  // so a refund can be reconciled against the provider.
  externalRefundId: v.optional(v.string()),
  refundedAt: v.optional(v.number()),
  // "api" = confirmed by the provider; "manual" = settled outside the system
  // (cash refunded at the counter) and recorded here on the staff's word.
  refundMethod: v.optional(v.union(v.literal("api"), v.literal("manual"))),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_orderId", ["orderId"])
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_externalId", ["externalId"])
