import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Orders table
 * Complete order lifecycle with multi-source support
 */
export const ordersTable = defineTable({
  storeId: v.id("stores"),
  orderNumber: v.string(), // ex: "ORD-2026-0001"
  customerId: v.optional(v.string()), // Reference to Better Auth component user
  customerInfo: v.object({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  }),
  type: v.union(
    v.literal("delivery"),
    v.literal("pickup"),
    v.literal("dine_in")
  ),
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
  paymentMethod: v.optional(v.string()),
  paymentStatus: v.union(
    v.literal("pending"),
    v.literal("paid"),
    v.literal("failed"),
    v.literal("refunded"),
    v.literal("partially_refunded")
  ),
  source: v.union(
    v.literal("website"),
    v.literal("uber_eats"),
    v.literal("deliveroo"),
    v.literal("pos")
  ),
  notes: v.optional(v.string()),
  estimatedPrepTime: v.optional(v.number()), // in minutes
  estimatedDeliveryTime: v.optional(v.number()),
  scheduledFor: v.optional(v.number()), // timestamp for scheduled orders
  completedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_storeId_createdAt", ["storeId", "createdAt"])
  .index("by_customerId", ["customerId"])
  .index("by_orderNumber", ["orderNumber"])
  .index("by_source", ["source"])
