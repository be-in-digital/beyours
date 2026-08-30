/**
 * Email subscribers functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { assertFieldLengths, consumeRateLimit } from "./rateLimit"

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

export const list = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(statusValidator),
    source: v.optional(sourceValidator),
  },
  handler: async (ctx: any, args: any) => {
    // Use the compound index when filtering by status
    let results
    if (args.status) {
      results = await ctx.db
        .query("emailSubscribers")
        .withIndex("by_storeId_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .collect()
    } else {
      results = await ctx.db
        .query("emailSubscribers")
        .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
        .collect()
    }
    if (args.source) {
      results = results.filter((s: any) => s.source === args.source)
    }
    return results
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

export const countByStatus = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const all = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return {
      total: all.length,
      active: all.filter((s: any) => s.status === "active").length,
      pending: all.filter((s: any) => s.status === "pending").length,
      unsubscribed: all.filter((s: any) => s.status === "unsubscribed").length,
      bounced: all.filter((s: any) => s.status === "bounced").length,
      complained: all.filter((s: any) => s.status === "complained").length,
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
    const email = args.email.toLowerCase()

    // Check uniqueness
    const existing = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", email)
      )
      .first()
    if (existing) throw new Error("Cet email est déjà inscrit")

    assertFieldLengths({
      email: args.email,
      name: args.firstName,
    })

    // Public by necessity — a storefront visitor has no session — so the same
    // two windows the contact form uses apply here. Re-subscribing is normal;
    // doing it five times an hour is a script.
    await consumeRateLimit(ctx, "subscribePerEmail", email)
    await consumeRateLimit(ctx, "subscribePerStore", args.storeId)

    const now = Date.now()
    const { token: tokenBytes, expiresAt } = doubleOptInCredential()

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

export const remove = {
  args: { id: v.id("emailSubscribers") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
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

export const markBounced = {
  args: { id: v.id("emailSubscribers") },
  handler: async (ctx: any, args: any) => {
    const subscriber = await ctx.db.get(args.id)
    if (!subscriber) throw new Error("Abonné introuvable")
    const newCount = (subscriber.bounceCount ?? 0) + 1
    await ctx.db.patch(args.id, {
      bounceCount: newCount,
      status: newCount >= 3 ? "bounced" : subscriber.status,
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
    const results = { inserted: 0, skipped: 0 }

    for (const sub of args.subscribers) {
      const email = sub.email.toLowerCase()
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

      await ctx.db.insert("emailSubscribers", {
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
