import { ConvexError, v } from "convex/values"

import { clampPageSize } from "./pagination"

/**
 * The establishment's book of the people who have ordered from it.
 *
 * WHY IT EXISTS (#364, #98). The data was collected four times and grouped
 * nowhere. `orders.customerInfo` holds a name and possibly an e-mail per ORDER;
 * `emailSubscribers.metadata` holds the aggregate but only for people who
 * subscribed to marketing, which most diners are not; `gamePlays` holds another
 * copy; `userProfiles` a fourth. `/dashboard/customers` was `<ComingSoon/>`, and
 * the onboarding tour's step pointing at it had to be deleted (#363) rather than
 * lead somewhere empty.
 *
 * ## THE CONSENT LINE
 *
 * `orders.ts` already states the rule: *"an order is a purchase, not consent to
 * be marketed to."* This module does not cross it and must never be made to.
 *
 * A customer row records a fact the establishment already holds in `orders` —
 * this person bought from us, this often, this much. Subscribing them to a
 * mailing list is a separate act with a separate lawful basis, and it still
 * happens only through `emailSubscribers`, only on an opt-in. Nothing here
 * writes a subscriber, and `list` is not a segment: the campaign sender reads
 * `emailSubscribers`, and no export from this module is wired to it.
 *
 * ## THE IDENTITY
 *
 * The lower-cased e-mail, per store — what `emailSubscribers`, `gamePlays` and
 * the promotion per-customer cap already key on. Choosing anything else would
 * create a fifth identity rather than settle the four.
 *
 * An order with NO e-mail is not a person here, and `list` reports how many
 * orders that covers so the figure on the screen is never quietly short. A cash
 * walk-in who gave a first name has no contact, and an address book entry that
 * cannot be addressed is worse than an honest count.
 */

/** How many product ids a customer row keeps. */
export const FAVOURITE_PRODUCT_CAP = 10

/** The default page of customers a screen asks for. */
export const CUSTOMER_PAGE_SIZE = 25

/** How many orders one customer's detail view shows. */
export const CUSTOMER_ORDER_WINDOW = 20

/**
 * The e-mail as this table keys on it, or `null` when there is none.
 *
 * One function so the write path and every read agree. `A@b.com` and `a@b.com`
 * are one person, and the promotion per-customer cap was bypassable by changing
 * the case before `orders.ts` normalised there too.
 */
export function customerKey(email: unknown): string | null {
  if (typeof email !== "string") return null
  const key = email.trim().toLowerCase()
  return key.length > 0 ? key : null
}

/** The shape the incremental writer needs from an order. */
export interface CustomerOrderFacts {
  storeId: string
  email: string
  name?: string
  phone?: string
  orderAmount: number
  orderType?: string
  productIds?: string[]
  orderedAt: number
}

/**
 * Record a confirmed order against its customer, creating the row if needed.
 *
 * Counted on entering `confirmed`, which the state machine allows exactly once
 * and only from `pending`, so no retry double-counts. The counterpart below
 * gives it back on `confirmed → cancelled`, which it also allows.
 *
 * Deliberately mirrors `emailSubscribers.updateMetadataIncremental` — same
 * transitions, same fields, same caller — so the two cannot answer the same
 * question differently. What they do NOT share is creation: that one skips a
 * person who is not a subscriber, and this one creates the customer, because a
 * customer is not a subscriber and never was.
 */
export const recordOrder = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    orderAmount: v.number(),
    orderType: v.optional(v.string()),
    productIds: v.optional(v.array(v.string())),
    orderedAt: v.number(),
  },
  handler: async (ctx: any, args: CustomerOrderFacts): Promise<void> => {
    const email = customerKey(args.email)
    if (!email) return

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", email)
      )
      .first()

    const productIds = (args.productIds ?? []).filter(
      (id): id is string => typeof id === "string" && id.length > 0
    )

    if (!existing) {
      await ctx.db.insert("customers", {
        storeId: args.storeId,
        email,
        // A person who gave no name is "Client" rather than an empty cell: the
        // screen is a list of people, and a blank row reads as a broken query.
        name: args.name?.trim() || "Client",
        ...(args.phone ? { phone: args.phone } : {}),
        totalOrders: 1,
        totalSpent: args.orderAmount,
        averageOrderValue: args.orderAmount,
        firstOrderAt: args.orderedAt,
        lastOrderAt: args.orderedAt,
        orderTypes: args.orderType ? [args.orderType] : [],
        favoriteProducts: productIds.slice(0, FAVOURITE_PRODUCT_CAP),
        createdAt: args.orderedAt,
        updatedAt: args.orderedAt,
      })
      return
    }

    const totalOrders = existing.totalOrders + 1
    const totalSpent = existing.totalSpent + args.orderAmount

    await ctx.db.patch(existing._id, {
      // The most recent name and phone win: a diner correcting a typo on their
      // second order means the second one is right.
      name: args.name?.trim() || existing.name,
      ...(args.phone ? { phone: args.phone } : {}),
      totalOrders,
      totalSpent,
      averageOrderValue: Math.round(totalSpent / totalOrders),
      // `firstOrderAt` is never moved — it is the only field here that answers
      // "how long have they been coming".
      lastOrderAt: Math.max(existing.lastOrderAt, args.orderedAt),
      orderTypes: args.orderType
        ? [...new Set([...existing.orderTypes, args.orderType])]
        : existing.orderTypes,
      // Most recent first, capped. Unbounded, a regular's row would grow
      // without limit — the shape `emailSubscribers` caps for the same reason.
      favoriteProducts: [
        ...new Set([...productIds, ...existing.favoriteProducts]),
      ].slice(0, FAVOURITE_PRODUCT_CAP),
      updatedAt: args.orderedAt,
    })
  },
}

