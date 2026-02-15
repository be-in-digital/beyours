// NOTE: This file will be copied to the convex/ directory of each app
// Imports will be resolved by Convex

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
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
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
    method: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("cash")
    ),
    currency: v.string(),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("payments", {
      ...args,
      status: "pending",
      refundedAmount: 0,
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

    const newRefundedAmount = payment.refundedAmount + args.amount

    // Determine new status
    let newStatus: "refunded" | "partially_refunded"
    if (newRefundedAmount >= payment.amount) {
      newStatus = "refunded"
    } else {
      newStatus = "partially_refunded"
    }

    await ctx.db.patch(args.id, {
      refundedAmount: newRefundedAmount,
      status: newStatus,
      updatedAt: Date.now(),
    })
  },
})
