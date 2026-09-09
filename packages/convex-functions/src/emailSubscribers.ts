/**
 * Email subscribers functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { clampPagination } from "./pagination"
import { assertFieldLengths, consumeRateLimit } from "./rateLimit"

/**
 * The shape an address has to have before it is allowed onto a mailing list.
 *
 * Deliberately the same expression `parseSubscriberCsv` applies to an imported
 * row. A CSV import already refused `pas-un-email`; `create` — which every
 * storefront signup goes through — accepted it, wrote it, and told the visitor
 * to check their inbox. The row was then unmailable in the one way that costs
 * money: SES bounces it, the bounce counts towards the 5% ratio AWS suspends an
 * account over, and the restaurant loses its transactional mail along with its
 * marketing.
 *
 * Not a full RFC 5322 parser, and not trying to be — that grammar admits
 * addresses no mail provider accepts. This rejects what is obviously not an
 * address, which is what a signup form is for.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Normalise a submitted address, or reject it.
 *
 * Trimming is part of the check rather than something the caller is trusted to
 * have done: a trailing space arrives from every copy-paste, and an untrimmed
 * address stored alongside its trimmed twin is two rows for one person, only
 * one of which any lookup will ever find.
 */
export function normalizeSubscriberEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  return EMAIL_SHAPE.test(email) ? email : null
}

/**
 * The two ways a signup is refused, as codes a screen can switch on.
 *
 * `ConvexError` rather than a plain `Error` for the reason `lib/convex-error.ts`
 * documents: Convex redacts a thrown message in production and the browser
 * receives "Server Error". A footer that cannot tell "you are already on the
 * list" from "the write failed" has to hedge — which is what it did, telling
 * everyone "Cet email est déjà inscrit, ou une erreur est survenue". `data`
 * survives the redaction, so each case can be answered with the truth.
 */
export const SUBSCRIBE_REFUSALS = {
  invalidEmail: "invalid_email",
  alreadySubscribed: "already_subscribed",
} as const

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("unsubscribed"),
  v.literal("bounced"),
  v.literal("complained")
)

const sourceValidator = v.union(
  v.literal("order"),
  v.literal("import"),
  v.literal("storefront_form"),
  v.literal("gamification"),
  v.literal("api"),
  v.literal("manual")
)

const metadataValidator = v.object({
  language: v.optional(v.string()),
  city: v.optional(v.string()),
  totalOrders: v.number(),
  totalSpent: v.number(),
  lastOrderAt: v.optional(v.number()),
  averageOrderValue: v.number(),
  favoriteProducts: v.array(v.string()),
  orderTypes: v.array(v.string()),
})

// === QUERIES ===

/**
 * One page of the mailing list, newest signup first.
 *
 * This collected every subscriber the establishment had ever had, on a live
 * `useQuery` behind the Abonnés screen, and then narrowed the result in
 * JavaScript. Convex refuses a transaction that reads more than 16,384
 * documents, so the screen stopped loading — permanently, with no admin action
 * that clears it — at the point the mailing list succeeded. Since #316 every
 * storefront signup, every order and every game play adds a row, so that point
 * arrives by growing, not by doing anything wrong.
 *
 * `status` is an equality the schema indexes, so the status tab reads the page
 * it shows. `source` is NOT: no index carries it, and a post-`paginate` filter
 * would return a page of two rows out of fifteen and call it a page. The screen
 * narrows source — and the search box — over the rows it has loaded, and says
 * so; « Charger plus » widens what they can see. Same shape as
 * `/dashboard/orders`.
 */
export const list = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(statusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx: any,
    args: {
      storeId: string
      status?: string
      paginationOpts: { numItems: number; cursor: string | null }
    }
  ) => {
    const page = clampPagination(args.paginationOpts)

    if (args.status) {
      return await ctx.db
        .query("emailSubscribers")
        .withIndex("by_storeId_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .order("desc")
        .paginate(page)
    }

    return await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate(page)
  },
}

/**
 * One page of the audience a campaign should reach.
 *
 * `list` collects every active subscriber in one go, which is what made sending
 * a campaign a single unbounded loop. Paginating moves the boundary into the
 * database, so a batch reads what it is about to send and nothing more, and the
 * cursor it returns is what lets the next batch pick up exactly where this one
 * stopped.
 */
export const pageForSending = {
  args: {
    storeId: v.id("stores"),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "active")
      )
      .paginate({ cursor: args.cursor, numItems: args.numItems })
  },
}