/**
 * Take back what a confirmed order added, when that order is cancelled.
 *
 * Only the numbers are reversed, and the reason is the one
 * `emailSubscribers.reverseMetadataIncremental` gives: `lastOrderAt`,
 * `favoriteProducts` and `orderTypes` are merged values with no record of which
 * order contributed what, so un-merging them needs a per-order history that
 * would cost more than it is worth. Stated rather than hidden: a customer whose
 * only order was cancelled keeps a `lastOrderAt`. Their `totalOrders` and
 * `totalSpent` are correct, which is what the money questions are asked of.
 *
 * The row is NOT deleted. A person who ordered and cancelled is still someone
 * the establishment dealt with, and deleting them would make the book disagree
 * with the orders it is derived from.
 */
export const reverseOrder = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
    orderAmount: v.number(),
  },
  handler: async (ctx: any, args: any): Promise<void> => {
    const email = customerKey(args.email)
    if (!email) return

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", email)
      )
      .first()
    if (!existing) return

    // Never below zero: a cancellation whose confirmation was never counted —
    // an order from before this table existed — must not drive a total
    // negative.
    const totalOrders = Math.max(0, existing.totalOrders - 1)
    const totalSpent = Math.max(0, existing.totalSpent - args.orderAmount)

    await ctx.db.patch(existing._id, {
      totalOrders,
      totalSpent,
      averageOrderValue: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
      updatedAt: Date.now(),
    })
  },
}

/**
 * A page of the establishment's customers, most recent order first.
 *
 * Paginated through the index rather than sorted in memory: this is the one
 * table here that grows with every new diner, and sorting would have to read
 * all of them to show twenty — the ceiling #432.4 was about.
 */
export const list = {
  args: {
    storeId: v.id("stores"),
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
    /** `recent` (default) or `spend`. */
    order: v.optional(v.union(v.literal("recent"), v.literal("spend"))),
  },
  handler: async (ctx: any, args: any) => {
    const numItems = clampPageSize(args.numItems ?? CUSTOMER_PAGE_SIZE)
    const index =
      args.order === "spend" ? "by_storeId_totalSpent" : "by_storeId_lastOrderAt"

    const page = await ctx.db
      .query("customers")
      .withIndex(index, (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate({ numItems, cursor: args.cursor ?? null })

    return {
      customers: page.page,
      cursor: page.continueCursor,
      isDone: page.isDone,
    }
  },
}

/**
 * One customer, with the orders behind the totals.
 *
 * The orders are read through `by_customerEmail`, bounded: a regular of two
 * years has hundreds, and a detail view needs the recent ones.
 */
export const get = {
  args: {
    storeId: v.id("stores"),
    email: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const email = customerKey(args.email)
    if (!email) {
      throw new ConvexError({
        code: "customer_email_required",
        message: "Ce client n'a pas d'adresse e-mail enregistrée.",
      })
    }

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", email)
      )
      .first()
    if (!customer) return null

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_storeId_customerEmailKey", (q: any) =>
        q.eq("storeId", args.storeId).eq("customerEmailKey", email)
      )
      .order("desc")
      .take(CUSTOMER_ORDER_WINDOW)

    return { customer, orders }
  },
}

/**
 * How many orders this book cannot account for.
 *
 * The honest footnote to every total on the screen. An order with no e-mail is
 * not a person here — a cash walk-in who gave a first name has no contact — and
 * a customer list that silently omitted them would answer "how many customers
 * do I have?" with a number that is wrong in one direction and never says so.
 *
 * Bounded like everything else: past the scan limit it reports "at least".
 */
export const anonymousOrderCount = {
  args: {
    storeId: v.id("stores"),
    scanLimit: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: any
  ): Promise<{ count: number; atLeast: boolean }> => {
    const scanLimit = Math.min(Math.max(args.scanLimit ?? 500, 1), 2_000)
    const rows = await ctx.db
      .query("orders")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .take(scanLimit + 1)

    const scanned = rows.slice(0, scanLimit)
    const count = scanned.filter(
      (order: any) => customerKey(order.customerInfo?.email) === null
    ).length

    return { count, atLeast: rows.length > scanLimit }
  },
}
