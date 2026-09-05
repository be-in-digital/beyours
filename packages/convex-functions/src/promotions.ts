/**
 * Promotion management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

const triggerModeValidator = v.union(v.literal("coupon"), v.literal("auto"))

const discountTypeValidator = v.union(
  v.literal("percentage"),
  v.literal("fixed_amount"),
  v.literal("free_product"),
  v.literal("free_delivery"),
  v.literal("bogo")
)

const scopeValidator = v.union(
  v.literal("order"),
  v.literal("product"),
  v.literal("category")
)

const schedulingValidator = v.optional(
  v.object({
    activeDays: v.array(v.number()),
    activeTimeFrom: v.string(),
    activeTimeTo: v.string(),
  })
)

// === QUERIES ===

/**
 * List all promotions for a store
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("promotions")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * Get promotion by ID
 */
export const getById = {
  args: { id: v.id("promotions") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Get promotion by coupon code for a store
 */
export const getByCouponCode = {
  args: {
    storeId: v.id("stores"),
    couponCode: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const code = args.couponCode.toUpperCase()
    return await ctx.db
      .query("promotions")
      .withIndex("by_storeId_couponCode", (q: any) =>
        q.eq("storeId", args.storeId).eq("couponCode", code)
      )
      .first()
  },
}

/**
 * List active automatic promotions for a store
 */
export const listActiveAuto = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const all = await ctx.db
      .query("promotions")
      .withIndex("by_storeId_triggerMode", (q: any) =>
        q.eq("storeId", args.storeId).eq("triggerMode", "auto")
      )
      .collect()
    return all.filter((p: any) => p.isActive)
  },
}

/**
 * Get customer usage count for a promotion
 */
export const getCustomerUsageCount = {
  args: {
    promotionId: v.id("promotions"),
    customerEmail: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const usages = await ctx.db
      .query("promotionUsages")
      .withIndex("by_promotionId_customerEmail", (q: any) =>
        q.eq("promotionId", args.promotionId).eq("customerEmail", args.customerEmail)
      )
      .collect()
    return usages.length
  },
}

// === MUTATIONS ===

/**
 * Create a new promotion
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerMode: triggerModeValidator,
    couponCode: v.optional(v.string()),
    discountType: discountTypeValidator,
    discountValue: v.optional(v.number()),
    maxDiscountAmount: v.optional(v.number()),
    freeProductId: v.optional(v.id("products")),
    bogoTriggerProductId: v.optional(v.id("products")),
    bogoRewardProductId: v.optional(v.id("products")),
    bogoTriggerQuantity: v.optional(v.number()),
    bogoRewardQuantity: v.optional(v.number()),
    scope: scopeValidator,
    targetProductIds: v.optional(v.array(v.id("products"))),
    targetCategoryIds: v.optional(v.array(v.id("categories"))),
    minimumOrderAmount: v.optional(v.number()),
    startDate: v.number(),
    endDate: v.number(),
    scheduling: schedulingValidator,
    maxTotalUsage: v.optional(v.number()),
    maxUsagePerCustomer: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    // Normalize coupon code to uppercase
    const couponCode = args.couponCode ? args.couponCode.toUpperCase() : undefined

    // Check coupon code uniqueness
    if (couponCode) {
      const existing = await ctx.db
        .query("promotions")
        .withIndex("by_storeId_couponCode", (q: any) =>
          q.eq("storeId", args.storeId).eq("couponCode", couponCode)
        )
        .first()
      if (existing) {
        throw new Error("Ce code promo existe déjà")
      }
    }

    const now = Date.now()
    return await ctx.db.insert("promotions", {
      ...args,
      couponCode,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update a promotion
 */
