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
/**
 * Commit a refund's amount BEFORE the provider is asked to move the money.
 *
 * `recordRefund` re-validated against a fresh document, so the stored balance
 * could never overshoot — but it ran AFTER the provider call. Two refund
 * requests arriving together both read `refundedAmount: 0`, both passed
 * `planRefund`, and both sent a refund to Stripe. The money left the account
 * twice; the second write then threw and the second refund was never even
 * recorded. The database stayed consistent and the till did not.
 *
 * A Convex mutation is a transaction, so reserving here is the serialisation
 * point: the second caller reads the first caller's committed amount and is
 * refused before anything leaves.
 */
export const reserveRefund = {
  args: {
    id: v.id("payments"),
    amount: v.number(),
    reason: v.optional(v.string()),
    refundMethod: v.union(v.literal("api"), v.literal("manual")),
  },
  handler: async (
    ctx: any,
    args: {
      id: string
      amount: number
      reason?: string
      refundMethod: "api" | "manual"
    }
  ) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

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
    const refunds = [
      ...(payment.refunds ?? []),
      {
        amount: args.amount,
        reason: args.reason,
        method: args.refundMethod,
        state: "reserved" as const,
        at: now,
      },
    ]

    await ctx.db.patch(args.id, {
      refundedAmount: plan.refundedAmount,
      refundReason: args.reason,
      status: plan.paymentStatus,
      refundedAt: now,
      refundMethod: args.refundMethod,
      refunds,
      updatedAt: now,
    })

    const orderId = payment.orderId as string
    if (orderId) {
      await ctx.db.patch(orderId, {
        paymentStatus: plan.orderPaymentStatus,
        updatedAt: now,
      })
    }

    return { plan, index: refunds.length - 1 }
  },
}

/** Attach the provider's reference once the money has actually moved. */
export const confirmRefund = {
  args: {
    id: v.id("payments"),
    index: v.number(),
    externalRefundId: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: { id: string; index: number; externalRefundId?: string }
  ) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    const refunds = [...(payment.refunds ?? [])]
    const entry = refunds[args.index]
    if (!entry) throw new Error("Refund reservation not found")

    refunds[args.index] = {
      ...entry,
      externalRefundId: args.externalRefundId,
      state: "confirmed" as const,
    }

    await ctx.db.patch(args.id, {
      refunds,
      // The scalar keeps pointing at the most recent refund, for the screens
      // that read it; `refunds` is what survives a second partial refund.
      externalRefundId: args.externalRefundId ?? payment.externalRefundId,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Give a reservation back when the provider refused.
 *
 * Without this a failed provider call would leave the amount committed, and the
 * restaurant could never refund it — the balance would say the money was
 * already returned.
 */
export const releaseRefund = {
  args: {
    id: v.id("payments"),
    index: v.number(),
  },
  handler: async (ctx: any, args: { id: string; index: number }) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    const refunds = [...(payment.refunds ?? [])]
    const entry = refunds[args.index]
    if (!entry || entry.state !== "reserved") return

    refunds[args.index] = { ...entry, state: "released" as const }

    const refundedAmount = Math.max(
      0,
      (payment.refundedAmount ?? 0) - entry.amount
    )
    // Back to "succeeded", NOT "completed": `planRefund` only accepts
    // "succeeded" and "partially_refunded", so releasing into "completed" would
    // have made the refund impossible to retry — the exact opposite of the
    // point. A test freezes this.
    const status = refundedAmount === 0 ? "succeeded" : "partially_refunded"

    await ctx.db.patch(args.id, {
      refunds,
      refundedAmount,
      status,
      updatedAt: Date.now(),
    })

    const orderId = payment.orderId as string
    if (orderId) {
      await ctx.db.patch(orderId, {
        paymentStatus: refundedAmount === 0 ? "paid" : "partially_refunded",
        updatedAt: Date.now(),
      })
    }
  },
}

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
