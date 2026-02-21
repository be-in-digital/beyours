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
  handler: async (ctx: any, args: { orderId: string }) => {
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
  handler: async (ctx: any, args: { storeId: string }) => {
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
  handler: async (ctx: any, args: { storeId: string; orderId: string; amount: number; currency: string; provider: string; externalId?: string; metadata?: { last4?: string; brand?: string; receiptUrl?: string } }) => {
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
  handler: async (ctx: any, args: { id: string; status: string; externalId?: string }) => {
    const { id, status, externalId } = args
    const updates: Record<string, unknown> = {
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
 * Refund a payment and sync paymentStatus on the linked order
 */
export const refund = {
  args: {
    id: v.id("payments"),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: { id: string; amount: number; reason?: string }) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")
    if (args.amount <= 0) throw new Error("Refund amount must be positive")

    const currentRefunded = (payment.refundedAmount as number | undefined) ?? 0
    const paymentAmount = payment.amount as number
    const newRefundedAmount = currentRefunded + args.amount
    if (newRefundedAmount > paymentAmount) {
      throw new Error("Refund amount exceeds remaining payment balance")
    }

    // Determine new payment status
    const isFullRefund = newRefundedAmount >= paymentAmount
    const newPaymentStatus = isFullRefund ? "refunded" : "partially_refunded"

    // Update payment record
    await ctx.db.patch(args.id, {
      refundedAmount: newRefundedAmount,
      refundReason: args.reason,
      status: newPaymentStatus,
      updatedAt: Date.now(),
    })

    // Sync paymentStatus on the linked order
    const orderId = payment.orderId as string
    if (orderId) {
      const orderPaymentStatus = isFullRefund ? "refunded" : "partially_refunded"
      await ctx.db.patch(orderId, {
        paymentStatus: orderPaymentStatus,
        updatedAt: Date.now(),
      })
    }
  },
}