export const update = {
  args: {
    id: v.id("promotions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    triggerMode: v.optional(triggerModeValidator),
    couponCode: v.optional(v.string()),
    discountType: v.optional(discountTypeValidator),
    discountValue: v.optional(v.number()),
    maxDiscountAmount: v.optional(v.number()),
    freeProductId: v.optional(v.id("products")),
    bogoTriggerProductId: v.optional(v.id("products")),
    bogoRewardProductId: v.optional(v.id("products")),
    bogoTriggerQuantity: v.optional(v.number()),
    bogoRewardQuantity: v.optional(v.number()),
    scope: v.optional(scopeValidator),
    targetProductIds: v.optional(v.array(v.id("products"))),
    targetCategoryIds: v.optional(v.array(v.id("categories"))),
    minimumOrderAmount: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    scheduling: schedulingValidator,
    maxTotalUsage: v.optional(v.number()),
    maxUsagePerCustomer: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Promotion not found")

    // Normalize coupon code to uppercase if provided
    if (fields.couponCode !== undefined) {
      fields.couponCode = fields.couponCode ? fields.couponCode.toUpperCase() : undefined
    }

    // Check coupon code uniqueness if changed
    const newCode = fields.couponCode ?? existing.couponCode
    if (newCode && newCode !== existing.couponCode) {
      const duplicate = await ctx.db
        .query("promotions")
        .withIndex("by_storeId_couponCode", (q: any) =>
          q.eq("storeId", existing.storeId).eq("couponCode", newCode)
        )
        .first()
      if (duplicate && duplicate._id !== id) {
        throw new Error("Ce code promo existe déjà")
      }
    }

    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Toggle promotion active status
 */
export const toggleStatus = {
  args: { id: v.id("promotions") },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Promotion not found")
    await ctx.db.patch(args.id, {
      isActive: !existing.isActive,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Delete a promotion and its usages
 */
/**
 * How many usage rows one transaction will clear.
 *
 * `promotionUsages` takes a row per redemption, so a coupon that worked grows
 * with the restaurant's trade — and a Convex mutation is one transaction with a
 * bounded read and write budget. Deleting them all at once meant the successful
 * promotions were the ones that could not be deleted. 512 matches
 * `CASCADE_BATCH_SIZE`, for the same reasons set out there.
 */
export const PROMOTION_USAGE_BATCH = 512

export interface PromotionPurgeResult {
  /** Usage rows deleted in this pass. */
  deleted: number
  /** Whether another pass is needed. */
  hasMore: boolean
}

/** Delete up to `budget` usage rows of one promotion. */
async function deleteUsageBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  promotionId: unknown,
  budget: number = PROMOTION_USAGE_BATCH
): Promise<PromotionPurgeResult> {
  // `take(budget + 1)`: the extra row is how we learn there is more to do
  // without paying for a count.
  const usages = await ctx.db
    .query("promotionUsages")
    .withIndex("by_promotionId", (q: any) => q.eq("promotionId", promotionId))
    .take(budget + 1)

  const hasMore = usages.length > budget
  const batch = hasMore ? usages.slice(0, budget) : usages
  for (const usage of batch) {
    await ctx.db.delete(usage._id)
  }
  return { deleted: batch.length, hasMore }
}

/**
 * Delete a promotion and the record of its use.
 *
 * The promotion row goes in this transaction so the offer stops working
 * immediately; the usage rows are cleared a batch at a time. `hasMore` is the
 * caller's signal to schedule the next pass — see `purgeUsages`.
 */
export const remove = {
  args: { id: v.id("promotions") },
  handler: async (ctx: any, args: any): Promise<PromotionPurgeResult> => {
    const result = await deleteUsageBatch(ctx, args.id)
    await ctx.db.delete(args.id)
    return result
  },
}

/**
 * The rest of the sweep, one batch per run, until there is nothing left.
 *
 * Internal only: it takes an id that no longer resolves — the promotion row is
 * deleted in the first transaction — and it is nobody's to call but the
 * scheduler's.
 */
export const purgeUsages = {
  args: { promotionId: v.id("promotions") },
  handler: async (ctx: any, args: any): Promise<PromotionPurgeResult> =>
    await deleteUsageBatch(ctx, args.promotionId),
}

// === INTERNAL (wrapped as internalMutation in app) ===

/**
 * Increment usage count and record usage
 */
export const incrementUsage = {
  args: {
    promotionId: v.id("promotions"),
    storeId: v.id("stores"),
    customerEmail: v.string(),
    orderId: v.optional(v.id("orders")),
  },
  handler: async (ctx: any, args: any) => {
    const promo = await ctx.db.get(args.promotionId)
    if (!promo) throw new Error("Promotion not found")

    // Increment counter
    await ctx.db.patch(args.promotionId, {
      usageCount: promo.usageCount + 1,
      updatedAt: Date.now(),
    })

    // Record usage
    await ctx.db.insert("promotionUsages", {
      storeId: args.storeId,
      promotionId: args.promotionId,
      customerEmail: args.customerEmail,
      orderId: args.orderId,
      usedAt: Date.now(),
    })
  },
}
