import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import * as defs from "@be-in-digital/convex-functions/payments";
import {
  storeQuery,
  storeMutation,
  storeIdFromDocument,
  storeIdFromField,
} from "./lib/storeFunctions";
import { requireStorePermission } from "@be-in-digital/convex-functions/auth";
import {
  planRefund,
  routeRefund,
  type PaymentForRefund,
} from "@be-in-digital/convex-functions/refundPolicy";

const paymentsStoreId = storeIdFromDocument("Payment not found");
const payments_getByOrderStoreId = storeIdFromField("orderId", "Order not found");

export const getByOrder = storeQuery({
  permission: "payments:read",
  storeIdFrom: payments_getByOrderStoreId,
  args: defs.getByOrder.args,
  handler: (ctx, args) => defs.getByOrder.handler(ctx, args),
});

export const getByStore = storeQuery({
  permission: "payments:read",
  args: defs.getByStore.args,
  handler: (ctx, args) => defs.getByStore.handler(ctx, args),
});

export const create = storeMutation({
  permission: "payments:refund",
  args: defs.create.args,
  handler: (ctx, args) => defs.create.handler(ctx, args),
});

export const updateStatus = storeMutation({
  permission: "payments:refund",
  storeIdFrom: paymentsStoreId,
  args: defs.updateStatus.args,
  handler: (ctx, args) => defs.updateStatus.handler(ctx, args),
});

// === Refunds ===
//
// `payments.refund` used to be a mutation that patched `refundedAmount` and
// flipped the status to "refunded" without calling any provider — the money
// never moved. It was also an `authedMutation`, so any authenticated account
// could "refund" any payment of any store.
//
// The public entry point is now an action: it authorises, asks the provider to
// move the money, and only records the refund once the provider confirms.

/**
 * Load a payment for refunding, enforcing store access and `payments:refund`.
 * Internal, but the caller's identity propagates from the action.
 */
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

/**
 * Refund a payment: authorise, call the provider, then record the outcome.
 *
 * Nothing is written unless the money actually moved — except for cash, which
 * is handed back at the counter and recorded as a manual refund.
 */
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

    // Reached only once the provider confirmed — or for a cash refund, which
    // is explicitly recorded as declared rather than confirmed.
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
