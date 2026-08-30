/**
 * Delivery quote policy
 *
 * Whether a stored Uber Direct quote may pay for the order in hand.
 *
 * WHY THIS EXISTS: `orders.create` checked that the quote existed, belonged to
 * the right restaurant and had not expired — and stopped there. Two holes were
 * left open.
 *
 * A quote was never tied to the address it priced, although the table stores
 * `dropoffLatitude` / `dropoffLongitude` with the comment "to detect a changed
 * address". Nobody read them. Ask for a quote to the building next door, then
 * order to an address thirty kilometres away: the cheap fee applies.
 *
 * And a quote was reusable. The same estimate id could price an unlimited
 * number of orders, so one cheap quote bought every future delivery.
 */

/** A stored quote, as `orders.create` reads it. */
export interface StoredQuote {
  estimateId: string
  storeId: string
  fee: number
  dropoffLatitude: number
  dropoffLongitude: number
  expiresAt: number
  consumedByOrderId?: string
}

/** Where the order is actually going. */
export interface Dropoff {
  latitude?: number
  longitude?: number
}

export type QuoteRejectionReason =
  | "missing"
  | "wrong_store"
  | "expired"
  | "already_used"
  | "address_not_located"
  | "address_mismatch"

export class QuoteRejectedError extends Error {
  readonly reason: QuoteRejectionReason

  constructor(reason: QuoteRejectionReason, message: string) {
    super(message)
    this.name = "QuoteRejectedError"
    this.reason = reason
  }
}

/**
 * The fee mode a shop can actually honour right now.
 *
 * Percentage mode bills a share of an Uber Direct quote. With the integration
 * switched off there is no quote to bill a share of: the storefront sends no
 * estimate id, and `orders.create` refuses the order with "un devis de
 * livraison est requis" — a condition the customer has no way to satisfy. The
 * shop stops taking delivery orders and the settings page shows nothing wrong.
 *
 * Nobody chose that state on purpose. The settings page only ever offers the
 * percentage option while Uber Direct is on, so the state is reached the other
 * way round: a shop configures percentage mode, then turns the integration off.
 * One click, no warning, and delivery is dead.
 *
 * Falling back to the fixed fee keeps the shop selling on the terms it can
 * still honour. The storefront and the server must reach the same answer or
 * the fee shown is not the fee charged, so both read it here.
 */
export function effectiveDeliveryFeeMode(params: {
  feeMode: string | null | undefined
  uberDirectEnabled: boolean | null | undefined
}): "fixed" | "percentage" {
  return params.feeMode === "percentage" && params.uberDirectEnabled === true
    ? "percentage"
    : "fixed"
}

/**
 * How far the ordered address may sit from the one the quote was priced for.
 *
 * ~110 m at this latitude. Geocoders disagree by a few metres on the same
 * doorway; they do not disagree by a street.
 */
export const QUOTE_COORD_TOLERANCE = 0.001

/**
 * Throw unless this quote may pay for this order.
 *
 * Kept pure so every refusal is testable without a database — the reason a
 * quote is refused is the whole point, and it decides what the customer is
 * charged.
 */
export function assertQuoteApplies(params: {
  quote: StoredQuote | null | undefined
  storeId: string
  dropoff: Dropoff | undefined
  now: number
}): asserts params is typeof params & { quote: StoredQuote } {
  const { quote, storeId, dropoff, now } = params

  if (!quote) {
    throw new QuoteRejectedError(
      "missing",
      "Devis de livraison introuvable : recalculez les frais."
    )
  }

  if (quote.storeId !== storeId) {
    throw new QuoteRejectedError(
      "wrong_store",
      "Ce devis de livraison concerne un autre restaurant."
    )
  }

  if (quote.expiresAt <= now) {
    throw new QuoteRejectedError(
      "expired",
      "Le devis de livraison a expiré : recalculez les frais."
    )
  }

  if (quote.consumedByOrderId) {
    throw new QuoteRejectedError(
      "already_used",
      "Ce devis de livraison a déjà servi : recalculez les frais."
    )
  }

  const lat = dropoff?.latitude
  const lng = dropoff?.longitude

  if (lat === undefined || lng === undefined) {
    // A saved address with no coordinates lands here. It used to produce
    // "un devis de livraison est requis", which tells the customer nothing
    // about what to do — they had entered an address.
    throw new QuoteRejectedError(
      "address_not_located",
      "L'adresse de livraison doit être localisée pour appliquer ce devis : sélectionnez-la dans les suggestions."
    )
  }

  if (
    Math.abs(lat - quote.dropoffLatitude) > QUOTE_COORD_TOLERANCE ||
    Math.abs(lng - quote.dropoffLongitude) > QUOTE_COORD_TOLERANCE
  ) {
    throw new QuoteRejectedError(
      "address_mismatch",
      "Ce devis de livraison a été calculé pour une autre adresse : recalculez les frais."
    )
  }
}

/** The fee to charge, once the quote has been accepted. */
export function quotedDeliveryFee(params: {
  quote: Pick<StoredQuote, "fee">
  percentage: number
  maxFee?: number
}): number {
  const { quote, percentage, maxFee } = params
  const fee = Math.round((quote.fee * percentage) / 100)
  return maxFee !== undefined && fee > maxFee ? maxFee : fee
}
