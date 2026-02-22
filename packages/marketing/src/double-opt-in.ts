/**
 * Double opt-in utilities
 *
 * Token generation with 48h expiry.
 * RGPD-compliant: every marketing subscriber must confirm their email.
 */

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

export interface DoubleOptInToken {
  token: string
  expiresAt: number
}

export interface SubscriberForOptIn {
  status: string
  doubleOptInToken?: string
  doubleOptInExpiresAt?: number
  doubleOptInAt?: number
}

/**
 * Generate a secure double opt-in token with a 48h expiry.
 */
export function generateDoubleOptInToken(): DoubleOptInToken {
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + TOKEN_TTL_MS
  return { token, expiresAt }
}

/**
 * Check if a subscriber's double opt-in token is still valid.
 * Returns false if:
 * - Token is missing
 * - Token is expired
 * - Subscriber already confirmed (status !== "pending")
 */
export function isDoubleOptInValid(subscriber: SubscriberForOptIn): boolean {
  if (subscriber.status !== "pending") return false
  if (!subscriber.doubleOptInToken) return false
  if (!subscriber.doubleOptInExpiresAt) return false
  return Date.now() <= subscriber.doubleOptInExpiresAt
}

/**
 * Returns the patch data to apply when confirming double opt-in.
 * Clears the token and sets the confirmed timestamp.
 */
export function processDoubleOptIn(now?: number): Record<string, unknown> {
  return {
    status: "active",
    doubleOptInAt: now ?? Date.now(),
    doubleOptInToken: undefined,
    doubleOptInExpiresAt: undefined,
  }
}
