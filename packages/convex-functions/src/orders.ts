/**
 * Order management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { generateOrderNumber } from "./helpers"

// === QUERIES ===

/**
 * List all orders for a store, ordered by creation date (newest first)
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
}

/**
 * Get order by ID
 */
export const getById = {
  args: { id: v.id("orders") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Get orders by customer
 */
export const getByCustomer = {
  args: { customerId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_customerId", (q: any) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect()
  },
}

/**
 * Get orders by status
 */
export const getByStatus = {
  args: {
    storeId: v.id("stores"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      .order("desc")
      .collect()
  },
}

// === MUTATIONS ===

/**
 * Create a new order
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    customerId: v.optional(v.string()),
    customerInfo: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
    }),
    items: v.array(v.object({
      productId: v.optional(v.id("products")),
      productName: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      selectedOptions: v.array(v.object({
        optionId: v.optional(v.string()),
        optionName: v.string(),
        choiceId: v.optional(v.string()),
        choiceName: v.optional(v.string()),
        priceModifier: v.number(),
      })),
      subtotal: v.number(),
      notes: v.optional(v.string()),
      externalId: v.optional(v.string()),
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
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      instructions: v.optional(v.string()),
    })),
    notes: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Calculate subtotal from items
    const subtotal = args.items.reduce((sum: any, item: any) => sum + item.subtotal, 0)

    // Get store to retrieve tax rate and delivery fee
    const store = await ctx.db.get(args.storeId)
    if (!store) throw new Error("Store not found")

    const taxRate = (store.settings.taxRate ?? 0) / 100
    const deliveryFee = args.type === "delivery" ? (store.settings.deliveryFee ?? 0) : 0

    const taxAmount = Math.round(subtotal * taxRate)
    const total = subtotal + taxAmount + deliveryFee

    const orderNumber = generateOrderNumber()

    return await ctx.db.insert("orders", {
      storeId: args.storeId,
      orderNumber,
      customerId: args.customerId,
      customerInfo: args.customerInfo,
      type: args.type,
      status: "pending",
      items: args.items,
      subtotal,
      taxAmount,
      deliveryFee: args.type === "delivery" ? deliveryFee : undefined,
      total,
      deliveryAddress: args.deliveryAddress,
      paymentMethod: args.paymentMethod,
      paymentStatus: "pending",
      source: "website",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update order status
 */
export const updateStatus = {
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
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
}

/**
 * Delete an order
 */
export const remove = {
  args: { id: v.id("orders") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}

/**
 * Create order from webhook (Uber Eats, Deliveroo, etc.)
 */
export const createFromWebhook = {
  args: {
    storeId: v.id("stores"),
    externalOrderId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    type: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    deliveryAddress: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
    })),
    items: v.array(v.object({
      externalId: v.string(),
      name: v.string(),
      quantity: v.number(),
      price: v.number(),
      modifiers: v.optional(v.array(v.object({
        externalId: v.string(),
        name: v.string(),
        price: v.number(),
      }))),
    })),
    subtotal: v.number(),
    total: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const orderNumber = generateOrderNumber()

    const mappedItems = args.items.map((item: { externalId: string; name: string; quantity: number; price: number; modifiers?: Array<{ externalId: string; name: string; price: number }> }) => {
      const modifierTotal = item.modifiers?.reduce((sum: number, mod: { price: number }) => sum + mod.price, 0) ?? 0
      return {
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        selectedOptions: item.modifiers?.map((mod: { externalId: string; name: string; price: number }) => ({
          optionName: mod.name,
          choiceName: mod.name,
          priceModifier: mod.price,
        })) ?? [],
        subtotal: item.price * item.quantity + modifierTotal,
        externalId: item.externalId,
      }
    })

    // Source mapping: platform "deliveroo" → source "deliveroo", "uberEats" → "uber_eats"
    const sourceMap: Record<string, "website" | "uber_eats" | "deliveroo" | "pos"> = {
      uberEats: "uber_eats",
      deliveroo: "deliveroo",
    }

    return await ctx.db.insert("orders", {
      storeId: args.storeId,
      orderNumber,
      externalOrderId: args.externalOrderId,
      type: args.type,
      status: args.status,
      customerInfo: {
        name: args.customerName,
        phone: args.customerPhone,
        email: args.customerEmail,
      },
      deliveryAddress: args.deliveryAddress,
      items: mappedItems,
      subtotal: args.subtotal,
      taxAmount: 0, // External platforms handle tax separately
      total: args.total,
      source: sourceMap[args.platform] ?? "website",
      notes: args.notes,
      paymentStatus: "paid" as const,
      createdAt: args.createdAt,
      updatedAt: now,
    })
  },
}

/**
 * Update order from webhook
 */
export const updateFromWebhook = {
  args: {
    externalOrderId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    cancellationReason: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const order = await ctx.db
      .query("orders")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("externalOrderId"), args.externalOrderId),
          q.eq(q.field("platform"), args.platform)
        )
      )
      .first()

    if (!order) {
      throw new Error(`Order not found: ${args.externalOrderId}`)
    }

    const updates: any = {
      status: args.status,
      updatedAt: args.updatedAt,
    }

    if (args.status === "completed") {
      updates.completedAt = args.updatedAt
    } else if (args.status === "cancelled") {
      updates.cancelledAt = args.updatedAt
      if (args.cancellationReason) {
        updates.cancellationReason = args.cancellationReason
      }
    }

    await ctx.db.patch(order._id, updates)
    return order._id
  },
}
