/**
 * Payment management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { planRefund } from "./refundPolicy"

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
 * Fetch a single payment. Used by the refund action, which runs in an action
 * context and therefore cannot touch the database directly.
 */
export const getById = {
  args: { id: v.id("payments") },
  handler: async (ctx: any, args: { id: string }) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * RECORD a refund that has already happened.
 *
 * This does NOT move money. It used to be the whole of "refund": a database
 * patch with no provider call anywhere, so the admin read "remboursé" while the
 * customer was never paid back. Money is moved by the `refundPayment` action,
 * which calls the provider first and only then calls this to write down the
 * outcome — with the provider's refund id as proof.
 *
 * `refundMethod: "manual"` is the one case with no provider confirmation: cash
 * handed back at the counter, recorded on the staff's word and labelled as such.
 */
export const recordRefund = {
  args: {
    id: v.id("payments"),
    amount: v.number(),
    reason: v.optional(v.string()),
    externalRefundId: v.optional(v.string()),
    refundMethod: v.union(v.literal("api"), v.literal("manual")),
  },
  handler: async (
    ctx: any,
    args: {
      id: string
      amount: number
      reason?: string
      externalRefundId?: string
      refundMethod: "api" | "manual"
    }
  ) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    // Re-validate against the freshly read document. The action validated too,
    // but a concurrent refund may have landed since — this is the write that
    // must not be allowed to overshoot the balance.
    const plan = planRefund({
      payment: {
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        refundedAmount: payment.refundedAmount,
        externalId: payment.externalId,
      },
      amount: args.amount,
    })

    const now = Date.now()

    await ctx.db.patch(args.id, {
      refundedAmount: plan.refundedAmount,
      refundReason: args.reason,
      status: plan.paymentStatus,
      externalRefundId: args.externalRefundId,
      refundedAt: now,
      refundMethod: args.refundMethod,
      updatedAt: now,
    })

    const orderId = payment.orderId as string
    if (orderId) {
      await ctx.db.patch(orderId, {
        paymentStatus: plan.orderPaymentStatus,
        updatedAt: now,
      })
    }

    return plan
  },
}
