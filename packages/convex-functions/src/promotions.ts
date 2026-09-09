/**
 * Promotion management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"

import { RefusalError } from "./refusal"
import {
  UNHONOURABLE_DISCOUNT_TYPE_MESSAGE,
  isHonourableDiscountType,
} from "./promotionDiscount"

/** A promotion this deployment cannot save, and why. */
export type PromotionConfigRefusalReason =
  | "discount_type_unhonourable"
  | "coupon_code_taken"

export class PromotionConfigRefusedError extends RefusalError<PromotionConfigRefusalReason> {
  /** Named like `PromotionRejectedError`'s, so both refusals read alike. */
  readonly reason: PromotionConfigRefusalReason

  constructor(reason: PromotionConfigRefusalReason, message: string) {
    super("PromotionConfigRefusedError", reason, message)
    this.reason = reason
  }
}

/**
 * Refuse a discount type the order path can never honour.
 *
 * WHY AT CREATION: the form sold « Produit offert » and « Offre BOGO (1+1) »,
 * `create` stored them, and `resolvePromotionDiscount` threw `not_applicable`
 * at the first redemption. An owner built a campaign, printed flyers for it,
 * and learned it was decorative from a diner at the till. Accepted-then-dead
 * is the worst of the three possible answers; refusing here is the honest one,
 * and it names what to use instead.
 *
 * The list itself lives with the resolver that enforces it, so the two cannot
 * drift — a type implemented there becomes creatable here on the same commit.
 */
function assertHonourableDiscountType(discountType: string): void {
  if (!isHonourableDiscountType(discountType)) {
    throw new PromotionConfigRefusedError(
      "discount_type_unhonourable",
      UNHONOURABLE_DISCOUNT_TYPE_MESSAGE
    )
  }
}

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
    assertHonourableDiscountType(args.discountType)

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
        // A `ConvexError`, not a bare `Error`: Convex redacts the latter in
        // production and the admin read "Server Error" where this sentence
        // should have been.
        throw new PromotionConfigRefusedError(
          "coupon_code_taken",
          "Ce code promo existe déjà"
        )
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

    // The type the promotion would carry once saved — the patched one, or the
    // stored one when the caller is not touching it. A row created before the
    // guard existed therefore cannot be edited while keeping its dead type;
    // it can still be deactivated (`toggleStatus`) or deleted (`remove`),
    // neither of which routes through here.
    assertHonourableDiscountType(fields.discountType ?? existing.discountType)

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
        throw new PromotionConfigRefusedError(
          "coupon_code_taken",
          "Ce code promo existe déjà"
        )
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
 * Delete a promotion — unless an order has already been discounted by it.
 *
 * WHAT WENT WRONG (#412 P3-F4). This one was not a bare delete: it cleared the
 * `promotionUsages` ledger a batch at a time, which is what made deleting a
 * popular coupon possible at all. The reference it never touched is the one
 * that matters. `orders.promotionId` is optional and, until `by_promotionId` was
 * declared for this guard, could not be seeked at all — so a deleted promotion
 * left every order it discounted naming a row that no longer resolves, and the
 * order still carries the `discountAmount` it granted.
 * The order then says «  −3,00 €  » and cannot say what for, on a document that
 * since #367 issues a numbered invoice in an unbroken fiscal series.
 * `releasePromotionForOrder` — the path that gives a use back when an order is
 * cancelled — reads that id, finds nothing, and quietly releases nothing.
 *
 * So a promotion that has been redeemed is history, and history is not the
 * delete button's to rewrite. That is the rule `prizes.remove` and
 * `games.remove` were given in #400, and the way out is the same one, already
 * on the screen: `isActive: false` stops the coupon working immediately and
 * leaves every order it discounted able to say why.
 *
 * BOTH SIDES ARE READ, and neither is redundant. `orders.by_promotionId` is the
 * authoritative one — it is the dangling reference — and it needed a new index,
 * because the cheap proxy is not equivalent: the retention cron and an art. 17
 * erasure both clear `promotionUsages` rows, while a paid order is ANONYMISED
 * and keeps its `promotionId` and its discount. Asking `promotionUsages` alone
 * would have made a three-year-old coupon deletable again and re-created the
 * very reference this guard exists to stop. `promotionUsages.promotionId` is
 * itself REQUIRED, and a usage row can outlive its order — `orderId` is
 * optional — so it is asked too.
 *
 * A promotion nobody ever redeemed still deletes, which is the case an owner
 * actually meets: a coupon typed wrong, or an offer that never ran.
 */
export const remove = {
  args: { id: v.id("promotions") },
  handler: async (ctx: any, args: any): Promise<PromotionPurgeResult> => {
    const promotion = await ctx.db.get(args.id)
    if (!promotion) throw new Error("Promotion not found")

    // `.first()` rather than a count: one row is all a refusal needs, on either
    // side, and a delete must not cost more the longer the coupon has worked.
    const order = await ctx.db
      .query("orders")
      .withIndex("by_promotionId", (q: any) => q.eq("promotionId", args.id))
      .first()

    const usage =
      order ??
      (await ctx.db
        .query("promotionUsages")
        .withIndex("by_promotionId", (q: any) => q.eq("promotionId", args.id))
        .first())

    if (usage) {
      throw new ConvexError({
        code: "promotion_in_order",
        message:
          `« ${promotion.name ?? promotion.code} » a déjà été utilisée sur des commandes : ` +
          "la supprimer laisserait ces commandes — et leurs factures — avec une remise " +
          "que plus rien ne justifie. " +
          "Désactivez-la : le code cesse aussitôt de fonctionner et l'historique reste lisible.",
      })
    }

    await ctx.db.delete(args.id)
    return { deleted: 0, hasMore: false }
  },
}

/**
 * The rest of the sweep, one batch per run, until there is nothing left.
 *
 * Internal only: it takes an id that no longer resolves — the promotion row was
 * deleted in the first transaction — and it is nobody's to call but the
 * scheduler's.
 *
 * KEPT DELIBERATELY, though `remove` no longer schedules it. A promotion with
 * usages is refused now, so a new delete never leaves a ledger to drain. A
 * client deployment running the previous `remove` can still have a drain
 * scheduled, and Convex resolves a scheduled function by NAME at run time:
 * removing this would fail those jobs on sites we have already shipped to, and
 * leave exactly the half-cleared ledger it was written to finish.
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
