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
 * Stripe was added afterwards, for a different reason. `verifyCheckoutSession`
 * derives the order from the SAME session's metadata, so there is no
 * cross-order replay to close there — the reference check is tautological on
 * that path and is kept only because it costs nothing and keeps the guard
 * uniform. What Stripe genuinely needed is the amount and currency binding:
 * a session settling less than the order total flipped the order to `paid`
 * and booked the smaller amount as a full settlement.
 *
 * All three providers now route through `assertSettlesOrder` before anything is
 * marked paid: SumUp and PayPal from their verification actions, Stripe from
 * both the return page and the webhook.
 */

import { RefusalError } from "./refusal"

export type PaymentProvider = "sumup" | "paypal" | "stripe"

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
  /**
   * The amount the provider actually settled, already in MINOR units (cents),
   * as Stripe reports it. Mutually exclusive with `amountMajor`; when both are
   * given this one wins.
   *
   * Stripe's `amount_total` is minor units already. Feeding it to `amountMajor`
   * multiplies it by 100 and rejects every legitimate payment — 11500 becomes
   * 1150000 against an 11500 order. Dividing it by 100 at the call site is not
   * the fix either: that reintroduces the float rounding `toMinorUnits` exists
   * to prevent, and it is simply wrong for zero-decimal currencies like JPY,
   * where the minor unit IS the major unit.
   */
  amountMinor?: number | null
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

/**
 * Thrown when a payment does not legitimately settle the given order.
 *
 * The diner reads this one. `/checkout/success` renders it *after* they have
 * been charged, which is the worst possible moment to be shown "Server Error" —
 * and that is what Convex redacts a thrown `Error` to. `RefusalError` is what
 * carries the sentence to that screen; see `refusal.ts`.
 */
export class SettlementRejectedError extends RefusalError<SettlementRejectionReason> {
  readonly reason: SettlementRejectionReason
  readonly provider: PaymentProvider

  constructor(
    reason: SettlementRejectionReason,
    provider: PaymentProvider,
    message: string
  ) {
    super("SettlementRejectedError", reason, message, { provider })
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
  //
  // A provider reporting minor units directly skips the conversion entirely.
  // A non-integer there is not rounded into shape: silently turning 11500.5
  // into 11501 would be a guard inventing the number it is supposed to be
  // checking, so it is refused as unusable.
  const settledMinor =
    claim.amountMinor !== null && claim.amountMinor !== undefined
      ? Number.isInteger(claim.amountMinor)
        ? claim.amountMinor
        : null
      : toMinorUnits(claim.amountMajor)

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

/**
 * Pull the reference, amount and payment intent out of a Stripe checkout
 * session.
 *
 * Same shape and same reason as `readPayPalCapture`: read the fields once, in a
 * place a test can reach, rather than four times inside a "use node" action the
 * test environment cannot load.
 *
 * `amountMinor` is `amount_total` verbatim — Stripe reports minor units, and
 * the guard takes them as they are. `reference` comes from the session
 * metadata, which is where `createCheckoutSession` writes the order id.
 */
export function readStripeCheckoutSession(session: {
  id?: string
  amount_total?: number | null
  currency?: string | null
  payment_intent?: string | null | { id?: string }
  metadata?: { orderId?: string; storeId?: string } | null
}): {
  reference?: string
  amountMinor?: number | null
  currency?: string
  paymentIntentId?: string
} {
  const intent = session.payment_intent
  const paymentIntentId =
    typeof intent === "string"
      ? intent
      : (intent?.id ?? undefined)

  return {
    reference: session.metadata?.orderId,
    amountMinor: session.amount_total,
    currency: session.currency?.toUpperCase(),
    // Falls back to the session id: a refund needs SOMETHING to point at, and
    // an empty string would make the payment permanently unrefundable.
    paymentIntentId: paymentIntentId ?? session.id,
  }
}

/** The order state a settlement has to reckon with. */
export interface OrderBeingSettled {
  /** Order lifecycle status — "cancelled" is the one that matters here. */
  status: string
  /** Current payment status, from the `orders.paymentStatus` union. */
  paymentStatus: string
}

/**
 * What a provider settlement should write to `order.paymentStatus` — or `null`
 * when it must write nothing at all.
 *
 * WHY THIS EXISTS: all four settlement paths guarded with
 * `if (order.paymentStatus !== "paid")` and then wrote `"paid"`. Issue #128
 * introduced `refund_pending` — the order was paid, then cancelled, the money
 * is owed back and a human still has to send it — and `"refund_pending" !==
 * "paid"` is TRUE. So a Stripe retry (they run for up to three days) or a guest
 * refreshing the success tab walked straight into the branch and wrote `"paid"`
 * back over the marker. The refund banner and the "Rembourser le client" action
 * disappear from the admin, and nothing anywhere still records that money is
 * owed. `markCashPaid` was given this guard; the provider paths were missed.
 *
 * The rules, in order:
 *
 *  1. Money already returned, or owed back and awaiting a human — leave it
 *     alone. This is the case that was destroying the marker.
 *  2. The order is cancelled — money arrived for something nobody will
 *     deliver, so it is OWED BACK, not "paid". `payments.releaseRefund`
 *     reaches the same conclusion the same way. Writing `refund_pending` here
 *     also repairs an order the old code had already flipped to
 *     cancelled + paid.
 *  3. Already paid — nothing to do.
 *  4. Otherwise the settlement is what it looks like: the order is paid.
 *
 * Deliberately returns a value instead of throwing, unlike `markCashPaid`.
 * That one is a member of staff pressing a button and can be told "no". These
 * are machines re-delivering a payment that genuinely happened: throwing would
 * give Stripe a 500 to retry for three days and would show an innocent guest an
 * error on their own confirmation page. The payment row is still recorded
 * either way — the money moved, and a refund needs something to point at.
 */
export function paymentStatusAfterSettlement(
  order: OrderBeingSettled
): "paid" | "refund_pending" | null {
  if (
    order.paymentStatus === "refund_pending" ||
    order.paymentStatus === "refunded" ||
    order.paymentStatus === "partially_refunded"
  ) {
    return null
  }

  if (order.status === "cancelled") {
    return "refund_pending"
  }

  return order.paymentStatus === "paid" ? null : "paid"
}
