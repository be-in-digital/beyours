/**
 * Payment management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * Get payments by order
 */
export const getByOrder = {
  args: { orderId: v.id("orders") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", args.orderId))
      .collect()
  },
}

/**
 * Get payments by store
 */
export const getByStore = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
}

// === MUTATIONS ===

/**
 * Create a new payment
 */
export const create = {
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
  handler: async (ctx: any, args: any) => {
    if (args.amount <= 0) throw new Error("Payment amount must be positive")
    const now = Date.now()
    return await ctx.db.insert("payments", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update payment status
 */
export const updateStatus = {
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
  handler: async (ctx: any, args: any) => {
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
}

/**
 * Refund a payment
 */
export const refund = {
  args: {
    id: v.id("payments"),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")
    if (args.amount <= 0) throw new Error("Refund amount must be positive")

    const newRefundedAmount = (payment.refundedAmount ?? 0) + args.amount
    if (newRefundedAmount > payment.amount) {
      throw new Error("Refund amount exceeds remaining payment balance")
    }

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
}
