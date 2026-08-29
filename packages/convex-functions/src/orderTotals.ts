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
 *
 * PRICES ARE TAX-INCLUSIVE. The rate no longer moves the total: it only says
 * how much of the total is tax. A restaurant selling to consumers in France
 * has to display the price the customer pays, and the owner types that price
 * into "Prix TTC (€)". Adding VAT on top of it overcharged every order — 10 %
 * or 20 % of every basket — and filed the wrong VAT with it: on 12,00 € TTC at
 * 10 % the tax is 1,09 €, not 1,20 €.
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

/** One line of the order, priced tax-inclusive, with the rate that applies to it. */
export interface TaxedLine {
  /** Line total in cents, tax included. */
  subtotal: number
  /** The line's own rate, e.g. 10 for 10 %. */
  taxRatePercent: number
}

export interface OrderTotalsInput {
  /** Sum of the verified line items, in cents, tax included. */
  subtotal: number
  /** Rate applied to lines that carry none, as a percentage, e.g. 10 for 10 %. */
  taxRatePercent: number
  /**
   * The lines, each with its own rate.
   *
   * A menu mixing food at 10 % and alcohol at 20 % is not expressible with one
   * rate over the basket, and `products.taxRate` has been collected on every
   * product since the beginning without anything reading it. When absent — an
   * older cart, a caller that has only a total — the single rate above applies
   * to the whole subtotal, which is what happened everywhere before.
   */
  lines?: TaxedLine[]
  /** Delivery fee in cents. */
  deliveryFee?: number
  /** Discount in cents, already resolved from the promotion. */
  discount?: number
}

/** What one rate contributes, for the VAT breakdown an invoice has to show. */
export interface TaxBreakdownEntry {
  ratePercent: number
  /** Tax-inclusive amount taxed at this rate, in cents. */
  grossAmount: number
  /** Tax contained in `grossAmount`, in cents. */
  taxAmount: number
}

export interface OrderTotals {
  subtotal: number
  /** Tax contained in `subtotal` — not added to it. */
  taxAmount: number
  /** One entry per distinct rate, ascending. Empty when nothing is taxed. */
  taxBreakdown: TaxBreakdownEntry[]
  deliveryFee: number
  discount: number
  total: number
}

/**
 * The tax contained in a tax-inclusive amount.
 *
 * 12,00 € at 10 % contains 1,09 € of VAT — `12,00 − 12,00 / 1,10` — where
 * adding 10 % on top would have produced 1,20 € and charged 13,20 €.
 */
export function taxIncludedIn(grossAmount: number, ratePercent: number): number {
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) return 0
  return grossAmount - Math.round(grossAmount / (1 + ratePercent / 100))
}

/**
 * Compute what the customer owes.
 *
 * The total is the goods, plus delivery, less the discount. Tax is *inside* the
 * goods, so it appears in the breakdown and never in the sum — the rate cannot
 * change what is charged, only how it is declared.
 *
 * Delivery is not broken down: the fee is quoted as a single amount by the
 * courier and no rate is attached to it anywhere in the product.
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = input.subtotal
  const deliveryFee = input.deliveryFee ?? 0
  const discount = input.discount ?? 0

  const lines: TaxedLine[] =
    input.lines && input.lines.length > 0
      ? input.lines
      : [{ subtotal, taxRatePercent: input.taxRatePercent }]

  // One entry per rate, so a basket of six dishes at 10 % is one line of the
  // breakdown rather than six — and so rounding happens once per rate.
  const grossByRate = new Map<number, number>()
  for (const line of lines) {
    const rate = line.taxRatePercent
    if (!Number.isFinite(rate) || rate <= 0) continue
    grossByRate.set(rate, (grossByRate.get(rate) ?? 0) + line.subtotal)
  }

  const taxBreakdown: TaxBreakdownEntry[] = [...grossByRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ratePercent, grossAmount]) => ({
      ratePercent,
      grossAmount,
      taxAmount: taxIncludedIn(grossAmount, ratePercent),
    }))

  const taxAmount = taxBreakdown.reduce((sum, entry) => sum + entry.taxAmount, 0)
  const total = Math.max(0, subtotal + deliveryFee - discount)

  return { subtotal, taxAmount, taxBreakdown, deliveryFee, discount, total }
}
