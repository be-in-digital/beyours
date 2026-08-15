import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripePaymentIntentId: v.string(),
    stripeSessionId: v.optional(v.string()),
    amountCents: v.number(),
    paymentMethod: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("payments", {
      ...args,
      status: "succeeded",
      paidAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    paymentId: v.id("payments"),
    status: v.union(
      v.literal("pending"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, { status: args.status });
  },
});

export const getByStripePaymentIntentId = internalQuery({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_stripePaymentIntentId", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId),
      )
      .unique();
  },
});
