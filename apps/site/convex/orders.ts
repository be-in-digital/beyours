import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const buyerTypeValidator = v.union(
  v.literal("business"),
  v.literal("personal"),
);
const planValidator = v.union(
  v.literal("essentielle"),
  v.literal("premium"),
);
const orderTypeValidator = v.union(
  v.literal("creation"),
  v.literal("maintenance"),
);
const billingPeriodValidator = v.optional(
  v.union(v.literal("monthly"), v.literal("yearly")),
);
const statusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
);
const paymentMethodValidator = v.union(
  v.literal("card"),
  v.literal("alma"),
  v.literal("klarna"),
);

export const create = internalMutation({
  args: {
    customerEmail: v.string(),
    customerFirstName: v.string(),
    customerLastName: v.string(),
    customerPhone: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    buyerType: buyerTypeValidator,
    siret: v.optional(v.string()),
    plan: planValidator,
    orderType: orderTypeValidator,
    billingPeriod: billingPeriodValidator,
    amountCents: v.number(),
    isFounders: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
    return orderId;
  },
});

export const updateStatus = internalMutation({
  args: {
    orderId: v.id("orders"),
    status: statusValidator,
    paymentMethod: v.optional(paymentMethodValidator),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.paymentMethod) {
      patch.paymentMethod = args.paymentMethod;
    }
    await ctx.db.patch(args.orderId, patch);
  },
});

export const setStripeSessionId = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      stripeSessionId: args.stripeSessionId,
    });
  },
});

export const getByStripeSessionId = internalQuery({
  args: { stripeSessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_stripeSessionId", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId),
      )
      .unique();
  },
});

export const get = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
  },
});

/* ── Checkout success gate ──
   Answers one question for /checkout/success: may this visitor be shown the
   kickoff booking button? Deliberately narrow — it returns a boolean and a
   first name, never the order document, because it is a PUBLIC query and the
   orderId travels in a URL. Anything more (email, phone, SIRET, amount) would
   be readable by anyone holding or guessing an id.

   Takes a raw string rather than v.id so a malformed id returns null instead
   of throwing: the page has to render a refusal, not a server error. */
export const getCheckoutAccess = query({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("orders", args.orderId);
    if (!id) return null;
    const order = await ctx.db.get(id);
    if (!order) return null;
    return {
      paid: order.status === "paid",
      firstName: order.customerFirstName,
    };
  },
});

/* ── Founders offer ──
   Number of founder sales collected. Feeds the public counter
   (« X places restantes ») and the price calculation at checkout.
   Only paid orders consume a slot: two checkouts racing for the last
   place could in theory cross each other, a risk we accept at this
   scale. */

export const countFoundersSold = query({
  args: {},
  handler: async (ctx) => {
    const sold = await ctx.db
      .query("orders")
      .withIndex("by_isFounders_and_status", (q) =>
        q.eq("isFounders", true).eq("status", "paid"),
      )
      .collect();
    return sold.length;
  },
});
