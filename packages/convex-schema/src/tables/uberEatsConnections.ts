import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Uber Eats merchant connection (OAuth Authorization Code / eats.pos_provisioning).
 *
 * Stores the user-scoped token obtained when a merchant consents to the app
 * via Uber's OAuth login. This token is required to call the Integration
 * Config endpoints (Activate Integration POST /pos_data, list stores-to-user).
 *
 * Tokens are never stored in plain text: each token field holds an
 * AES-256-GCM ciphertext decryptable only server-side with ENCRYPTION_KEY.
 *
 * Single active connection per deployment (one merchant per Convex instance,
 * per the multi-tenant model). Queried with .first().
 */
export const uberEatsConnectionsTable = defineTable({
  /** Uber user id of the merchant who granted consent (from token, optional) */
  merchantUserId: v.optional(v.string()),

  /** AES-256-GCM encrypted user access token. Format: base64(iv:authTag:ciphertext) */
  encryptedAccessToken: v.string(),

  /** AES-256-GCM encrypted refresh token (Uber returns one for Authorization Code) */
  encryptedRefreshToken: v.optional(v.string()),

  /** Unix timestamp (ms) at which the access token expires */
  tokenExpiresAt: v.optional(v.number()),

  /** Space-delimited granted scopes (e.g. "eats.pos_provisioning") */
  scope: v.optional(v.string()),

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
  .index("by_status", ["status"])
