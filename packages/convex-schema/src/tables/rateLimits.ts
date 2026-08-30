import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Rate limit counters table
 *
 * One row per (limit, subject) — see `rateLimitKey` in
 * `@be-in-digital/convex-functions/rateLimit` for the key's shape.
 *
 * WHY THIS EXISTS: the mutations a storefront visitor calls without a session —
 * `contactMessages.create`, `emailSubscribers.subscribe` — had no limit of any
 * kind, and `message` was an unbounded string. One loop could fill a
 * restaurant's inbox, its database and, through the contact form's SES relay,
 * its sending quota.
 *
 * Fixed windows, kept deliberately small: a row holds a start and a count, and
 * nothing else. An operator asked why a message was refused can read the answer
 * off the row.
 */
export const rateLimitsTable = defineTable({
  /** `<limit name>:<subject>`, e.g. `contactPerEmail:yanis@resto.example`. */
  key: v.string(),
  windowStart: v.number(),
  count: v.number(),
})
  .index("by_key", ["key"])
