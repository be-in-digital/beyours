import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { FOUNDERS_HOLD_MS } from "./foundersOffer";

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

/* ── Founders slots consumed ──
   Counts paid sales AND the checkouts still in flight. It used to see « paid »
   orders only, so every checkout opened before the first webhook landed still
   read ten free slots, and more than ten builds could go out free. A pending
   order now holds its slot for as long as its Stripe session stays payable
   (FOUNDERS_HOLD_MS); past that the customer can no longer pay it and the slot
   returns to the pool on its own — there is no checkout.session.expired
   webhook to release it for us.
   Second layer only: what actually caps the offer is the Stripe coupon's
   max_redemptions (see convex/foundersOffer.ts). This keeps the storefront
   from advertising a slot someone else is already paying for. */
export const countFoundersSold = query({
  args: {},
  handler: async (ctx) => {
    const paid = await ctx.db
      .query("orders")
      .withIndex("by_isFounders_and_status", (q) =>
        q.eq("isFounders", true).eq("status", "paid"),
      )
      .collect();

    const inFlight = await ctx.db
      .query("orders")
      .withIndex("by_isFounders_and_status", (q) =>
        q.eq("isFounders", true).eq("status", "pending"),
      )
      .collect();

    const heldSince = Date.now() - FOUNDERS_HOLD_MS;
    return (
      paid.length + inFlight.filter((o) => o.createdAt >= heldSince).length
    );
  },
});
