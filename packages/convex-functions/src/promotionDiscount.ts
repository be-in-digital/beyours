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
 * The storefront keeps its own copy of this arithmetic for *display* only. When
 * the two disagree, this one wins.
 */

export type PromotionDiscountType =
  | "percentage"
  | "fixed_amount"
  | "free_product"
  | "free_delivery"
  | "bogo"

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
}

export interface PromotionDiscountParams {
  promotion: PromotionForDiscount
  /** Store the order is being placed against — must match the promotion's. */
  storeId: string
  /** Server-verified item subtotal, in cents. */
  subtotal: number
  /** Server-computed delivery fee, in cents. */
  deliveryFee: number
  /** Server-computed tax, in cents. Used only to cap the discount. */
  taxAmount: number
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
}

export type PromotionRejectionReason =
  | "wrong_store"
  | "inactive"
  | "not_started"
  | "expired"
  | "total_usage_exceeded"
  | "customer_usage_exceeded"
  | "customer_unidentified"
  | "minimum_not_met"
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
 * Resolve the discount a promotion grants, or throw `PromotionRejectedError`.
 *
 * Rejection is deliberate rather than a silent 0: a customer who typed a valid
 * coupon and sees no discount deserves a reason, and an expired coupon that
 * silently succeeds would still burn a usage slot.
 */
export function resolvePromotionDiscount(
  params: PromotionDiscountParams
): PromotionDiscountResult {
  const { promotion, storeId, subtotal, deliveryFee, taxAmount, now } = params

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

  const preDiscountTotal = subtotal + taxAmount + deliveryFee
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
      discount = Math.round((subtotal * rate) / 100)
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
