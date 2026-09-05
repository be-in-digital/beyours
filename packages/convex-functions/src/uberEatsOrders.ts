/**
 * Uber Eats order management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { allocateOrderNumber } from "./numbering"

/**
 * Save an order from Uber Eats (deduplication by externalOrderId)
 * This is an internalMutation called from the webhook action
 */
export const saveFromPlatform = {
  args: {
    storeId: v.id("stores"),
    externalOrderId: v.string(),
    displayId: v.string(),
    type: v.union(v.literal("delivery"), v.literal("pickup"), v.literal("dine_in")),
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
    customerInfo: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
    }),
    items: v.array(v.object({
      productId: v.id("products"),
      productName: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      selectedOptions: v.array(v.object({
        optionId: v.string(),
        optionName: v.string(),
        choiceId: v.string(),
        choiceName: v.string(),
        priceModifier: v.number(),
      })),
      subtotal: v.number(),
      notes: v.optional(v.string()),
    })),
    subtotal: v.number(),
    taxAmount: v.number(),
    deliveryFee: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    total: v.number(),
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
    source: v.union(v.literal("uber_eats"), v.literal("deliveroo")),
    scheduledFor: v.optional(v.number()),
    estimatedPrepTime: v.optional(v.number()),
  },
  handler: async (ctx: any, args: {
    storeId: string
    externalOrderId: string
    displayId: string
    type: "delivery" | "pickup" | "dine_in"
    status: "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "completed" | "cancelled"
    customerInfo: { name: string; email?: string; phone?: string }
    items: Array<{
      productId: string
      productName: string
      quantity: number
      unitPrice: number
      selectedOptions: Array<{
        optionId: string
        optionName: string
        choiceId: string
        choiceName: string
        priceModifier: number
      }>
      subtotal: number
      notes?: string
    }>
    subtotal: number
    taxAmount: number
    deliveryFee?: number
    discountAmount?: number
    total: number
    deliveryAddress?: {
      street: string
      city: string
      postalCode: string
      country: string
      latitude?: number
      longitude?: number
      instructions?: string
    }
    notes?: string
    source: "uber_eats" | "deliveroo"
    scheduledFor?: number
    estimatedPrepTime?: number
  }) => {
    // Deduplication: a platform retrying a delivery must not create a second
    // order.
    //
    // Read through `by_external_order`, never `by_storeId` + `.filter()`. The
    // filter was a full walk of every order the establishment has ever taken,
    // which put all of them in the transaction's read set — so this mutation
    // conflicted with any concurrent order write in that store, and past the
    // ~16k document read limit it would have started failing permanently, with
    // no alert. `createFromWebhook` was fixed for exactly this and carries the
    // same comment; this twin was missed.
    const existingOrder =
      (
        await ctx.db
          .query("orders")
          .withIndex("by_external_order", (q: any) =>
            q.eq("externalOrderId", args.externalOrderId)
          )
          .collect()
      ).find((order: any) => order.storeId === args.storeId) ?? null

    const now = Date.now()

    if (existingOrder) {
      // Update status only
      await ctx.db.patch(existingOrder._id, {
        status: args.status,
        updatedAt: now,
      })
      return existingOrder._id
    }

    // Create new order
    const globalSettings = await ctx.db.query("globalSettings").first()
    const orderNumber = await allocateOrderNumber(ctx, args.storeId, {
      now,
      timezone: globalSettings?.timezone,
    })
    return await ctx.db.insert("orders", {
      storeId: args.storeId,
      orderNumber,
      customerInfo: args.customerInfo,
      type: args.type,
      status: args.status,
      items: args.items,
      subtotal: args.subtotal,
      taxAmount: args.taxAmount,
      deliveryFee: args.deliveryFee,
      discountAmount: args.discountAmount,
      total: args.total,
      deliveryAddress: args.deliveryAddress,
      paymentMethod: "platform" as const,
      paymentStatus: "paid" as const,
      source: args.source,
      externalOrderId: args.externalOrderId,
      notes: args.notes,
      estimatedPrepTime: args.estimatedPrepTime,
      scheduledFor: args.scheduledFor,
      createdAt: now,
      updatedAt: now,
    })
  },
}
