/**
 * A fixed-window rate limiter for the mutations of this site that anyone — or
 * any signed-in account — can call in a loop.
 *
 * WHY THIS IS A LOCAL MODULE AND NOT AN IMPORT: `apps/site` has zero engine
 * dependencies. It is the commercial site, not an instance of the product, and
 * it must stay installable without a `read:packages` token. So the design of
 * `@be-yours/convex-functions/rateLimit` is ported here rather than
 * imported. Two differences from the original, both deliberate:
 *
 * 1. `consumeRateLimit` takes a real `MutationCtx`. The engine's copy is typed
 *    `ctx: any` because it is rendered from two different apps with two
 *    different generated data models; a single-app port has exactly one, so the
 *    type is available and is used.
 * 2. A rule declares whether its subject is case-folded. The engine folds every
 *    subject, which is right for an email address and wrong for a Convex id —
 *    ids are case-sensitive, and folding two of them together would let one
 *    affiliate spend another's quota.
 *
 * WHAT THIS CANNOT DO, said plainly: **there is no IP address here.** A Convex
 * mutation sees `auth`, `db`, `scheduler` and `storage`; the caller's address is
 * not among them, and only an `httpAction` could reach it. Routing the contact
 * form through one to recover the IP would add a public HTTP route to the
 * surface — the opposite of the direction this work is taking. So the keys are
 * what a mutation can actually know: the address the caller typed, the affiliate
 * profile the server resolved, and the site itself.
 *
 * A fixed window rather than a sliding one. It can admit up to twice the limit
 * across a boundary, and that is an acceptable price for a rule an operator can
 * read off the row — `count` since `windowStart` — when asked why a submit was
 * refused. The doubling is pinned by a test rather than left to be discovered.
 */

import type { MutationCtx } from "./_generated/server";

/** One counter, as the limiter cares about it. */
export interface RateLimitWindow {
  windowStart: number;
  count: number;
}

export interface RateLimitRule {
  /** How many are allowed inside one window. */
  limit: number;
  windowMs: number;
  /**
   * Whether the subject is lowercased into the key.
   *
   * `true` for an email address: it is one address however it was typed, and a
   * limiter that disagrees with the row it protects is one `Shift` key away
   * from being no limiter at all — `contactLeads` stores the address folded.
   *
   * `false` for a Convex id or a fixed constant: ids are case-sensitive, so two
   * distinct affiliates can differ only in the case of one character, and
   * folding them would let one spend the other's quota.
   */
  foldSubjectCase: boolean;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** The window to persist. Absent when nothing needs writing. */
  next?: RateLimitWindow;
  /** When the caller may try again, if refused. */
  retryAt?: number;
}

const HOUR = 60 * 60_000;

/**
 * The single subject for every site-wide window.
 *
 * There is no `storeId` here — the tenant of this deployment is the site — so
 * the outer window of each pair is global. That is the point of it: an attacker
 * can invent addresses and accounts all day, and every one of them lands on
 * this row.
 */
export const SITE_SUBJECT = "site";