export const getById = {
  args: {
    id: v.id("emailSubscribers"),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db.get(args.id)
    if (!subscriber) return null
    // If storeId is provided, enforce store scoping
    if (args.storeId && subscriber.storeId !== args.storeId) return null
    return subscriber
  },
}

export const getByEmail = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", args.email.toLowerCase())
      )
      .first()
  },
}

/**
 * Every subscriber holding this address, whatever store they belong to.
 *
 * For SES feedback, and only for it. A bounce or a complaint is a fact about
 * the MAILBOX: SES reports it by recipient address in `mail.destination`, and
 * the `X-Store-Id` header that would name one store is present only when the
 * identity is configured to include the original headers — which nothing
 * provisioned until `setup-aws.sh` grew a Step 2b. Correlating on the address
 * is what lets a notification arriving without those headers still suppress the
 * address instead of being dropped.
 *
 * ACROSS STORES ON PURPOSE, and it is the conservative direction rather than
 * the convenient one. A hard bounce means the mailbox does not exist, which is
 * equally true of every store that holds it; a complaint means this person
 * reported the operator for spam, and the rate AWS suspends over is
 * per-ACCOUNT — one AWS account per client, every store of theirs inside it.
 * Suppressing the address wherever it appears is what protects the account. The
 * cost is one subscriber row of a store that did not send the message, which is
 * a row that would have bounced too.
 *
 * Capped rather than unbounded: an address in more than 32 of one owner's
 * stores is not a case this has to serve, and a webhook handler must not scan
 * without a ceiling.
 */
export const listByEmail = {
  args: { email: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailSubscribers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email.toLowerCase()))
      .take(32)
  },
}

/** The five states a subscriber can be in, in the order the screens read them. */
export const SUBSCRIBER_STATUSES = [
  "active",
  "pending",
  "unsubscribed",
  "bounced",
  "complained",
] as const

/**
 * The most rows `countByStatus` will read per status.
 *
 * Convex has no count: a total is however many documents you were willing to
 * read. This query is a live `useQuery` behind the email dashboard and inside
 * the campaign wizard, so it re-runs on every signup — the old shape collected
 * the whole list each time and, past 16,384 rows, took both screens down for
 * good.
 *
 * Five statuses at this ceiling is 10,005 documents in the worst case, well
 * under the transaction limit, and nothing like it in practice: `active`
 * dominates a real list and the other four are small. Where a status does reach
 * the ceiling the count is a floor, and the answer says `truncated` so the
 * screen can render « 2 000+ » rather than a number it has not counted.
 */
export const SUBSCRIBER_COUNT_SCAN_LIMIT = 2_000

/**
 * How many subscribers the establishment has, per status.
 *
 * Counted through `by_storeId_status` — one index range per status, capped —
 * rather than by collecting the table and calling `.filter().length` five
 * times. A count that costs the whole table is the defect this screen died of.
 */
