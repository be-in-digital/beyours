import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Short-lived OAuth `state` tokens for CSRF protection on provider connect flows
 * (e.g. Uber Eats `eats.pos_provisioning`). A random state is issued when the
 * authorize URL is built and must be presented (and matched) on the redirect
 * callback before any token exchange. Rows are single-use and expire (TTL).
 *
 * Provider-agnostic so the same flow can back Deliveroo / SumUp / etc.
 */
export const oauthStatesTable = defineTable({
  /** Provider key, e.g. "uberEats" */
  provider: v.string(),
  /** Random CSRF token (hex) echoed back by the provider on the callback */
  state: v.string(),
  /** Unix timestamp (ms) after which the state is no longer valid */
  expiresAt: v.number(),
})
  .index("by_state", ["state"])
