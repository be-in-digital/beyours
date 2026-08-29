/**
 * Promotion discount resolution
 *
 * Pure function computing the monetary discount a promotion grants to an order.
 *
 * WHY THIS EXISTS: the discount used to arrive as a client-supplied
 * `discountAmount` argument on `orders.create` and was applied verbatim
 * (`total = subtotal + tax + delivery - args.discountAmount`). Item prices were
 * re-fetched from the database — "never trust client prices" — but the discount
 * was not, so `discountAmount: 99999999` produced a 0 € order that still sent a
 * ticket to the kitchen. The server now recomputes the discount from the stored
 * promotion and ignores whatever the client believes it is owed.
 *
 * The storefront runs this same function for *display*. It used to keep its own
 * copy of the arithmetic, and the two disagreed in both directions: a
 * free-delivery coupon showed 26,90 € on screen and charged 22,00 €, and a
 * −50 € coupon on a 22 € basket promised 50 € off. One implementation now.
 */

import { isWithinWindow } from "./timeWindow"

export type PromotionDiscountType =
  | "percentage"
  | "fixed_amount"
  | "free_product"
  | "free_delivery"
  | "bogo"

/** What a promotion applies to. */
export type PromotionScope = "order" | "product" | "category"

/** The happy hour a promotion runs in, if any. */
export interface PromotionSchedule {
  /** 0 = Sunday … 6 = Saturday */
  activeDays: number[]
  /** "17:00" */
  activeTimeFrom: string
  /** "19:00" */
  activeTimeTo: string
}

/** The subset of a promotion document this resolver needs. */
export interface PromotionForDiscount {
  _id: string
  storeId: string
  isActive: boolean
  startDate: number
  endDate: number
  discountType: PromotionDiscountType
  discountValue?: number
  maxDiscountAmount?: number
  minimumOrderAmount?: number
  maxTotalUsage?: number
  maxUsagePerCustomer?: number
  usageCount: number
  /** Defaults to "order" — the whole basket — when absent. */
  scope?: PromotionScope
  targetProductIds?: string[]
  targetCategoryIds?: string[]
  scheduling?: PromotionSchedule
}

/** One verified line of the order, enough to decide whether a promotion reaches it. */
export interface DiscountableLine {
  productId?: string
  categoryId?: string
  /** Line total in cents, as the server verified it. */
  subtotal: number
}

export interface PromotionDiscountParams {
  promotion: PromotionForDiscount
  /** Store the order is being placed against — must match the promotion's. */
  storeId: string
  /** Server-verified item subtotal, in cents. */
  subtotal: number
  /** Server-computed delivery fee, in cents. */
  deliveryFee: number
  /** Evaluation instant, in ms. Injected so the function stays pure. */
  now: number
  /** How many times this customer already used this promotion. */
  customerUsageCount?: number
  /**
   * Whether the order carries an email. A per-customer cap is keyed on email,
   * so without one the cap cannot be enforced — and omitting the email would be
   * a one-field bypass. Anonymous orders are refused for capped promotions.
   */
  customerIdentified?: boolean
  /**
   * The order's lines. Required for a promotion scoped to products or
   * categories: without them the discount would fall on the whole basket, which
   * is what "−20 % on pizzas" did to eight drinks.
   */
  items?: DiscountableLine[]
  /** The restaurant's timezone, for a promotion that only runs at certain hours. */
  timezone?: string
}

export type PromotionRejectionReason =
  | "wrong_store"
  | "inactive"
  | "not_scheduled"
  | "not_started"
  | "expired"
  | "total_usage_exceeded"
  | "customer_usage_exceeded"
  | "customer_unidentified"
  | "minimum_not_met"
  | "no_eligible_items"
  | "not_applicable"

/** Thrown when a promotion cannot legally apply to the order. */
export class PromotionRejectedError extends Error {
  readonly reason: PromotionRejectionReason

  constructor(reason: PromotionRejectionReason, message: string) {
    super(message)
    this.name = "PromotionRejectedError"
    this.reason = reason
  }
}

export interface PromotionDiscountResult {
  /** Discount in cents, already capped so it can never exceed the order total. */
  discount: number
  /** True when the promotion waives the delivery fee. */
  freeDelivery: boolean
}

/**
 * The part of the basket a promotion applies to.
 *
 * An order-scoped promotion — the default, and what every promotion behaved as
 * — reaches the whole subtotal. A scoped one reaches only the lines it names,
 * and reaches nothing when the caller passed no lines: a caller that cannot say
 * what is in the basket cannot be allowed to discount it by product.
 */
function resolveEligibleSubtotal(
  promotion: PromotionForDiscount,
  subtotal: number,
  items?: DiscountableLine[]
): number {
  const scope = promotion.scope ?? "order"
  if (scope === "order") return subtotal
  if (!items) return 0

  const targets = new Set(
    scope === "product"
      ? promotion.targetProductIds ?? []
      : promotion.targetCategoryIds ?? []
  )
  if (targets.size === 0) return 0

  return items.reduce((sum, item) => {
    const key = scope === "product" ? item.productId : item.categoryId
    return key !== undefined && targets.has(key) ? sum + item.subtotal : sum
  }, 0)
}

/**
 * Resolve the discount a promotion grants, or throw `PromotionRejectedError`.
 *
 * Rejection is deliberate rather than a silent 0: a customer who typed a valid
 * coupon and sees no discount deserves a reason, and an expired coupon that
 * silently succeeds would still burn a usage slot.
 */