export const countByStatus = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: { storeId: string }) => {
    const counts: Record<string, number> = {}
    let truncated = false
    let total = 0

    for (const status of SUBSCRIBER_STATUSES) {
      // One more than the cap, so a full read is distinguishable from a list
      // that happens to be exactly the cap long.
      const rows = await ctx.db
        .query("emailSubscribers")
        .withIndex("by_storeId_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", status)
        )
        .take(SUBSCRIBER_COUNT_SCAN_LIMIT + 1)

      const capped = Math.min(rows.length, SUBSCRIBER_COUNT_SCAN_LIMIT)
      if (rows.length > SUBSCRIBER_COUNT_SCAN_LIMIT) truncated = true
      counts[status] = capped
      total += capped
    }

    return {
      total,
      active: counts.active ?? 0,
      pending: counts.pending ?? 0,
      unsubscribed: counts.unsubscribed ?? 0,
      bounced: counts.bounced ?? 0,
      complained: counts.complained ?? 0,
      /** At least one status hit the cap: every figure here is a floor. */
      truncated,
    }
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    source: sourceValidator,
    tags: v.optional(v.array(v.string())),
    consentSource: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    assertFieldLengths({
      email: args.email,
      name: args.firstName,
    })

    // Before the rate limit, because a malformed address is not an attempt at
    // anything — spending one of the visitor's five hourly signups on their
    // typo would lock them out of the correction.
    const email = normalizeSubscriberEmail(args.email)
    if (email === null) {
      throw new ConvexError({
        code: SUBSCRIBE_REFUSALS.invalidEmail,
        message: "Adresse email invalide",
      })
    }

    // Public by necessity — a storefront visitor has no session — so the same
    // two windows the contact form uses apply here. Re-subscribing is normal;
    // doing it five times an hour is a script.
    //
    // Consumed BEFORE the uniqueness check, not after: a caller who guesses
    // addresses one at a time is exactly what the limiter is for, and a check
    // that throws first spends nothing and answers freely whether an address is
    // on the list.
    await consumeRateLimit(ctx, "subscribePerEmail", email)
    await consumeRateLimit(ctx, "subscribePerStore", args.storeId)

    const now = Date.now()
    const { token: tokenBytes, expiresAt } = doubleOptInCredential()

    const existing = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", email)
      )
      .first()

    if (existing) {
      // A `pending` row is someone who asked and never got their link — the
      // confirmation bounced, SES refused it because the account is still
      // sandboxed, the mail went to spam, or the 48 hours simply ran out.
      // Refusing them was a one-way door: `create` was the only way in, there
      // is no resend anywhere in the product, and the confirmation page told
      // them to "se réinscrire", which threw. Re-minting is the recovery, and
      // the rate limit above is what keeps it from being a mail cannon.
      if (existing.status === "pending") {
        await ctx.db.patch(existing._id, {
          doubleOptInToken: tokenBytes,
          doubleOptInExpiresAt: expiresAt,
          consentAt: now,
          updatedAt: now,
        })
        return existing._id
      }
      // Every other status is a decision already taken — confirmed,
      // unsubscribed, bounced or complained — and none of them should be
      // quietly overwritten by anyone who can type the address into a form.
      throw new ConvexError({
        code: SUBSCRIBE_REFUSALS.alreadySubscribed,
        message: "Cet email est déjà inscrit",
      })
    }

    // Manual source = admin added, skip double opt-in
    const isManual = args.source === "manual"

    return await ctx.db.insert("emailSubscribers", {
      storeId: args.storeId,
      email,
      firstName: args.firstName,
      lastName: args.lastName,
      status: isManual ? "active" : "pending",
      source: args.source,
      tags: args.tags ?? [],
      consentAt: now,
      consentSource: args.consentSource ?? `${args.source} subscription`,
      ...(isManual
        ? { doubleOptInAt: now }
        : { doubleOptInToken: tokenBytes, doubleOptInExpiresAt: expiresAt }),
      bounceCount: 0,
      metadata: {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        favoriteProducts: [],
        orderTypes: [],
      },
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailSubscribers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * How many rows pointing at a subscriber one pass clears.
 *
 * `emailEvents` takes a row per message, open and click, so a subscriber who
 * has been on the list for years carries hundreds — and a Convex mutation is
 * one transaction with a bounded budget. 512 matches `PROMOTION_USAGE_BATCH`,
 * for the same reasons set out there.
 */
export const SUBSCRIBER_DEPENDENT_BATCH = 512

/** Tables holding a REQUIRED `subscriberId`, cleared before the subscriber is. */
const SUBSCRIBER_DEPENDENTS = ["emailAutomationRuns", "emailEvents"] as const

export interface SubscriberRemovalResult {
  /** Dependent rows cleared in this pass. */
  deleted: number
  /** False while rows still point at the subscriber, which is still there. */
  complete: boolean
}

/**
 * Delete a subscriber, and everything whose schema promises they exist.
 *
 * WHAT WENT WRONG (#412 P3-F2). This was a bare `ctx.db.delete(args.id)`,
 * behind a live button on the subscribers screen, over TWO non-optional foreign
 * keys: `emailAutomationRuns.subscriberId` and `emailEvents.subscriberId`.
 * `v.id()` validates how an id is ENCODED, never that it still points at
 * anything, so nothing complained — and both tables were left holding a promise
 * the database could no longer keep. `privacy.ts` has cleared exactly these two
 * tables, in exactly this order, since the erasure path was written, and says
 * why in `eraseSubscriberDependents`; this delete was the one path that did not
 * call it.
 *
 * A CASCADE, not a refusal, and deliberately: every one of those rows is
 * personal data ABOUT the person being removed — which message reached them,
 * when they opened it, which automation step they were at. Keeping them after
 * the owner has removed the person is the outcome art. 17 exists to prevent,
 * and it is the outcome `previewErasure` would then have to report as residue.
 *
 * MULTI-PASS, like the erasure it mirrors. The dependents go first, a batch at
 * a time; the subscriber goes only on the pass that finishes them, so a
 * half-drained delete never leaves the two tables pointing at nothing.
 * `complete: false` is the caller's signal to schedule the next pass — see
 * `purgeRemoval`.
 */
export const remove = {
  args: { id: v.id("emailSubscribers") },
  handler: async (ctx: any, args: any): Promise<SubscriberRemovalResult> => {
    const subscriber = await ctx.db.get(args.id)
    // Idempotent: a rescheduled pass can arrive after the last one finished.
    if (!subscriber) return { deleted: 0, complete: true }

    let budget = SUBSCRIBER_DEPENDENT_BATCH
    let deleted = 0

    for (const table of SUBSCRIBER_DEPENDENTS) {
      if (budget <= 0) return { deleted, complete: false }

      // `take(budget + 1)`: the extra row is how we learn there is more to do
      // without paying for a count.
      const dependents = await ctx.db
        .query(table)
        .withIndex("by_subscriberId", (q: any) => q.eq("subscriberId", args.id))
        .take(budget + 1)

      const hasMore = dependents.length > budget
      const batch = hasMore ? dependents.slice(0, budget) : dependents
      for (const row of batch) {
        await ctx.db.delete(row._id)
      }
      deleted += batch.length
      budget -= batch.length
      if (hasMore) return { deleted, complete: false }
    }

    await ctx.db.delete(args.id)
    return { deleted, complete: true }
  },
}

/**
 * The rest of the removal, one batch per run, until the subscriber is gone.
 *
 * Internal only, and it is the same handler: the subscriber survives every pass
 * but the last, so re-running `remove` is exactly what finishing means.
 */
export const purgeRemoval = {
  args: { id: v.id("emailSubscribers") },
  handler: async (ctx: any, args: any): Promise<SubscriberRemovalResult> =>
    await remove.handler(ctx, args),
}

export const confirmDoubleOptIn = {
  args: { token: v.string() },
  handler: async (ctx: any, args: any) => {
    // Use dedicated index instead of full table scan
    const subscriber = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_doubleOptInToken", (q: any) =>
        q.eq("doubleOptInToken", args.token)
      )
      .first()
    if (!subscriber) throw new Error("Token invalide")
    // Distinguished, because the page renders these straight to the visitor.
    // A suppressed address holding a live token was being told "votre
    // inscription est déjà confirmée" — untrue, and it sent them away believing
    // they were on a list they had never joined.
    if (subscriber.status === "bounced" || subscriber.status === "complained") {
      throw new Error("Adresse non distribuable")
    }
    if (subscriber.status !== "pending") throw new Error("Abonné déjà confirmé")
    if (subscriber.doubleOptInExpiresAt && Date.now() > subscriber.doubleOptInExpiresAt) {
      throw new Error("Token expiré")
    }

    await ctx.db.patch(subscriber._id, {
      status: "active",
      doubleOptInAt: Date.now(),
      doubleOptInToken: undefined,
      doubleOptInExpiresAt: undefined,
      updatedAt: Date.now(),
    })
    return subscriber._id
  },
}

export const unsubscribe = {
  args: { id: v.id("emailSubscribers") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "unsubscribed",
      unsubscribedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

/**
 * How SES classifies a bounce, and how much of it we are allowed to ignore.
 *
 * `Permanent` is SES saying the mailbox does not exist and never will. Sending
 * to it again does not fail more informatively, it just adds another bounce to
 * the ratio AWS suspends the account over — the published threshold is 5%, and
 * a list built over two years carries enough dead addresses on its own to reach
 * it if every one of them is tried three times.
 *
 * `Transient` is the opposite claim: a full mailbox, a greylisting, a server
 * that was down. Those recover, so they keep the three-strike counter.
 * `Undetermined` means SES could not tell, and an address we cannot prove dead
 * is treated as one that might not be.
 */
const bounceTypeValidator = v.union(
  v.literal("Permanent"),
  v.literal("Transient"),
  v.literal("Undetermined")
)

/**
 * Reduce whatever SES sent to one of its three classifications, or to nothing.
 *
 * The validator above is a closed union, and the webhook's whole dispatch sits
 * inside a `try { } catch { console.error }`. So a fourth value — AWS adding
 * one, or a malformed notification — would fail validation, be swallowed
 * there, and the bounce would not be recorded AT ALL. That is worse than the
 * three-strike behaviour it replaced, which at least counted the event.
 *
 * Normalising at the boundary keeps the validator strict and makes an
 * unrecognised classification behave exactly as no classification does: the
 * counter still moves, and nothing is suppressed on evidence we cannot read.
 */
export function normalizeBounceType(
  raw: unknown
): "Permanent" | "Transient" | "Undetermined" | undefined {
  return raw === "Permanent" || raw === "Transient" || raw === "Undetermined"
    ? raw
    : undefined
}

/** Statuses a bounce may overwrite. */
const MAILABLE_STATUSES = ["pending", "active"]

export const markBounced = {
  args: {
    id: v.id("emailSubscribers"),
    /**
     * Optional so an older caller still type-checks; an absent value is read
     * as the cautious case and keeps the counter, never as a permanent bounce.
     */
    bounceType: v.optional(bounceTypeValidator),
  },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db.get(args.id)
    if (!subscriber) throw new Error("Abonné introuvable")
    const newCount = (subscriber.bounceCount ?? 0) + 1

    const suppress = args.bounceType === "Permanent" || newCount >= 3

    await ctx.db.patch(args.id, {
      bounceCount: newCount,
      // `unsubscribed` and `complained` are already suppressed and say more
      // than "bounced" does — a spam report in particular is the one a
      // regulator asks about. A bounce must not overwrite either.
      status:
        suppress && MAILABLE_STATUSES.includes(subscriber.status)
          ? "bounced"
          : subscriber.status,
      updatedAt: Date.now(),
    })
  },
}

export const markComplained = {
  args: { id: v.id("emailSubscribers") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      status: "complained",
      updatedAt: Date.now(),
    })
  },
}

