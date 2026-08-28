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
  /** `globalSettings.taxRate`, a percentage such as 20. */
  globalTaxRate?: number | null
}

/**
 * Resolve the applicable tax rate, as a percentage.
 *
 * There used to be a per-store override read from `store.settings.taxRate`.
 * That column is legacy: no mutation declares it, so the only value it could
 * ever hold came from the create dialog's undeclared `settings` block — the
 * one Convex rejected, which is why no establishment could be created at all.
 * The override was therefore never anything but `undefined`, and every order
 * already fell through to the global rate.
 *
 * Zero is a real configuration (a tax-free establishment), not a missing
 * value, so it is returned rather than treated as absent. A genuine per-store
 * rate belongs in a declared argument with an editor behind it, not in a
 * column nothing writes.
 */
export function resolveTaxRatePercent(sources: TaxRateSources): number {
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