export function resolvePromotionDiscount(
  params: PromotionDiscountParams
): PromotionDiscountResult {
  const { promotion, storeId, subtotal, deliveryFee, now } = params

  // Tenant boundary first: a promotion belongs to exactly one store.
  if (promotion.storeId !== storeId) {
    throw new PromotionRejectedError(
      "wrong_store",
      "Ce code promo n'appartient pas à ce restaurant."
    )
  }

  if (!promotion.isActive) {
    throw new PromotionRejectedError("inactive", "Ce code promo n'est plus actif.")
  }

  if (now < promotion.startDate) {
    throw new PromotionRejectedError(
      "not_started",
      "Ce code promo n'est pas encore valide."
    )
  }

  if (now > promotion.endDate) {
    throw new PromotionRejectedError("expired", "Ce code promo a expiré.")
  }

  // Happy hour. The three fields were rendered in the promotions table and read
  // by nothing: a "Mon–Fri 17:00–19:00" discount applied on Sunday at 21:00.
  // Read on the restaurant's clock — the server's is UTC.
  if (
    !isWithinWindow(
      promotion.scheduling && {
        days: promotion.scheduling.activeDays,
        from: promotion.scheduling.activeTimeFrom,
        until: promotion.scheduling.activeTimeTo,
      },
      now,
      params.timezone
    )
  ) {
    throw new PromotionRejectedError(
      "not_scheduled",
      "Ce code promo ne s'applique pas à cette heure-ci."
    )
  }

  if (
    promotion.maxTotalUsage !== undefined &&
    promotion.usageCount >= promotion.maxTotalUsage
  ) {
    throw new PromotionRejectedError(
      "total_usage_exceeded",
      "Ce code promo a atteint sa limite d'utilisation."
    )
  }

  if (promotion.maxUsagePerCustomer !== undefined) {
    // The cap is counted per email. Without one there is nothing to count
    // against, and `customerInfo.email` is optional — so accepting anonymous
    // orders here would make the cap bypassable by omitting a single field.
    if (params.customerIdentified === false) {
      throw new PromotionRejectedError(
        "customer_unidentified",
        "Ce code promo est limité par client : renseignez votre email."
      )
    }

    if ((params.customerUsageCount ?? 0) >= promotion.maxUsagePerCustomer) {
      throw new PromotionRejectedError(
        "customer_usage_exceeded",
        "Vous avez déjà utilisé ce code promo."
      )
    }
  }

  if (
    promotion.minimumOrderAmount !== undefined &&
    subtotal < promotion.minimumOrderAmount
  ) {
    throw new PromotionRejectedError(
      "minimum_not_met",
      "Le montant minimum de commande n'est pas atteint."
    )
  }

  // What the promotion actually reaches. `scope`, `targetProductIds` and
  // `targetCategoryIds` are collected by the form, stored, and were read by no
  // pricing code: "−20 % on pizzas" over one pizza (12 €) and eight drinks
  // (24 €) took 7,20 € off instead of 2,40 €.
  const eligibleSubtotal = resolveEligibleSubtotal(promotion, subtotal, params.items)

  // Only a *scoped* promotion can miss: an order-scoped one over an empty
  // basket is simply worth nothing, and says so through the clamp below.
  if ((promotion.scope ?? "order") !== "order" && eligibleSubtotal <= 0) {
    throw new PromotionRejectedError(
      "no_eligible_items",
      "Ce code promo ne s'applique à aucun article de votre commande."
    )
  }

  // What the customer actually owes. Since #127 the tax is *inside* the
  // subtotal, so adding it here would let a discount exceed the order.
  const preDiscountTotal = subtotal + deliveryFee
  let discount = 0
  let freeDelivery = false

  switch (promotion.discountType) {
    case "percentage": {
      const rate = promotion.discountValue ?? 0
      if (rate <= 0) {
        throw new PromotionRejectedError(
          "not_applicable",
          "Ce code promo ne s'applique pas à votre commande."
        )
      }
      discount = Math.round((eligibleSubtotal * rate) / 100)
      if (
        promotion.maxDiscountAmount !== undefined &&
        discount > promotion.maxDiscountAmount
      ) {
        discount = promotion.maxDiscountAmount
      }
      break
    }

    case "fixed_amount": {
      discount = promotion.discountValue ?? 0
      if (discount <= 0) {
        throw new PromotionRejectedError(
          "not_applicable",
          "Ce code promo ne s'applique pas à votre commande."
        )
      }
      // A *scoped* fixed discount cannot exceed what it applies to: −5 € on the
      // desserts of a basket holding 3 € of dessert is 3 €. An order-scoped one
      // keeps the whole-order cap applied at the end.
      if ((promotion.scope ?? "order") !== "order" && discount > eligibleSubtotal) {
        discount = eligibleSubtotal
      }
      break
    }

    case "free_delivery": {
      // The storefront sends 0 here and its comment claims this is "handled
      // server-side during order creation" — it was not. It is now.
      discount = deliveryFee
      freeDelivery = true
      break
    }

    case "free_product":
    case "bogo": {
      // These alter the item list rather than the order total, and no code path
      // builds those items today. Granting 0 is the honest outcome: silently
      // discounting would invent a rebate the promotion never described.
      throw new PromotionRejectedError(
        "not_applicable",
        "Ce type de promotion n'est pas encore pris en charge à la commande."
      )
    }
  }

  // A discount can reduce an order to zero, never below, and never beyond what
  // the order is actually worth.
  discount = Math.max(0, Math.min(discount, preDiscountTotal))

  return { discount, freeDelivery }
}
