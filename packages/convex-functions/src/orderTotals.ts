/**
 * Order totals
 *
 * The single arithmetic for what an order costs, shared by the server that
 * charges it and the storefront that displays it.
 *
 * WHY THIS EXISTS: the two sides each had their own version and disagreed. The
 * summary showed `subtotal + deliveryFee - discount` under the label "Taxes
 * incluses", while the server charged `subtotal + tax + deliveryFee - discount`
 * with the tax *added*. On a 20 € basket at 10 % the page said 20 € and Stripe
 * took 22 €.
 *
 * Two implementations of one price will always drift. There is now one.
 */

export interface TaxRateSources {
  /** `store.settings.taxRate`, a percentage such as 10. */
  storeTaxRate?: number | null
  /** `globalSettings.taxRate`, the fallback percentage. */
  globalTaxRate?: number | null
}

/**
 * Resolve the applicable tax rate, as a percentage.
 *
 * The store overrides the global setting — including when it is explicitly 0,
 * which is a real configuration (tax-free store), not a missing value.
 */
export function resolveTaxRatePercent(sources: TaxRateSources): number {
  const store = sources.storeTaxRate
  if (typeof store === "number" && Number.isFinite(store)) return store

  const global = sources.globalTaxRate
  if (typeof global === "number" && Number.isFinite(global)) return global

  return 0
}

export interface OrderTotalsInput {
  /** Sum of the verified line items, in cents. */
  subtotal: number
  /** Tax rate as a percentage, e.g. 10 for 10 %. */
  taxRatePercent: number
  /** Delivery fee in cents. */
  deliveryFee?: number
  /** Discount in cents, already resolved from the promotion. */
  discount?: number
}

export interface OrderTotals {
  subtotal: number
  taxAmount: number
  deliveryFee: number
  discount: number
  total: number
}

/**
 * Compute what the customer owes.
 *
 * Tax applies to the goods, not to the delivery fee or the discount — matching
 * how the server has always computed it.
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = input.subtotal
  const deliveryFee = input.deliveryFee ?? 0
  const discount = input.discount ?? 0

  const taxAmount = Math.round(subtotal * (input.taxRatePercent / 100))
  const total = Math.max(0, subtotal + taxAmount + deliveryFee - discount)

  return { subtotal, taxAmount, deliveryFee, discount, total }
}
