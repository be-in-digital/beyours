import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Payment connections table
 *
 * Stores OAuth / API-key connections between a restaurant store and a
 * payment provider (Stripe Connect, SumUp, PayPal).
 *
 * Sensitive tokens are never stored in plain text: every token field
 * holds an AES-256-GCM encrypted ciphertext that can only be decrypted
 * server-side using the application encryption key.
 *
 * One row per provider — a restaurant may connect to several
 * providers but only one active connection per provider at a time.
 */
export const paymentConnectionsTable = defineTable({
  /** Payment provider identifier */
  provider: v.union(
    v.literal("stripe"),
    v.literal("sumup"),
    v.literal("paypal")
  ),

  /**
   * Provider-specific merchant identifier:
   * - Stripe  → stripe_user_id from OAuth callback
   * - SumUp   → merchant_code returned after authorization
   * - PayPal  → merchant_id from onboarding webhook
   */
  merchantId: v.string(),

  /**
   * AES-256-GCM encrypted access token.
   * Format: base64(<iv>:<authTag>:<ciphertext>)
   * Optional for providers using Account Links (e.g. Stripe).
   */
  encryptedAccessToken: v.optional(v.string()),

  /**
   * AES-256-GCM encrypted refresh token (optional).
   * Present for SumUp and PayPal; Stripe tokens do not expire.
   */
  encryptedRefreshToken: v.optional(v.string()),

  /**
   * Unix timestamp (ms) at which the access token expires.
   * Undefined for Stripe (non-expiring tokens).
   */
  tokenExpiresAt: v.optional(v.number()),

  /** Current connection health status */
  status: v.union(
    v.literal("connected"),
    v.literal("disconnected"),
    v.literal("error")
  ),

  /** Unix timestamp (ms) when the connection was first established */
  connectedAt: v.number(),

  /** Unix timestamp (ms) of the last status or token update */
  updatedAt: v.number(),
})
  .index("by_provider", ["provider"])
