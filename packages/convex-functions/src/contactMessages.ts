/**
 * Contact messages functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { paginationOptsValidator } from "convex/server"
import { clampPagination } from "./pagination"
import { v } from "convex/values"
import { assertFieldLengths, consumeRateLimit } from "./rateLimit"

// === QUERIES ===

/**
 * One page of a store's inbox, newest first.
 *
 * Paginated rather than capped: a message the owner has not read yet may be the
 * hundredth one down after a busy week, and `.take(n)` would put it out of
 * reach for good. `paginate` lets the screen keep asking.
 */
export const list = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(v.union(v.literal("new"), v.literal("read"), v.literal("archived"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx: any, args: any) => {
    if (args.status) {
      return await ctx.db
        .query("contactMessages")
        .withIndex("by_storeId_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .order("desc")
        .paginate(clampPagination(args.paginationOpts))
    }
    return await ctx.db
      .query("contactMessages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate(clampPagination(args.paginationOpts))
  },
}

/**
 * How many messages are still unread, for the badge in the sidebar.
 *
 * Capped, and the cap is the point: this runs on every admin screen, and a
 * badge is worth one bounded read, not a scan of everything the restaurant has
 * ever been sent. Past the cap the exact number stops being information the
 * owner acts on — "99+" says the same thing.
 */
const UNREAD_BADGE_CAP = 99

export const unreadCount = {
  args: {
    storeId: v.id("stores"),
  },
  handler: async (ctx: any, args: any) => {
    const unread = await ctx.db
      .query("contactMessages")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "new")
      )
      .take(UNREAD_BADGE_CAP + 1)

    return {
      count: Math.min(unread.length, UNREAD_BADGE_CAP),
      hasMore: unread.length > UNREAD_BADGE_CAP,
    }
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    // Anyone can call this — a storefront visitor has no session — and until
    // now nothing bounded it. `message` was an unbounded string, so one request
    // could store a megabyte and a loop could fill the restaurant's inbox.
    assertFieldLengths({
      name: args.name,
      email: args.email,
      phone: args.phone,
      subject: args.subject,
      message: args.message,
    })

    // Two windows, because neither is enough alone: the per-address one stops
    // the double-submit and the naive script, and is dodged by changing the
    // address; the per-restaurant one cannot be dodged and bounds the flood.
    await consumeRateLimit(ctx, "contactPerEmail", args.email)
    await consumeRateLimit(ctx, "contactPerStore", args.storeId)

    return await ctx.db.insert("contactMessages", {
      storeId: args.storeId,
      name: args.name,
      email: args.email.toLowerCase(),
      phone: args.phone,
      subject: args.subject,
      message: args.message,
      status: "new",
      createdAt: Date.now(),
    })
  },
}

export const updateStatus = {
  args: {
    id: v.id("contactMessages"),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("archived")),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.patch(args.id, { status: args.status })
  },
}
