/**
 * A fixed-window rate limiter for the mutations anyone can call.
 *
 * WHY THIS EXISTS: `contactMessages.create` and `emailSubscribers.subscribe`
 * are public by necessity — a storefront visitor has no session — and neither
 * had any limit. `message` was an unbounded `v.string()`, so one request could
 * store a megabyte and a loop could fill a restaurant's inbox, its database and,
 * through the contact form, its SES quota.
 *
 * WHAT THIS CANNOT DO, said plainly because the audit asked for it: **there is
 * no IP address here.** A Convex mutation sees `auth`, `db`, `scheduler` and
 * `storage` — the client's address is not among them, and only an `httpAction`
 * could reach it. Routing the storefront form through one to recover the IP
 * would add a public HTTP route to the surface, which is the opposite of the
 * direction the rest of this work has taken.
 *
 * So the keys are what a mutation can actually know:
 *
 * - **Per restaurant.** Generous, and the one an attacker cannot dodge: it
 *   bounds how much noise any flood can make, whatever addresses it invents.
 * - **Per email address.** Tight, and trivially dodged by changing the address —
 *   which is precisely why it is not the only one. It stops the accidental
 *   double-submit and the naive script without troubling a real visitor.
 *
 * A fixed window rather than a sliding one: it can admit up to twice the limit
 * across a boundary, and that is an acceptable price for a rule an operator can
 * read off the row — `count` since `windowStart` — when asked why a message was
 * refused.
 */

import { v } from "convex/values"

/** One counter, as the limiter cares about it. */
export interface RateLimitWindow {
  windowStart: number
  count: number
}

export interface RateLimitRule {
  /** How many are allowed inside one window. */
  limit: number
  windowMs: number
}

export interface RateLimitVerdict {
  allowed: boolean
  /** The window to persist. Absent when nothing needs writing. */
  next?: RateLimitWindow
  /** When the caller may try again, if refused. */
  retryAt?: number
}

/** The windows this product enforces, and the reasoning behind each number. */
export const RATE_LIMITS = {
  /**
   * One visitor writing to one restaurant. Three in an hour covers a genuine
   * correction ("I gave the wrong phone number") and stops a loop.
   */
  contactPerEmail: { limit: 3, windowMs: 60 * 60_000 },
  /**
   * Everything arriving at one restaurant. Sixty an hour is far above what a
   * contact form sees and far below what a flood wants.
   */
  contactPerStore: { limit: 60, windowMs: 60 * 60_000 },
  /**
   * Newsletter sign-ups for one address. Re-subscribing is normal; doing it
   * five times an hour is not.
   */
  subscribePerEmail: { limit: 5, windowMs: 60 * 60_000 },
  /** Sign-ups arriving at one restaurant. */
  subscribePerStore: { limit: 100, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitName = keyof typeof RATE_LIMITS

/**
 * Decide whether this call is allowed, and what the counter becomes.
 *
 * Pure, so the policy can be reasoned about without a database — and so the
 * boundary behaviour is pinned by tests rather than discovered in production.
 */
export function checkRateLimit(
  existing: RateLimitWindow | null,
  rule: RateLimitRule,
  now: number
): RateLimitVerdict {
  // No counter, or one whose window has run out: this call starts a new one.
  if (!existing || now - existing.windowStart >= rule.windowMs) {
    return { allowed: true, next: { windowStart: now, count: 1 } }
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      retryAt: existing.windowStart + rule.windowMs,
    }
  }

  return {
    allowed: true,
    next: { windowStart: existing.windowStart, count: existing.count + 1 },
  }
}

/**
 * The row key for one limit and one subject.
 *
 * The email is lowercased for the same reason the subscriber lookup is: an
 * address is one address however it was typed, and a limiter that disagrees is
 * one `Shift` away from being no limiter at all.
 */
export function rateLimitKey(name: RateLimitName, subject: string): string {
  return `${name}:${subject.toLowerCase()}`
}

/* ------------------------------------------------------------------ */
/* Field caps                                                          */
/* ------------------------------------------------------------------ */

/**
 * The longest each public field may be.
 *
 * Convex's `v.string()` has no length of its own, so "how long may a message
 * be" was answered by whatever the caller sent. These are generous for a person
 * and small for a script.
 */
export const FIELD_LIMITS = {
  name: 120,
  email: 254, // RFC 5321's maximum path length.
  phone: 40,
  subject: 200,
  message: 5_000,
} as const

export class FieldTooLongError extends Error {
  constructor(
    readonly field: keyof typeof FIELD_LIMITS,
    readonly limit: number
  ) {
    super(`Le champ « ${field} » dépasse ${limit} caractères.`)
    this.name = "FieldTooLongError"
  }
}

/** Throw unless every named field fits. */
export function assertFieldLengths(
  fields: Partial<Record<keyof typeof FIELD_LIMITS, string | undefined>>
): void {
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue
    const limit = FIELD_LIMITS[field as keyof typeof FIELD_LIMITS]
    if (value.length > limit) {
      throw new FieldTooLongError(field as keyof typeof FIELD_LIMITS, limit)
    }
  }
}

export class RateLimitedError extends Error {
  constructor(readonly retryAt: number) {
    super("Trop de requêtes. Merci de réessayer dans quelques minutes.")
    this.name = "RateLimitedError"
  }
}

/**
 * Consume one unit of a limit, or throw.
 *
 * Reads and writes `rateLimits` directly rather than going through a wrapper,
 * so it can be called from inside a shared handler in the same transaction as
 * the write it is protecting — a limiter that commits separately from the thing
 * it limits is a limiter with a gap in it.
 */
export async function consumeRateLimit(
  ctx: any,
  name: RateLimitName,
  subject: string,
  now: number = Date.now()
): Promise<void> {
  const key = rateLimitKey(name, subject)
  const rule = RATE_LIMITS[name]

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first()

  const verdict = checkRateLimit(
    existing ? { windowStart: existing.windowStart, count: existing.count } : null,
    rule,
    now
  )

  if (!verdict.allowed) {
    throw new RateLimitedError(verdict.retryAt ?? now + rule.windowMs)
  }

  if (existing) {
    await ctx.db.patch(existing._id, verdict.next)
  } else {
    await ctx.db.insert("rateLimits", { key, ...verdict.next })
  }
}

/** Args shared by the table wrappers in each app. */
export const rateLimitArgs = {
  key: v.string(),
}
