// NOTE: This file will be copied to the convex/ directory of each app
// Imports will be resolved by Convex

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { generateOrderNumber } from "./helpers"

// === QUERIES ===

/**
 * List all orders for a store, ordered by creation date (newest first)
 */
export const list = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
})

/**
 * Get order by ID
 */
export const getById = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

/**
 * Get orders by customer
 */
export const getByCustomer = query({
  args: { customerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect()
  },
})

/**
 * Get orders by status
 */
export const getByStatus = query({
  args: {
    storeId: v.id("stores"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.eq(q.field("status"), args.status))
      .order("desc")
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Create a new order
 */
export const create = mutation({
  args: {
    storeId: v.id("stores"),
    customerId: v.optional(v.string()),
    customer: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.string(),
    }),
    items: v.array(v.object({
      productId: v.id("products"),
      name: v.string(),
      quantity: v.number(),
      price: v.number(),
      selectedOptions: v.optional(v.array(v.object({
        optionId: v.string(),
        optionName: v.string(),
        choiceId: v.string(),
        choiceName: v.string(),
        price: v.number(),
      }))),
      notes: v.optional(v.string()),
    })),
    type: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    deliveryAddress: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      instructions: v.optional(v.string()),
    })),
    pickupTime: v.optional(v.string()),
    tableNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentMethod: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("cash")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Calculate subtotal from items
    const subtotal = args.items.reduce((sum, item) => {
      const itemPrice = item.price * item.quantity
      const optionsPrice = (item.selectedOptions ?? []).reduce(
        (optSum, opt) => optSum + opt.price * item.quantity,
        0
      )
      return sum + itemPrice + optionsPrice
    }, 0)

    // Get store to retrieve tax rate and delivery fee
    const store = await ctx.db.get(args.storeId)
    if (!store) throw new Error("Store not found")

    const taxRate = store.settings.taxRate ?? 0
    const deliveryFee = args.type === "delivery" ? (store.settings.deliveryFee ?? 0) : 0

    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount + deliveryFee

    const orderNumber = generateOrderNumber()

    return await ctx.db.insert("orders", {
      ...args,
      orderNumber,
      subtotal,
      taxAmount,
      deliveryFee,
      total,
      status: "pending",
      paymentStatus: "pending",
      source: "website",
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update order status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id)
    if (!order) throw new Error("Order not found")

    const now = Date.now()
    const updates: any = {
      status: args.status,
      updatedAt: now,
    }

    // Set timestamps based on status
    if (args.status === "completed") {
      updates.completedAt = now
    } else if (args.status === "cancelled") {
      updates.cancelledAt = now
      if (args.cancellationReason) {
        updates.cancellationReason = args.cancellationReason
      }
    }

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Delete an order
 */
export const remove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