export const addTag = {
  args: { id: v.id("emailSubscribers"), tag: v.string() },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db.get(args.id)
    if (!subscriber) throw new Error("Abonné introuvable")
    const tags = subscriber.tags ?? []
    if (!tags.includes(args.tag)) {
      await ctx.db.patch(args.id, { tags: [...tags, args.tag], updatedAt: Date.now() })
    }
  },
}

export const removeTag = {
  args: { id: v.id("emailSubscribers"), tag: v.string() },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db.get(args.id)
    if (!subscriber) throw new Error("Abonné introuvable")
    await ctx.db.patch(args.id, {
      tags: (subscriber.tags ?? []).filter((t: string) => t !== args.tag),
      updatedAt: Date.now(),
    })
  },
}

/** A double opt-in token stops being a formality after 48 hours. */
const DOUBLE_OPT_IN_TTL_MS = 48 * 60 * 60 * 1000

/**
 * Mint a confirmation token that is actually a credential.
 *
 * This used to be 32 bytes of `Math.random()`. `Math.random()` is a PRNG, not a
 * CSPRNG — V8 runs xorshift128+, whose internal state is recoverable from a
 * modest run of outputs — so the token confirming "yes, this address consented"
 * was predictable by anyone who could sample the generator. Under a double
 * opt-in scheme the token IS the consent record; a guessable one means the
 * database can assert that someone opted in when they never did, which is the
 * single thing the whole mechanism exists to prevent.
 *
 * `generateDoubleOptInToken()` in `@be-in-digital/marketing` already does this
 * correctly and is deliberately NOT imported: `convex-functions` does not
 * depend on that package, and adding a whole workspace dependency — with the
 * publish-ordering it drags behind it — to reach two lines of `crypto` would
 * cost more than it saves. Both spellings must stay `randomUUID`.
 */
