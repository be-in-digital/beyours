import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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
    invoiceNumber: v.optional(v.string()),
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
    /* Stripe assigns the number when the invoice leaves draft, so an invoice
       first seen as a draft only gets it on a later event. */
    invoiceNumber: v.optional(v.string()),
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
    if (args.invoiceNumber !== undefined)
      patch.invoiceNumber = args.invoiceNumber;
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

/* ── No public read here, on purpose ──
   `getByEmail` took an arbitrary email and returned up to 50 invoices with
   their `invoicePdfUrl` and `hostedInvoiceUrl` — a customer's whole billing
   history, and the PDFs themselves, to anyone who knew their address. The
   deployment URL ships in the browser bundle, so "public query" means public.
   It was written for a customer area that does not exist and had no caller.

   The client area, when it arrives, derives the email from the authenticated
   session — never from an argument. */
