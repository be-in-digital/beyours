/**
 * Payment management functions
 *
 * NOTE: Originated from packages/convex-functions/src/payments.ts
 * Imports are resolved by Convex in the app's convex/ directory
 */

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// === QUERIES ===

/**
 * Get payments by order
 */
export const getByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect()
  },
})

/**
 * Get payments by store
 */
export const getByStore = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Create a new payment
 */
export const create = mutation({
  args: {
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    currency: v.string(),
    provider: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("cash")
    ),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.object({
      last4: v.optional(v.string()),
      brand: v.optional(v.string()),
      receiptUrl: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("payments", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update payment status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("payments"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("partially_refunded")
    ),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, status, externalId } = args
    const updates: any = {
      status,
      updatedAt: Date.now(),
    }

    if (externalId) {
      updates.externalId = externalId
    }

    await ctx.db.patch(id, updates)
  },
})

/**
 * Refund a payment
 */
export const refund = mutation({
  args: {
    id: v.id("payments"),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    const newRefundedAmount = (payment.refundedAmount ?? 0) + args.amount

    // Determine new status
    let newStatus: "refunded" | "partially_refunded"
    if (newRefundedAmount >= payment.amount) {
      newStatus = "refunded"
    } else {
      newStatus = "partially_refunded"
    }

    await ctx.db.patch(args.id, {
      refundedAmount: newRefundedAmount,
      refundReason: args.reason,
      status: newStatus,
      updatedAt: Date.now(),
    })
  },
})
