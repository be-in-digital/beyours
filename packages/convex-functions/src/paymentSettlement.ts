/**
 * Payment settlement verification
 *
 * Pure guard answering one question: does this payment, as the provider
 * describes it, actually settle *this* order?
 *
 * WHY THIS EXISTS: `sumup.verifyCheckout` and `paypal.capturePayPalOrder` take
 * the provider's payment id and our order id as two independent arguments. Both
 * read the provider's reference field — SumUp's `checkout_reference`, PayPal's
 * `reference_id` — and neither compared it to the order being settled, nor
 * compared the amount to the order total.
 *
 * The consequence: pay a 1 € order, keep its checkout id, then replay it
 * against a 200 € order. The expensive order flipped to `paid` and a payment
 * record for the full amount was written. The same id was reusable forever.
 *
 * Both actions now route through `assertSettlesOrder` before anything is
 * marked paid.
 */

export type PaymentProvider = "sumup" | "paypal"

/** What the payment provider claims about a settled payment. */
export interface SettlementClaim {
  provider: PaymentProvider
  /**
   * The reference the provider echoes back. We set it to the order id when the
   * checkout was created, so it must come back unchanged.
   */
  reference?: string | null
  /**
   * The amount the provider actually settled, in MAJOR units (euros) as the
   * provider reports it — a number for SumUp, a decimal string for PayPal.
   */
  amountMajor?: number | string | null
  /** Currency code the provider reports, e.g. "EUR". */
  currency?: string | null
}

/** The order we are about to mark as paid. */
export interface OrderToSettle {
  orderId: string
  /** Order total in MINOR units (cents) — the unit used throughout the schema. */
  total: number
  /** Expected currency. Defaults to EUR, the only one the checkout creates. */
  currency?: string
}

export type SettlementRejectionReason =
  | "reference_missing"
  | "reference_mismatch"
  | "amount_missing"
  | "amount_mismatch"
  | "currency_mismatch"

/** Thrown when a payment does not legitimately settle the given order. */
export class SettlementRejectedError extends Error {
  readonly reason: SettlementRejectionReason
  readonly provider: PaymentProvider

  constructor(
    reason: SettlementRejectionReason,
    provider: PaymentProvider,
    message: string
  ) {
    super(message)
    this.name = "SettlementRejectedError"
    this.reason = reason
    this.provider = provider
  }
}

/**
 * Convert a provider-reported major-unit amount ("11.50", 11.5) to cents.
 *
 * Returns null for anything unparseable, so a missing or malformed amount is
 * rejected explicitly rather than silently coerced to 0 — which would make a
 * free payment look like it matched a free order.
 */
export function toMinorUnits(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === "string") {
    const trimmed = value.trim()
    // `Number("")` is 0, not NaN — an empty amount must not read as "free".
    if (trimmed === "") return null

    // Parse the digits directly instead of going through a float. PayPal sends
    // decimal strings, and "1.005" through IEEE-754 lands on 100.49999999999999.
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed)
    if (!match) return null

    const [, sign, whole, fraction = ""] = match
    const cents = `${fraction}00`.slice(0, 2)
    const magnitude = Number(whole) * 100 + Number(cents)
    if (!Number.isFinite(magnitude)) return null

    // A third decimal rounds up, matching how the providers themselves round.
    const thousandths = Number(fraction[2] ?? "0")
    const rounded = magnitude + (thousandths >= 5 ? 1 : 0)
    return sign === "-" ? -rounded : rounded
  }

  if (!Number.isFinite(value)) return null

  // Nudge by one epsilon before rounding: 11.51 * 100 is 1150.9999999999998.
  const scaled = (value + Math.sign(value) * Number.EPSILON) * 100
  return Math.round(scaled)
}

/**
 * Throw unless the provider's payment genuinely settles this order.
 *
 * Checked in order: the reference identifies this order, the currency matches,
 * and the amount settled equals the order total to the cent.
 */
export function assertSettlesOrder(
  claim: SettlementClaim,
  order: OrderToSettle
): void {
  const { provider } = claim

  // 1. Reference — the payment must name this order and no other.
  if (claim.reference === null || claim.reference === undefined || claim.reference === "") {
    throw new SettlementRejectedError(
      "reference_missing",
      provider,
      `${provider}: le paiement ne référence aucune commande.`
    )
  }

  if (claim.reference !== order.orderId) {
    throw new SettlementRejectedError(
      "reference_mismatch",
      provider,
      `${provider}: ce paiement référence la commande ${claim.reference}, pas ${order.orderId}.`
    )
  }

  // 2. Currency — comparing amounts across currencies is meaningless.
  const expectedCurrency = (order.currency ?? "EUR").toUpperCase()
  if (claim.currency && claim.currency.toUpperCase() !== expectedCurrency) {
    throw new SettlementRejectedError(
      "currency_mismatch",
      provider,
      `${provider}: paiement en ${claim.currency}, commande en ${expectedCurrency}.`
    )
  }

  // 3. Amount — to the cent. Under-payment and over-payment are both refused:
  // an over-payment means the two sides disagree about what was bought.
  const settledMinor = toMinorUnits(claim.amountMajor)
  if (settledMinor === null) {
    throw new SettlementRejectedError(
      "amount_missing",
      provider,
      `${provider}: le paiement ne rapporte aucun montant exploitable.`
    )
  }

  if (settledMinor !== order.total) {
    throw new SettlementRejectedError(
      "amount_mismatch",
      provider,
      `${provider}: montant réglé ${settledMinor} c, total de la commande ${order.total} c.`
    )
  }
}

/**
 * Pull the reference and captured amount out of a PayPal capture response.
 *
 * PayPal nests both inside `purchase_units[0]`, and the capture amount inside
 * `payments.captures[0].amount`. The previous code destructured only `id` and
 * `status`, so neither value ever reached a comparison.
 */
export function readPayPalCapture(capture: {
  purchase_units?: Array<{
    reference_id?: string
    payments?: {
      captures?: Array<{
        id?: string
        amount?: { currency_code?: string; value?: string }
      }>
    }
  }>
}): {
  reference?: string
  amountMajor?: string
  currency?: string
  captureId?: string
} {
  const unit = capture.purchase_units?.[0]
  const capturedPayment = unit?.payments?.captures?.[0]
  const amount = capturedPayment?.amount

  return {
    reference: unit?.reference_id,
    amountMajor: amount?.value,
    currency: amount?.currency_code,
    // PayPal refunds go against the CAPTURE id, not the order id. The order id
    // was what got stored, which would have made every PayPal refund fail.
    captureId: capturedPayment?.id,
  }
}
