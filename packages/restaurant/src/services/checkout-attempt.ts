/**
 * One checkout attempt, identified across page loads.
 *
 * `orders.create` refuses to create a second order for a key it has already
 * seen. Holding that key in a React ref covered the double click and nothing
 * else: the ref dies with the component, and the checkout page remounts on
 * every arrival — including the one that matters, the customer coming back from
 * the payment provider with their basket intact. Measured: two submissions
 * across a remount, two orders, two kitchen tickets.
 *
 * So the key lives in `sessionStorage`, tied to a signature of the basket it
 * was minted for:
 *
 *   - the same basket submitted again is the same attempt — the server returns
 *     the order that already exists;
 *   - a basket the customer changed in between is a different attempt, and must
 *     be: reusing the key there would hand them back an order for the *old*
 *     contents;
 *   - once an order goes through the cart is emptied, so the next basket
 *     signs differently and starts a new attempt of its own.
 *
 * The signature and the decision are pure and tested here. The storage is a
 * thin wrapper, because a browser may refuse it (private mode, blocked site
 * data) and a checkout must not die of that — it degrades to the old
 * per-mount behaviour rather than to no checkout at all.
 */

export interface CheckoutAttempt {
  /** The basket this key was minted for. */
  signature: string
  /** What `orders.create` deduplicates on. */
  key: string
}

/** Where the attempt is kept. Session-scoped: a new tab is a new attempt. */
export const CHECKOUT_ATTEMPT_KEY = "beyours-checkout-attempt"

export interface CartSignatureInput {
  storeId?: string | null
  orderType: string
  promotionId?: string | null
  items: Array<{ lineId: string; quantity: number }>
}

/**
 * What makes two submissions "the same order being retried".
 *
 * The lines and their quantities, the establishment, the service, and the
 * promotion — everything that changes what would be charged. Lines are sorted,
 * so reordering the cart does not invent a new attempt.
 */
export function cartSignature(input: CartSignatureInput): string {
  const lines = input.items
    .map((item) => `${item.lineId}x${item.quantity}`)
    .sort()
    .join("|")

  return [
    input.storeId ?? "",
    input.orderType,
    input.promotionId ?? "",
    lines,
  ].join("::")
}

/**
 * The attempt to submit under: the stored one when the basket has not changed,
 * a fresh one otherwise.
 */
export function resolveCheckoutAttempt(
  stored: CheckoutAttempt | null,
  signature: string,
  mintKey: () => string
): CheckoutAttempt {
  if (stored && stored.signature === signature && stored.key) return stored
  return { signature, key: mintKey() }
}

/** Read the attempt this tab is on, if the browser lets us. */
export function loadCheckoutAttempt(): CheckoutAttempt | null {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CheckoutAttempt
    return typeof parsed?.signature === "string" && typeof parsed?.key === "string"
      ? parsed
      : null
  } catch {
    return null
  }
}

/** Remember it for the next mount. Silent when storage is unavailable. */
export function saveCheckoutAttempt(attempt: CheckoutAttempt): void {
  try {
    window.sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt))
  } catch {
    // A browser that refuses session storage falls back to one attempt per
    // mount — the behaviour before this file, not a broken checkout.
  }
}

/** Forget it, once the order it paid for is behind us. */
export function clearCheckoutAttempt(): void {
  try {
    window.sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY)
  } catch {
    // Nothing to clean up if it was never written.
  }
}
