import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const planValidator = v.union(v.literal("essentielle"), v.literal("premium"));
const billingPeriodValidator = v.union(
  v.literal("monthly"),
  v.literal("yearly"),
);
const statusValidator = v.union(
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("unpaid"),
  v.literal("incomplete"),
);

export const create = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    customerEmail: v.string(),
    plan: planValidator,
    billingPeriod: billingPeriodValidator,
    status: statusValidator,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("subscriptions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: statusValidator,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (!sub) return;

    const patch: Record<string, unknown> = { status: args.status };
    if (args.currentPeriodStart !== undefined)
      patch.currentPeriodStart = args.currentPeriodStart;
    if (args.currentPeriodEnd !== undefined)
      patch.currentPeriodEnd = args.currentPeriodEnd;
    if (args.canceledAt !== undefined) patch.canceledAt = args.canceledAt;

    await ctx.db.patch(sub._id, patch);
  },
});

export const getByStripeSubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
  },
});

export const getByOrderId = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();
  },
});

/* ── No public read here, on purpose ──
   `getByEmail` returned a customer's plan, status and Stripe ids for any email
   passed in. Same shape as the invoices one it sat beside, same absent caller.
   See ./invoices for the rule the client area follows instead. */