/** The windows this site enforces, and the reasoning behind each number. */
export const RATE_LIMITS = {
  /**
   * One prospect writing to us. Three an hour covers a genuine correction ("I
   * gave the wrong phone number") and stops a loop. Trivially dodged by
   * changing the address — which is exactly why it is not the only one.
   */
  contactPerEmail: { limit: 3, windowMs: HOUR, foldSubjectCase: true },
  /**
   * Every contact submit reaching the site, whatever address it claims. This is
   * the one nothing dodges, and it bounds the lead rows and the internal
   * notification mail.
   *
   * Forty an hour is roughly two hundred times this form's real volume — it
   * sees single figures a day — and above any campaign or press burst it has
   * had. Sized on that, and not larger, because a bigger number does not buy
   * safety from the obvious objection: a global window converts a flood into a
   * lockout, and an attacker willing to spend the calls can trip any ceiling,
   * so the ceiling should be the one that bounds the flood soonest. What
   * protects a real visitor caught in that hour is the copy — they are told to
   * retry — and the address printed beside the form.
   */
  contactSiteWide: { limit: 40, windowMs: HOUR, foldSubjectCase: false },
  /**
   * Confirmation emails leaving the site — and only these.
   *
   * This is the relay bound, and it is deliberately tighter than the submit
   * bound above it. The confirmation is the one message addressed to somebody
   * the caller chose; the team notification only ever reaches our own inbox. So
   * the confirmation is what can put unsolicited mail in a stranger's inbox and
   * spend the reputation of the SES identity that also sends renewal receipts
   * and dunning mail. Twenty an hour is roughly twenty times the site's real
   * lead volume and low enough that a worst-case day is invisible to a
   * complaint rate.
   *
   * Refusing this window does NOT refuse the submit: the lead is still stored
   * and the team is still told. Losing a prospect costs more than a missing
   * courtesy email.
   */
  contactConfirmationSiteWide: {
    limit: 20,
    windowMs: HOUR,
    foldSubjectCase: false,
  },
  /**
   * One prospect joining the waitlist. Mirrors `contactPerEmail`, and exists
   * for the same reason: a genuine correction is a couple of submits, a loop is
   * not. Keyed on the address the caller typed, whether or not it is on the
   * list, so the counter cannot answer "is this address registered?".
   */
  whitelistPerEmail: { limit: 3, windowMs: HOUR, foldSubjectCase: true },
  /**
   * Every waitlist join reaching the site.
   *
   * SEPARATE from `contactSiteWide`, and that separation is the point. Sharing
   * that window made forty anonymous waitlist joins spend the contact form's
   * entire hourly budget, so one loop took down the only way a prospect can
   * reach the company. A shared global window turns any flood into a lockout of
   * an unrelated surface; two windows keep the blast radius on the endpoint
   * being abused.
   */
  whitelistSiteWide: { limit: 40, windowMs: HOUR, foldSubjectCase: false },
  /**
   * Checkouts opened from one email address.
   *
   * `stripe.createCheckoutSession` is public and unauthenticated: it creates
   * an `orders` row and a Stripe coupon before anything is paid, and it was
   * bounded by nothing at all. Five an hour covers a buyer who abandons and
   * comes back, changes plan, or has a card declined twice, and stops the
   * loop from one address. Dodged by inventing addresses — which is why the
   * window below exists.
   */
  checkoutPerEmail: { limit: 5, windowMs: HOUR, foldSubjectCase: true },
  /**
   * Every checkout opened on the site, whatever address it claims.
   *
   * What this bounds honestly: the rate at which anonymous callers can create
   * order rows, Stripe coupon objects and founders holds. Sixty an hour is far
   * above this site's real volume — it sells a handful of builds — so a
   * genuine buyer, including on a launch-day burst, never meets it.
   *
   * What it does NOT do, said plainly: it cannot stop a burst from making the
   * founders offer look sold out. That offer has ten slots, and ten calls is
   * fewer than any ceiling a real storefront can carry. The duration of such a
   * burst is bounded by FOUNDERS_HOLD_MS instead (see ./foundersOffer), and
   * the offer's true cap is the Stripe coupon's max_redemptions, never this
   * counter. Preventing it outright would mean authenticating or challenging
   * the checkout, which is a product decision.
   */
  checkoutSiteWide: { limit: 60, windowMs: HOUR, foldSubjectCase: false },
  /**
   * Invoice upload URLs minted by one affiliate.
   *
   * An affiliate attaches one invoice per commission, and payouts run twice a
   * week — so a working session is a handful of files, not a stream. Six an
   * hour absorbs picking the wrong PDF several times over. Keyed on the
   * `affiliateUsers` id the server resolved rather than on anything the caller
   * sent, so inventing a value does not produce another quota.
   */
  invoiceUploadUrlPerAffiliate: {
    limit: 6,
    windowMs: HOUR,
    foldSubjectCase: false,
  },
  /**
   * Invoice upload URLs minted across the whole site.
   *
   * `affiliateUsers.createAfterSignup` is a public mutation: any signed-in
   * account can give itself an affiliate profile, so the per-affiliate window
   * above is dodged by making more accounts. This one is not. Two hundred an
   * hour is far above the whole programme's real usage.
   */
  invoiceUploadUrlSiteWide: {
    limit: 200,
    windowMs: HOUR,
    foldSubjectCase: false,
  },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Decide whether this call is allowed, and what the counter becomes.
 *
 * Pure, so the policy can be reasoned about without a database — and so the
 * boundary behaviour is pinned by tests rather than discovered in production.
 */
export function checkRateLimit(
  existing: RateLimitWindow | null,
  rule: RateLimitRule,
  now: number,
): RateLimitVerdict {
  // No counter, or one whose window has run out: this call starts a new one.
  if (!existing || now - existing.windowStart >= rule.windowMs) {
    return { allowed: true, next: { windowStart: now, count: 1 } };
  }

  if (existing.count >= rule.limit) {
    return { allowed: false, retryAt: existing.windowStart + rule.windowMs };
  }

  return {
    allowed: true,
    next: { windowStart: existing.windowStart, count: existing.count + 1 },
  };
}

/** The row key for one limit and one subject. */
export function rateLimitKey(name: RateLimitName, subject: string): string {
  const rule: RateLimitRule = RATE_LIMITS[name];
  return `${name}:${rule.foldSubjectCase ? subject.toLowerCase() : subject}`;
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
  restaurant: 200,
  message: 5_000,
} as const;

export type FieldName = keyof typeof FIELD_LIMITS;

export class FieldTooLongError extends Error {
  constructor(
    readonly field: FieldName,
    readonly limit: number,
  ) {
    super(`Le champ « ${field} » dépasse ${limit} caractères.`);
    this.name = "FieldTooLongError";
  }
}

/** Throw unless every named field fits. */
export function assertFieldLengths(
  fields: Partial<Record<FieldName, string | undefined>>,
): void {
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    const limit = FIELD_LIMITS[field as FieldName];
    if (value.length > limit) {
      throw new FieldTooLongError(field as FieldName, limit);
    }
  }
}

