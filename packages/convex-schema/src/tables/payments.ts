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
  // The LAST refund's provider reference. Kept for the screens that already
  // read it; `refunds` below is the record that does not lose history.
  externalRefundId: v.optional(v.string()),
  // Every refund, in order. A scalar `externalRefundId` was overwritten by each
  // partial refund, so a payment refunded twice kept only the second proof and
  // the first became unreconcilable.
  refunds: v.optional(
    v.array(
      v.object({
        amount: v.number(),
        reason: v.optional(v.string()),
        externalRefundId: v.optional(v.string()),
        method: v.union(v.literal("api"), v.literal("manual")),
        // "reserved" is written before the provider is called, so a second
        // concurrent refund sees the balance already committed.
        state: v.union(
          v.literal("reserved"),
          v.literal("confirmed"),
          v.literal("released")
        ),
        at: v.number(),
      })
    )
  ),
  refundedAt: v.optional(v.number()),
  // "api" = confirmed by the provider; "manual" = settled outside the system
  // (cash refunded at the counter) and recorded here on the staff's word.
  refundMethod: v.optional(v.union(v.literal("api"), v.literal("manual"))),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_orderId", ["orderId"])
  .index("by_storeId", ["storeId"])
  // The "Statut" filter on `/dashboard/payments`, answered by the index rather
  // than by reading every payment the store has ever taken and narrowing the
  // list in the browser. Declared since the table was written and used by
  // nothing until the screen was paginated.
  .index("by_storeId_status", ["storeId", "status"])
  // The "Fournisseur" filter, and the two filters together. `provider` sits
  // before `status` so that the provider-only case is an equality on a prefix;
  // status-only keeps the index above. Between them the screen's four filter
  // combinations are all exact index reads, and none of them scans.
  .index("by_storeId_provider_status", ["storeId", "provider", "status"])
  .index("by_externalId", ["externalId"])
