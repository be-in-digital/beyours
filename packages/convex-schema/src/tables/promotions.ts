import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Promotions table
 * Coupon codes and automatic offers for restaurants
 */
export const promotionsTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  description: v.optional(v.string()),

  // Trigger mode: coupon (manual code) or auto (automatic offer)
  triggerMode: v.union(v.literal("coupon"), v.literal("auto")),
  // Coupon code (normalized to uppercase), only for triggerMode === "coupon"
  couponCode: v.optional(v.string()),

  // Discount type
  discountType: v.union(
    v.literal("percentage"),
    v.literal("fixed_amount"),
    v.literal("free_product"),
    v.literal("free_delivery"),
    v.literal("bogo")
  ),
  // Discount value: percentage (0-100) or amount in cents
  discountValue: v.optional(v.number()),
  // Max discount amount in cents (cap for percentage discounts)
  maxDiscountAmount: v.optional(v.number()),

  // Free product (for discountType === "free_product")
  freeProductId: v.optional(v.id("products")),

  // BOGO fields (for discountType === "bogo")
  bogoTriggerProductId: v.optional(v.id("products")),
  bogoRewardProductId: v.optional(v.id("products")),
  bogoTriggerQuantity: v.optional(v.number()),
  bogoRewardQuantity: v.optional(v.number()),

  // Scope: order-level, product-level, or category-level
  scope: v.union(
    v.literal("order"),
    v.literal("product"),
    v.literal("category")
  ),
  targetProductIds: v.optional(v.array(v.id("products"))),
  targetCategoryIds: v.optional(v.array(v.id("categories"))),

  // Conditions
  minimumOrderAmount: v.optional(v.number()), // in cents

  // Date range
  startDate: v.number(), // timestamp
  endDate: v.number(), // timestamp

  // Time-based scheduling (interpreted with globalSettings.timezone)
  scheduling: v.optional(
    v.object({
      activeDays: v.array(v.number()), // 0=Sun, 1=Mon, ..., 6=Sat
      activeTimeFrom: v.string(), // "17:00"
      activeTimeTo: v.string(), // "19:00"
    })
  ),

  // Usage limits
  maxTotalUsage: v.optional(v.number()),
  maxUsagePerCustomer: v.optional(v.number()),
  usageCount: v.number(), // current count

  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])
  .index("by_storeId_triggerMode", ["storeId", "triggerMode"])
  .index("by_storeId_couponCode", ["storeId", "couponCode"])

/**
 * Promotion Usages table
 * Tracks per-customer usage for limit enforcement
 */
export const promotionUsagesTable = defineTable({
  storeId: v.id("stores"),
  promotionId: v.id("promotions"),
  customerEmail: v.string(),
  orderId: v.optional(v.id("orders")),
  usedAt: v.number(),
})
  .index("by_promotionId", ["promotionId"])
  .index("by_promotionId_customerEmail", ["promotionId", "customerEmail"])
  .index("by_storeId", ["storeId"])
  // Retention and erasure. `by_promotionId_customerEmail` puts the promotion
  // first, so it cannot answer "this address, anywhere in this establishment" —
  // which is the only question a data-subject request asks.
  .index("by_storeId_usedAt", ["storeId", "usedAt"])