export class RateLimitedError extends Error {
  constructor(readonly retryAt: number) {
    super("Trop de requêtes. Merci de réessayer dans quelques minutes.");
    this.name = "RateLimitedError";
  }
}

/**
 * Consume one unit of a limit. Returns false instead of throwing when the
 * window is spent.
 *
 * Reads and writes `rateLimits` through the caller's own `ctx`, so the counter
 * commits in the same transaction as the write it is protecting — a limiter
 * that commits separately from the thing it limits is a limiter with a gap in
 * it.
 */
export async function tryConsumeRateLimit(
  ctx: Pick<MutationCtx, "db">,
  name: RateLimitName,
  subject: string,
  now: number = Date.now(),
): Promise<RateLimitVerdict> {
  const key = rateLimitKey(name, subject);
  const rule: RateLimitRule = RATE_LIMITS[name];

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  const verdict = checkRateLimit(
    existing ? { windowStart: existing.windowStart, count: existing.count } : null,
    rule,
    now,
  );

  if (!verdict.allowed || !verdict.next) {
    return { allowed: false, retryAt: verdict.retryAt ?? now + rule.windowMs };
  }

  if (existing) {
    await ctx.db.patch(existing._id, verdict.next);
  } else {
    await ctx.db.insert("rateLimits", { key, ...verdict.next });
  }

  return verdict;
}

/** Consume one unit of a limit, or refuse the call. */
export async function consumeRateLimit(
  ctx: Pick<MutationCtx, "db">,
  name: RateLimitName,
  subject: string,
  now: number = Date.now(),
): Promise<void> {
  const verdict = await tryConsumeRateLimit(ctx, name, subject, now);
  if (!verdict.allowed) {
    throw new RateLimitedError(
      verdict.retryAt ?? now + RATE_LIMITS[name].windowMs,
    );
  }
}
