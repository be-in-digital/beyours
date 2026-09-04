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

/* ------------------------------------------------------------------ */
/* Menu sync windows                                                   */
/* ------------------------------------------------------------------ */

/**
 * The delivery platforms are rate-limited too, and the catalogue writes were
 * ignoring it completely.
 *
 * Every product and menu mutation used to queue a full sweep — `syncAllStores`
 * for Uber Eats *and* one for Deliveroo — and Convex does not dedupe scheduled
 * jobs. Importing fifty products queued a hundred sweeps, and each sweep pushed
 * the menu of **every** establishment, not the one that changed. Uber caps
 * `PUT /v2/eats/stores/{id}/menu` at roughly one call per minute per store, so
 * the overwhelming majority of those uploads could only ever come back 429.
 *
 * The same counter table that bounds the public forms bounds this: one row per
 * (platform, establishment), `limit: 1`, so the first write of a window claims
 * it and every write behind it rides along.
 *
 * WHY THE WINDOW IS ALSO THE DELAY: the claim schedules the push at the *end*
 * of its window, not at the start. A leading-edge push would fire five seconds
 * in and drop everything typed afterwards until the window ran out. Pushing at
 * the end means the one upload carries the catalogue as it stands once the
 * burst has settled — a menu upload is a full overwrite on both platforms, so
 * the last state is the only one that matters.
 *
 * The cost, stated plainly: a single isolated edit now reaches the platform up
 * to a minute later instead of five seconds later. That is the same minute Uber
 * would have made us wait anyway.
 */
export const MENU_SYNC_WINDOW_MS = 60_000

/** The platforms a store's menu is pushed to. */
export const MENU_SYNC_PLATFORMS = ["uberEats", "deliveroo"] as const

export type MenuSyncPlatform = (typeof MENU_SYNC_PLATFORMS)[number]

const MENU_SYNC_RULE: RateLimitRule = { limit: 1, windowMs: MENU_SYNC_WINDOW_MS }

/**
 * The row key for one platform and one establishment.
 *
 * Deliberately NOT `rateLimitKey`: that one lowercases its subject, which is
 * right for an email address and wrong for a Convex id. Ids are case-sensitive,
 * so two different establishments can differ only in the case of one character
 * — folding them together would let one restaurant's edit claim another's
 * window and leave that menu unpushed.
 */
export function menuSyncKey(platform: MenuSyncPlatform, storeId: string): string {
  return `menuSync:${platform}:${storeId}`
}

export interface MenuSyncClaim {
  /** True when this call owns the window and must schedule the push. */
  claimed: boolean
  /** When the push should run. Only meaningful when `claimed`. */
  runAt: number
}

/** One `rateLimits` row, as this bookkeeping cares about it. */
interface RateLimitRow {
  _id: unknown
  windowStart: number
  count: number
}

/**
 * The slice of `ctx.db` this reads and writes.
 *
 * Reached through one cast rather than declared on the parameter, because a
 * structural type cannot express it: an app's generated `db.query` is generic
 * over that app's table names and index names, and any hand-written shape loose
 * enough for `MutationCtx` to satisfy is also loose enough to be useless. The
 * parameter therefore asks only for a `db`, and the cast is confined to this
 * one function — the same trade `consumeRateLimit` above makes with `ctx: any`,
 * one notch tighter.
 */
interface RateLimitDb {
  query(table: "rateLimits"): {
    withIndex(
      index: "by_key",
      range: (q: { eq(field: "key", value: string): unknown }) => unknown
    ): { first(): Promise<RateLimitRow | null> }
  }
  insert(table: "rateLimits", doc: RateLimitWindow & { key: string }): Promise<unknown>
  patch(id: never, patch: RateLimitWindow): Promise<void>
}

/**
 * Claim the menu-sync window for one platform and one establishment.
 *
 * Returns `claimed: false` when a push is already booked for this window — the
 * caller schedules nothing and the edit is carried by the push that is already
 * coming. Unlike `consumeRateLimit` this never throws: a catalogue write must
 * not fail because its platform push was already queued.
 */
export async function claimMenuSyncWindow(
  ctx: { db: unknown },
  platform: MenuSyncPlatform,
  storeId: string,
  now: number = Date.now()
): Promise<MenuSyncClaim> {
  const key = menuSyncKey(platform, storeId)
  const db = ctx.db as RateLimitDb

  const existing = await db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first()

  const verdict = checkRateLimit(
    existing ? { windowStart: existing.windowStart, count: existing.count } : null,
    MENU_SYNC_RULE,
    now
  )

  if (!verdict.allowed || !verdict.next) {
    return { claimed: false, runAt: verdict.retryAt ?? now + MENU_SYNC_WINDOW_MS }
  }

  if (existing) {
    await db.patch(existing._id as never, verdict.next)
  } else {
    await db.insert("rateLimits", { key, ...verdict.next })
  }

  return { claimed: true, runAt: verdict.next.windowStart + MENU_SYNC_WINDOW_MS }
}
