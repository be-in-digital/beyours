import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/orders";
import * as kitchenTicketDefs from "@beindigital-engine/convex-functions/kitchenTickets";
import { v } from "convex/values";

// === Queries (public for storefront) ===

export const list = query(defs.list);

/** Get order by ID with access control (owner via auth OR view token) */
export const getById = query({
  args: {
    id: v.id("orders"),
    viewToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;

    // Access via view token
    if (args.viewToken && order.viewToken === args.viewToken) {
      return order;
    }

    // Access via authenticated owner
    const identity = await ctx.auth.getUserIdentity();
    if (identity && order.customerId === identity.subject) {
      return order;
    }

    // No access
    return null;
  },
});

export const getByCustomer = query(defs.getByCustomer);
export const getByStatus = query(defs.getByStatus);
export const getByViewToken = query(defs.getByViewToken);

/** Get orders for the currently authenticated user (backend deduces user from auth) */
export const getMyOrders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("orders")
      .withIndex("by_customerId", (q) => q.eq("customerId", identity.subject))
      .order("desc")
      .collect();
  },
});

// === Mutations ===

/**
 * Create order + kitchen ticket in a single transaction.
 * The kitchen ticket enables real-time tracking and KDS display.
 */
export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    // 1. Create the order
    const orderId = await defs.create.handler(ctx, args);

    // 2. Fetch the created order to get orderNumber and verified items
    const order = await ctx.db.get(orderId) as any;
    if (!order) throw new Error("Order creation failed");

    // 3. Generate opaque tracking token
    const trackingToken = crypto.randomUUID();

    // 4. Map order items to kitchen ticket format
    const ticketItems = order.items.map((item: any) => ({
      productName: item.productName,
      quantity: item.quantity,
      options: item.selectedOptions?.map(
        (o: any) => `${o.optionName}: ${o.choiceName ?? ""}`
      ) ?? [],
      notes: item.notes,
    }));

    // 5. Create kitchen ticket
    await kitchenTicketDefs.create.handler(ctx, {
      storeId: order.storeId,
      orderId,
      orderNumber: order.orderNumber,
      orderType: order.type,
      items: ticketItems,
      priority: "normal",
      source: "website",
      trackingToken,
      customerName: order.customerInfo?.name,
      customerPhone: order.customerInfo?.phone,
      deliveryNotes: order.notes,
    });

    return orderId;
  },
});

// Protected: Admin only
export const updateStatus = mutation({
  args: defs.updateStatus.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateStatus.handler(ctx, args);
  },
});

export const remove = mutation({
  args: defs.remove.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.remove.handler(ctx, args);
  },
});

// === Internal Queries (for payment actions) ===

/** Get order by ID without auth — used by Stripe/PayPal/SumUp actions */
export const internalGetById = internalQuery({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

// === Internal Mutations (for webhooks and schedulers) ===

export const createFromWebhook = internalMutation(defs.createFromWebhook);
export const updateFromWebhook = internalMutation(defs.updateFromWebhook);

// Internal version of updateStatus for webhooks/schedulers
export const internalUpdateStatus = internalMutation(defs.updateStatus);

/** Update only paymentStatus — used by payment actions and webhooks */
export const internalUpdatePaymentStatus = internalMutation({
  args: {
    id: v.id("orders"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("partially_refunded")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });
  },
});
