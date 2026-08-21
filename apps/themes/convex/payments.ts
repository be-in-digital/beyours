import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import * as defs from "@be-in-digital/convex-functions/payments";
import {
  requireStoreAccess,
  requireStorePermission,
} from "@be-in-digital/convex-functions/auth";
import {
  planRefund,
  routeRefund,
  type PaymentForRefund,
} from "@be-in-digital/convex-functions/refundPolicy";

export const getByOrder = query({
  args: defs.getByOrder.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.getByOrder.handler(ctx, args);
  },
});

export const getByStore = query({
  args: defs.getByStore.args,
  handler: async (ctx, args) => {
    await requireStoreAccess(ctx, args.storeId);
    return defs.getByStore.handler(ctx, args);
  },
});

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.create.handler(ctx, args);
  },
});

export const updateStatus = mutation({
  args: defs.updateStatus.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateStatus.handler(ctx, args);
  },
});

// === Refunds ===
//
// `payments.refund` used to be a mutation that patched `refundedAmount` and
// flipped the status to "refunded" without calling any provider — the money
// never moved. It also only checked that the caller was logged in, so any
// authenticated account could "refund" any payment of any store.
//
// The public entry point is now an action: it authorises, asks the provider to
// move the money, and only records the refund once the provider confirms.

/** Load a payment for refunding, enforcing store access and `payments:refund`. */
export const internalLoadForRefund = internalQuery({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id);
    if (!payment) throw new Error("Paiement introuvable.");
    await requireStorePermission(ctx, payment.storeId, "payments:refund");
    return payment;
  },
});

/** Write down a refund the provider has already confirmed. */
export const internalRecordRefund = internalMutation(defs.recordRefund);

export const refundPayment = action({
  args: {
    id: v.id("payments"),
    /** Amount in cents. */
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ refundedAmount: number; isFullRefund: boolean }> => {
    const payment = await ctx.runQuery(internal.payments.internalLoadForRefund, {
      id: args.id,
    });

    const forRefund: PaymentForRefund = {
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      refundedAmount: payment.refundedAmount,
      externalId: payment.externalId,
    };

    // Validate before touching the provider: a refund we would refuse to record
    // must never be sent out either.
    const plan = planRefund({ payment: forRefund, amount: args.amount });
    const route = routeRefund(forRefund);

    if (route.kind === "unsupported") {
      throw new Error(route.reason);
    }

    let externalRefundId: string | undefined;

    if (route.kind === "api") {
      const result: { refundId: string } =
        route.provider === "stripe"
          ? await ctx.runAction(internal.stripe.internalRefund, {
              externalId: route.externalId,
              amount: plan.amount,
              reason: args.reason,
            })
          : route.provider === "sumup"
            ? await ctx.runAction(internal.sumup.internalRefund, {
                externalId: route.externalId,
                amount: plan.amount,
              })
            : await ctx.runAction(internal.paypal.internalRefund, {
                captureId: route.externalId,
                amount: plan.amount,
                currency: payment.currency ?? "EUR",
              });

      externalRefundId = result.refundId;
    }

    const recorded = await ctx.runMutation(internal.payments.internalRecordRefund, {
      id: args.id,
      amount: plan.amount,
      reason: args.reason,
      externalRefundId,
      refundMethod: route.kind === "api" ? "api" : "manual",
    });

    return {
      refundedAmount: recorded.refundedAmount,
      isFullRefund: recorded.isFullRefund,
    };
  },
});

// === Internal Mutations (for payment actions and webhooks) ===

/** Create payment record without auth — used by payment verification actions */
export const internalCreate = internalMutation(defs.create);

/** Update payment status without auth — used by webhooks */
export const internalUpdateStatus = internalMutation(defs.updateStatus);
