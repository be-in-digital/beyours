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
 * - **Per row the server resolved**, added for the gamification endpoints. A
 *   key derived from a document the handler looked up — the QR code behind
 *   `args.code` — is not caller-controlled in the way a string argument is:
 *   inventing another value does not produce another valid row. It is the
 *   closest thing to a per-caller identity available here, and the reason the
 *   prize drain is bounded even though the cooldown it defeats is not fixable.
 *
 * WHAT THIS STILL CANNOT DO: bind a play to a person. The game's cooldown is
 * keyed on a `fingerprint` the browser supplies, and no amount of limiting
 * makes that unforgeable — a caller who wants another turn sends another
 * string. The windows above bound the damage per table and per restaurant;
 * they do not restore the cooldown. Treat the cooldown as fairness, not as a
 * control.
 *
 * A fixed window rather than a sliding one: it can admit up to twice the limit
 * across a boundary, and that is an acceptable price for a rule an operator can
 * read off the row — `count` since `windowStart` — when asked why a message was
 * refused.
 */

import { v } from "convex/values"
import { RefusalError } from "./refusal"

/** One counter, as the limiter cares about it. */
export interface RateLimitWindow {
  windowStart: number
  count: number
}

export interface RateLimitRule {
  /** How many are allowed inside one window. */
  limit: number
  windowMs: number
  /**
   * Whether to lowercase the subject before it becomes a key.
   *
   * True for an address a human types: one address is one address however it
   * was capitalised, and a limiter that disagrees is one `Shift` away from
   * being no limiter. **False for a document id**, which is case-SENSITIVE —
   * folding two ids together lets one restaurant consume another's window, and
   * on `orderPerStore` that means one establishment closing another's till.
   * `menuSyncKey` at the foot of this file exists for exactly this reason and
   * documents it; every id-keyed rule here now says the same thing in the one
   * place the key is actually built.
   */
  foldSubjectCase: boolean
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
  contactPerEmail: { limit: 3, windowMs: 60 * 60_000, foldSubjectCase: true },
  /**
   * Everything arriving at one restaurant. Sixty an hour is far above what a
   * contact form sees and far below what a flood wants.
   */
  contactPerStore: { limit: 60, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * Newsletter sign-ups for one address. Re-subscribing is normal; doing it
   * five times an hour is not.
   */
  subscribePerEmail: { limit: 5, windowMs: 60 * 60_000, foldSubjectCase: true },
  /** Sign-ups arriving at one restaurant. */
  subscribePerStore: { limit: 100, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * One device asking to play. The game's own cooldown is a day, so five in an
   * hour is already far outside honest use — it is the referral bonus and the
   * retry after a dropped connection, not a player. Dodged by inventing a new
   * `fingerprint`, which is exactly why the two below exist.
   */
  gamePlayPerFingerprint: { limit: 5, windowMs: 60 * 60_000, foldSubjectCase: true },
  /**
   * Every play on one QR code, keyed on the id the server resolved rather than
   * the string the caller sent. This is the one a drain cannot dodge: a code is
   * printed on a table, and inventing another does not produce a valid one.
   * A table seats a handful of people and a genuine device plays once a day,
   * so ten an hour is already a table turning over faster than it can.
   *
   * Read what this does and does not buy. It bounds the RATE, never the stock:
   * against a five-prize budget the first ten plays still empty it, because
   * nothing here can tell one person sending ten fingerprints from ten diners.
   * Lowering it far enough to protect the stock would refuse real players
   * first. Binding a play to a person needs a control this platform does not
   * have — a sign-in, or an anti-automation check at the edge.
   */
  gamePlayPerQr: { limit: 10, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * Every play across one restaurant's tables, because an attacker seated in
   * the room can photograph several codes and multiply the window above.
   */
  gamePlayPerStore: { limit: 200, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * Scan counters. Scanning is cheap and legitimately repeated — a diner
   * reopening the page is a scan — so this only stops a counter being driven
   * for its own sake.
   */
  gameScanPerQr: { limit: 60, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * Referral codes minted at one restaurant. One row per device is the design;
   * a new device every second is a loop writing rows.
   */
  gameReferralPerStore: { limit: 100, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * Friend welcomes granted by ONE referral code — the row the server resolved
   * from `args.ref`, not the string the caller sent.
   *
   * A friend arriving on a share link skips the required actions, and that
   * exemption turns on `isFirstPlay`, which is per fingerprint: every rotated
   * fingerprint is a first-timer, so one minted code took 120 plays past a
   * store demanding three Google reviews without a single refusal. Three a day
   * per code is a genuine share among friends; past it the fourth friend still
   * plays, they just do the action like everybody else. That degradation is why
   * this number can be small without costing anyone a game.
   */
  gameFriendWelcomePerReferral: {
    limit: 3,
    windowMs: 24 * 60 * 60_000,
    foldSubjectCase: false,
  },
  /**
   * Prize claims for one address. A claim sends mail to an address the caller
   * chose, so this window is the relay bound, and it is deliberately as tight
   * as the contact form's.
   */
  gameClaimPerEmail: { limit: 3, windowMs: 60 * 60_000, foldSubjectCase: true },
  /** Prize claims arriving at one restaurant. */
  gameClaimPerStore: { limit: 60, windowMs: 60 * 60_000, foldSubjectCase: false },
  /**
   * Orders placed at one restaurant. Set well above a real rush — a busy
   * service is dozens an hour, not hundreds — because refusing a paying
   * customer costs more than the junk row this stops. Prices, options and
   * discounts are already recomputed server-side, so what remains to bound is
   * database and kitchen-ticket noise rather than value extraction.
   */
  orderPerStore: { limit: 300, windowMs: 60 * 60_000, foldSubjectCase: false },
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
 * Folding is per rule, not universal. An address is one address however it was
 * typed, so folding it is what makes the limiter agree with the subscriber
 * lookup beside it. A document id is case-SENSITIVE, so folding it is a bug:
 * it merges windows that must stay apart. This used to fold everything, which
 * quietly put every id-keyed rule in the second category.
 */
export function rateLimitKey(name: RateLimitName, subject: string): string {
  const subjectKey = RATE_LIMITS[name].foldSubjectCase ? subject.toLowerCase() : subject
  return `${name}:${subjectKey}`
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
  /* Order fields. A postal address has real-world bounds; an order line's note
     is a sentence to the kitchen, not a document. Added because `orders.create`
     capped the top-level `notes` and left `items[].notes` and every
     `deliveryAddress` field unbounded — a 1 MB street landed in a stored row. */
  street: 200,
  city: 100,
  postalCode: 20,
  country: 100,
  instructions: 500,
  lineNote: 500,
  name: 120,
  email: 254, // RFC 5321's maximum path length.
  phone: 40,
  subject: 200,
  message: 5_000,
  /* Gamification. `play` bounded `completedActions` and nothing else, beside a
     cap that exists precisely to stop a row being used as free storage. A
     500 KB `userAgent` and a 200 000-character `fingerprint` were both stored,
     and the fingerprint also becomes a `rateLimits.key` on the `by_key` INDEX.
     The client sends a UUID and a real user agent, so both of these are
     generous by an order of magnitude. */
  fingerprint: 200,
  userAgent: 512,
} as const

export class FieldTooLongError extends RefusalError<"field_too_long"> {
  constructor(
    readonly field: keyof typeof FIELD_LIMITS,
    readonly limit: number
  ) {
    super(
      "FieldTooLongError",
      "field_too_long",
      `Le champ « ${field} » dépasse ${limit} caractères.`,
      { field, limit }
    )
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

export class RateLimitedError extends RefusalError<"rate_limited"> {
  constructor(readonly retryAt: number) {
    super(
      "RateLimitedError",
      "rate_limited",
      "Trop de requêtes. Merci de réessayer dans quelques minutes.",
      { retryAt }
    )
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

/**
 * Whether one more call would be admitted, without consuming anything.
 *
 * For a QUERY, which cannot write and so cannot meter. `getSession` needs it to
 * stop advertising a friend-welcome that `play` will refuse: the exemption is
 * metered per referral row, and the session was computing it with no reference
 * to that window, so the fourth friend on a share link was sent straight to the
 * wheel and lost a spin to an error the screen had been told was impossible.
 *
 * Never use this to guard a mutation. Read-then-write across two calls is a gap
 * a mutation does not need — `consumeRateLimit` decides and records in one.
 */
export async function peekRateLimit(
  ctx: any,
  name: RateLimitName,
  subject: string,
  now: number = Date.now()
): Promise<boolean> {
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q: any) => q.eq("key", rateLimitKey(name, subject)))
    .first()

  return checkRateLimit(
    existing ? { windowStart: existing.windowStart, count: existing.count } : null,
    RATE_LIMITS[name],
    now
  ).allowed
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

const MENU_SYNC_RULE: RateLimitRule = {
  limit: 1,
  windowMs: MENU_SYNC_WINDOW_MS,
  // Keyed on an establishment id by `menuSyncKey` below, which has never
  // folded. Stated rather than made optional, so a rule cannot be added
  // without someone deciding which kind of subject it carries.
  foldSubjectCase: false,
}

/**
 * The row key for one platform and one establishment.
 *
 * Separate from `rateLimitKey` for a reason that used to be sharper than it is
 * now. `rateLimitKey` lowercased every subject, which is right for an email
 * address and wrong for a Convex id: ids are case-sensitive, so two different
 * establishments can differ only in the case of one character, and folding
 * them together would let one restaurant's edit claim another's window and
 * leave that menu unpushed. This function existed to escape that.
 *
 * As of #323 `rateLimitKey` folds per rule and no longer has the flaw — the
 * six id-keyed windows added there had inherited it. This one stays as it is:
 * it is not a `RateLimitName`, it carries a platform as well as an id, and
 * rewriting a working key would change every live row for no gain.
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
