import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const planValidator = v.union(v.literal("essentielle"), v.literal("premium"));
const statusValidator = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("paid"),
  v.literal("void"),
  v.literal("uncollectible"),
);

export const create = internalMutation({
  args: {
    orderId: v.optional(v.id("orders")),
    subscriptionId: v.optional(v.id("subscriptions")),
    stripeInvoiceId: v.string(),
    stripeCustomerId: v.string(),
    customerEmail: v.string(),
    plan: planValidator,
    amountCents: v.number(),
    status: statusValidator,
    invoicePdfUrl: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    paidAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invoices", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    status: statusValidator,
    invoicePdfUrl: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_stripeInvoiceId", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId),
      )
      .unique();
    if (!invoice) return null;

    const patch: Record<string, unknown> = { status: args.status };
    if (args.invoicePdfUrl !== undefined)
      patch.invoicePdfUrl = args.invoicePdfUrl;
    if (args.hostedInvoiceUrl !== undefined)
      patch.hostedInvoiceUrl = args.hostedInvoiceUrl;
    if (args.paidAt !== undefined) patch.paidAt = args.paidAt;

    await ctx.db.patch(invoice._id, patch);
    return invoice._id;
  },
});

export const getByStripeInvoiceId = internalQuery({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_stripeInvoiceId", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId),
      )
      .unique();
  },
});

/* ── Public queries (espace client) ── */

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_customerEmail", (q) =>
        q.eq("customerEmail", args.email),
      )
      .take(50);
  },
});
