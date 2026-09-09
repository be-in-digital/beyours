/**
 * Which payment tile the checkout may land on, and which it may keep.
 *
 * The form used to hardcode `useState("card")` and fall back to card whenever
 * cash became unselectable — two independent places that resolved to a tile
 * the deployment could not always serve. On a fresh deployment with cash
 * enabled and no card provider keyed, card was therefore the pre-selected
 * default, every card submit failed, and the failed-card-then-cash retry was
 * the natural first journey (#374). The rule lives here, once, so the default
 * a diner lands on and the fallback a state change resolves to cannot drift
 * apart — and so it can be pinned by a test without mounting the form.
 */

export type CheckoutPaymentMethod = "card" | "paypal" | "cash"

export interface PaymentMethodContext {
  /**
   * Server-measured: can this deployment actually take a card right now?
   * `undefined` while the availability query is still loading — treated as
   * available so a configured deployment (the common case) keeps today's
   * card-first default without a tile flicker.
   */
  cardAvailable: boolean | undefined
  /**
   * Whether the establishment takes cards AT ALL — the owner's own answer,
   * stored as `payments.cardProvider: "none"`.
   *
   * Distinct from `cardAvailable`, which is about whether a provider is
   * configured and working. A cash-only food truck is not misconfigured: it
   * has no card tile, so there is nothing for the checkout to fall back to
   * and nothing to grey out. Optional, defaulting to offered, so a caller
   * that has not asked keeps the previous behaviour.
   */
  cardOffered?: boolean
  /** `globalSettings.payments.paypal` — the PayPal tile's own gate. */
  paypalEnabled: boolean
  /** `globalSettings.payments.cash` — the Espèces tile's own gate. */
  cashEnabled: boolean
  /** Cash is only offered for pickup and dine-in. */
  isDelivery: boolean
  /** Cash requires an account, so the till knows who to call. */
  isAuthenticated: boolean
  /**
   * What this order actually owes, in MINOR units. `undefined` while the
   * basket is still being priced — treated as "no objection", so a caller that
   * does not pass it keeps the previous behaviour exactly.
   *
   * WHY THE TILES CARE. A card provider will not take any amount: Stripe's
   * floor in EUR is 0,50 €, and a 100 % coupon takes an order to zero. Neither
   * was asked about anywhere, so the tile was offered, the diner chose it, and
   * the session create threw an SDK error that Convex redacts to "Server
   * Error" — on an order no retry could ever settle.
   */
  amountDue?: number
  /**
   * The smallest amount a card provider will take, in MINOR units — supplied
   * rather than derived so this package stays dependency-free. The value lives
   * in `@be-in-digital/convex-functions/cardChargeFloor`, which is also what
   * the three money paths enforce, so the tile and the refusal cannot drift.
   *
   * `undefined` means the caller has not said, and no floor is applied.
   */
  cardMinimum?: number
}

/**
 * This order owes nothing at all — a 100 % coupon, usually.
 *
 * A distinct state, not a small payment. There is no card to take, no
 * provider to call and no minimum to clear; the order simply needs placing.
 * `cash` is the branch that does that, so it is the one offered, and its own
 * gates do not apply: they are about who is trusted to hand over money and
 * where, and nobody is handing over any.
 */
export function nothingIsDue(context: PaymentMethodContext): boolean {
  return context.amountDue === 0
}

/**
 * Would a card provider take this amount?
 *
 * True when the caller has not priced the basket yet — an unknown total is not
 * a refusal, and greying every tile while the quote loads would be worse than
 * the defect this guards.
 */
function clearsCardFloor(context: PaymentMethodContext): boolean {
  if (context.amountDue === undefined || context.cardMinimum === undefined) {
    return true
  }
  return context.amountDue >= context.cardMinimum
}

/**
 * The same conditions the tiles render with — one predicate, not three.
 *
 * `card` answers to two facts, not one: whether the establishment offers cards
 * at all, and whether a card can actually be taken right now. The first is the
 * owner's decision and hides the tile; the second is configuration and greys
 * it. Folding them together is what left a cash-only establishment with a
 * pre-selected tile it could never honour (#376).
 *
 * A third fact was missing from all of them: what the order costs. Below a
 * provider's floor there is no card payment to be had however well the
 * deployment is configured, and at zero there is no payment at all.
 */
export function isPaymentMethodSelectable(
  method: CheckoutPaymentMethod,
  context: PaymentMethodContext
): boolean {
  switch (method) {
    case "card":
      return (
        clearsCardFloor(context) &&
        context.cardOffered !== false &&
        context.cardAvailable !== false
      )
    case "paypal":
      // PayPal has its own floor and it is at or above the card one, so the
      // same test serves. It cannot take a zero-value order either.
      return clearsCardFloor(context) && context.paypalEnabled
    case "cash":
      return (
        nothingIsDue(context) ||
        (context.cashEnabled && !context.isDelivery && context.isAuthenticated)
      )
  }
}

/**
 * The method the checkout submits: the diner's own choice while it is still
 * servable, otherwise the first servable tile in display order — and `null`
 * when the deployment can serve none, which the form turns into a disabled
 * submit rather than a doomed attempt.
 */
export function resolvePaymentMethod(
  chosen: CheckoutPaymentMethod | null,
  context: PaymentMethodContext
): CheckoutPaymentMethod | null {
  if (chosen && isPaymentMethodSelectable(chosen, context)) return chosen
  for (const method of ["card", "paypal", "cash"] as const) {
    if (isPaymentMethodSelectable(method, context)) return method
  }
  return null
}
