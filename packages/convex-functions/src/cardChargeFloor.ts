/**
 * The smallest amount a card provider will actually take.
 *
 * WHY THIS EXISTS. `stripe.createCheckoutSession` sent `unit_amount:
 * order.total` and asked nothing about it. Stripe's minimum charge in EUR is
 * 50 cents, so a promotion that takes the total to zero — a 100 % coupon is
 * the ordinary way to get there, and « livraison offerte » on a small pickup
 * order is another — produced an order that NO card could ever pay: the
 * session create throws, the SDK error is a plain `Error`, and Convex redacts
 * it to "Server Error" behind the checkout's generic retry toast. The diner
 * retries a payment that cannot succeed.
 *
 * The layers also disagreed about it in the other direction, which is how the
 * defect stayed invisible: `assertSettlesOrder` happily settles a 0 c order,
 * while `payments.settlePayment` refuses to write a row for one
 * (`amount <= 0`). One of them had to be wrong and neither said so.
 *
 * TWO CASES, AND THEY ARE NOT THE SAME REFUSAL.
 *
 *   0                   — there is nothing to pay. Not an error about the
 *                         provider at all: the order is complete and owes
 *                         nothing, and asking a diner to enter a card for it
 *                         is the wrong screen. `nothing_to_pay`.
 *   1 .. minimum-1      — there IS something to pay and this provider will not
 *                         take it. A real restriction the diner can act on by
 *                         choosing another method. `below_provider_minimum`.
 *
 * WHERE IT IS ENFORCED. In the three "start a card payment" actions, which is
 * the guarantee, and in `isPaymentMethodSelectable`
 * (`@be-in-digital/restaurant`), which is what stops the diner reaching them.
 * Pure and dependency-free so both a Convex action and the browser can hold
 * the same rule.
 */

import { RefusalError } from "./refusal"

/** The card providers this product can start a charge on. */
export type CardChargeProvider = "stripe" | "sumup" | "paypal"

/**
 * Stripe's published per-currency minimum charge, in MINOR units.
 *
 * Only the currencies the engine can plausibly be configured with are listed;
 * `DEFAULT_CARD_MINIMUM` covers the rest. These are Stripe's figures, and they
 * are used for SumUp and PayPal too: both have their own floors (SumUp's is
 * 1,00 € in most markets, PayPal's varies), and every one of them is at or
 * above this table, so a value that clears this clears those. Erring low here
 * would put the refusal back inside the provider, which is the failure this
 * module exists to move.
 *
 * Source: stripe.com/docs/currencies#minimum-and-maximum-charge-amounts.
 */
export const CARD_MINIMUM_BY_CURRENCY: Readonly<Record<string, number>> = {
  EUR: 50,
  USD: 50,
  GBP: 30,
  CHF: 50,
  CAD: 50,
  AUD: 50,
  NZD: 50,
  SEK: 300,
  NOK: 300,
  DKK: 250,
  PLN: 200,
  CZK: 1_500,
  HUF: 17_500,
  RON: 200,
  BGN: 100,
  JPY: 50,
}

/**
 * What an unlisted currency is held to.
 *
 * 50 minor units is the commonest floor in the table above and the one that
 * matters here, since EUR is what every deployment is configured with today.
 */
export const DEFAULT_CARD_MINIMUM = 50

/** The floor for one currency, however it happens to be cased. */
export function cardMinimumFor(currency: string | null | undefined): number {
  if (!currency) return DEFAULT_CARD_MINIMUM
  return CARD_MINIMUM_BY_CURRENCY[currency.toUpperCase()] ?? DEFAULT_CARD_MINIMUM
}

export type CardChargeRefusalReason =
  | "nothing_to_pay"
  | "below_provider_minimum"

/**
 * Thrown before anything is sent to a provider, so the diner reads a sentence
 * rather than a redacted "Server Error".
 *
 * A `ConvexError` for the same reason `CardPaymentUnavailableError` is one —
 * see `refusal.ts`. `code` lets the checkout tell "you owe nothing" from
 * "pay this another way", which are different screens.
 */
export class CardAmountRefusedError extends RefusalError<CardChargeRefusalReason> {
  readonly reason: CardChargeRefusalReason

  constructor(
    reason: CardChargeRefusalReason,
    message: string,
    details?: Record<string, string | number>
  ) {
    super("CardAmountRefusedError", reason, message, details)
    this.reason = reason
  }
}

/** Money the amount is expressed in, in minor units. */
export interface CardChargeAmount {
  /** The order total, in MINOR units — cents for EUR. */
  amountMinor: number
  /** ISO code; `EUR` when the deployment has not said otherwise. */
  currency?: string | null
}

/**
 * Can a card provider take this amount?
 *
 * The browser's half of the rule. Deliberately answers `false` for zero: there
 * is nothing to charge, so no card tile should be selectable — the refusal is
 * just a different one.
 */
export function isCardChargeable(amount: CardChargeAmount): boolean {
  const { amountMinor } = amount
  if (!Number.isFinite(amountMinor)) return false
  return amountMinor >= cardMinimumFor(amount.currency)
}

/** Format a minor-unit amount the way the refusal sentences say it. */
function inMajorUnits(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amountMinor / 100)
}

/**
 * Refuse an amount no card provider will take, before one is asked to.
 *
 * Called by `stripe.createCheckoutSession`, `sumup.createCheckout` and
 * `paypal.createPayPalOrder`. Returns nothing on success — it is a guard, and
 * reads as one at the call site.
 */
export function assertCardChargeable(amount: CardChargeAmount): void {
  const currency = (amount.currency || "EUR").toUpperCase()
  const minimum = cardMinimumFor(currency)
  const { amountMinor } = amount

  if (!Number.isFinite(amountMinor) || amountMinor < 0) {
    throw new CardAmountRefusedError(
      "below_provider_minimum",
      "Le montant de cette commande est invalide.",
      { minimum, currency }
    )
  }

  if (amountMinor === 0) {
    throw new CardAmountRefusedError(
      "nothing_to_pay",
      "Cette commande ne coûte rien : il n'y a aucun paiement à effectuer. " +
        "Validez-la sans carte.",
      { minimum, currency }
    )
  }

  if (amountMinor < minimum) {
    throw new CardAmountRefusedError(
      "below_provider_minimum",
      `Le paiement par carte n'est pas possible en dessous de ` +
        `${inMajorUnits(minimum, currency)} ; cette commande est de ` +
        `${inMajorUnits(amountMinor, currency)}. Choisissez un autre moyen de paiement.`,
      { minimum, currency, amount: amountMinor }
    )
  }
}