function doubleOptInCredential(now: number = Date.now()) {
  return { token: crypto.randomUUID(), expiresAt: now + DOUBLE_OPT_IN_TTL_MS }
}

export const importBatch = {
  args: {
    storeId: v.id("stores"),
    subscribers: v.array(
      v.object({
        email: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
    // Optional, with a default. It was required, and the one caller — the CSV
    // dialog — never sent it, which is half of why every import failed.
    consentSource: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    // `pendingIds` rather than a count alone: the caller has to schedule one
    // confirmation email per row it actually inserted, and a number cannot say
    // which rows those were. Duplicates are skipped, so it is not the input
    // list either.
    const results: {
      inserted: number
      skipped: number
      pendingIds: string[]
    } = { inserted: 0, skipped: 0, pendingIds: [] }

    for (const sub of args.subscribers) {
      // Through the same normaliser every other path uses. This one lower-cased
      // and did NOT trim, which is exactly the case its own doc comment warns
      // about: a CSV column carries a trailing space from every spreadsheet,
      // and « marie@x.fr » stored beside «  marie@x.fr » is two rows for one
      // person, only one of which any `by_storeId_email` seek will ever find.
      // The one that no lookup finds is also the one an erasure request misses.
      const email = normalizeSubscriberEmail(sub.email)
      if (!email) {
        results.skipped++
        continue
      }
      const existing = await ctx.db
        .query("emailSubscribers")
        .withIndex("by_storeId_email", (q: any) =>
          q.eq("storeId", args.storeId).eq("email", email)
        )
        .first()

      if (existing) {
        results.skipped++
        continue
      }

      const credential = doubleOptInCredential(now)

      const id = await ctx.db.insert("emailSubscribers", {
        storeId: args.storeId,
        email,
        firstName: sub.firstName,
        lastName: sub.lastName,
        status: "pending",
        source: "import",
        tags: sub.tags ?? [],
        consentAt: now,
        consentSource: args.consentSource ?? "csv import",
        // Minted here, never accepted from the caller. A confirmation token
        // supplied by whoever is doing the importing is not a confirmation of
        // anything: it lets the importer pre-compute the link that marks their
        // own list as having consented. One per row, so a leaked token is one
        // address rather than the whole import.
        doubleOptInToken: credential.token,
        doubleOptInExpiresAt: credential.expiresAt,
        bounceCount: 0,
        metadata: {
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          favoriteProducts: [],
          orderTypes: [],
        },
        createdAt: now,
        updatedAt: now,
      })
      results.inserted++
      results.pendingIds.push(id)
    }

    return results
  },
}

// === INTERNAL (called by post-order scheduler) ===

/**
 * Take back what a confirmed order added, when that order is cancelled.
 *
 * The counterpart of `updateMetadataIncremental`, and the reason the pair is
 * needed at all: an order can be cancelled AFTER it is confirmed — the state
 * machine allows `confirmed -> cancelled`, deliberately, for the window before
 * the kitchen starts. Counting the money at confirmation and never giving it
 * back would put revenue in `totalSpent` that the restaurant never took, in the
 * one field an owner segments on.
 *
 * Only the numbers are reversed. `lastOrderAt`, `favoriteProducts` and
 * `orderTypes` are merged values with no record of which order contributed
 * what, so un-merging them is not possible without a per-order history — and
 * inventing one to undo a rare cancellation would cost more than it is worth.
 * The consequence, stated rather than hidden: a customer whose only order was
 * cancelled keeps a `lastOrderAt` and may keep a favourite product. Their
 * `totalOrders` and `totalSpent` are correct, which is what the money
 * questions are asked of.
 */
export const reverseMetadataIncremental = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
    orderAmount: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", args.email.toLowerCase())
      )
      .first()

    if (!subscriber) return

    const meta = subscriber.metadata
    // Never below zero: a cancellation whose confirmation was never counted —
    // an order from before this path existed — must not drive the totals
    // negative.
    const newTotal = Math.max(0, meta.totalOrders - 1)
    const newSpent = Math.max(0, meta.totalSpent - args.orderAmount)

    await ctx.db.patch(subscriber._id, {
      metadata: {
        ...meta,
        totalOrders: newTotal,
        totalSpent: newSpent,
        averageOrderValue: newTotal > 0 ? Math.round(newSpent / newTotal) : 0,
      },
      updatedAt: Date.now(),
    })
  },
}

export const updateMetadataIncremental = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
    orderAmount: v.number(), // in cents
    orderType: v.string(),
    productIds: v.array(v.string()),
    orderedAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", args.email.toLowerCase())
      )
      .first()

    if (!subscriber) return // Not a subscriber, skip

    const meta = subscriber.metadata
    const newTotal = meta.totalOrders + 1
    const newSpent = meta.totalSpent + args.orderAmount
    const newAvg = Math.round(newSpent / newTotal)

    // Merge order types
    const orderTypes = meta.orderTypes.includes(args.orderType)
      ? meta.orderTypes
      : [...meta.orderTypes, args.orderType]

    // Merge favorite products (keep last 10)
    const merged = [...new Set([...args.productIds, ...meta.favoriteProducts])].slice(0, 10)

    await ctx.db.patch(subscriber._id, {
      metadata: {
        ...meta,
        totalOrders: newTotal,
        totalSpent: newSpent,
        lastOrderAt: args.orderedAt,
        averageOrderValue: newAvg,
        favoriteProducts: merged,
        orderTypes,
      },
      updatedAt: Date.now(),
    })
  },
}
