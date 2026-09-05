/**
 * Email events functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 *
 * NOTE: emailEvents is a detail/debug table only.
 * Never aggregate this table for dashboard analytics — use campaign.stats instead.
 * Future: events older than 90 days can be purged (V2).
 */

import { v } from "convex/values"

import { MAX_CAP_LOOKUP_BATCH, resolveWeeklyCap } from "./campaignDelivery"

const eventTypeValidator = v.union(
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("opened"),
  v.literal("clicked"),
  v.literal("bounced"),
  v.literal("unsubscribed"),
  v.literal("complained"),
  v.literal("converted")
)

const metadataValidator = v.optional(
  v.object({
    linkUrl: v.optional(v.string()),
    orderId: v.optional(v.string()),
    revenue: v.optional(v.number()),
    userAgent: v.optional(v.string()),
    variantId: v.optional(v.string()),
  })
)

// === QUERIES ===

export const listByCampaign = {
  args: {
    campaignId: v.id("emailCampaigns"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailEvents")
      .withIndex("by_campaignId", (q: any) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(args.limit ?? 100)
  },
}

export const listBySubscriber = {
  args: {
    subscriberId: v.id("emailSubscribers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailEvents")
      .withIndex("by_subscriberId", (q: any) =>
        q.eq("subscriberId", args.subscriberId)
      )
      .order("desc")
      .take(args.limit ?? 50)
  },
}

// === INTERNAL MUTATIONS (called by SES webhook only) ===

/**
 * Which of these subscribers has this campaign already reached?
 *
 * The guarantee that makes a resumed send safe. A cursor alone is not enough:
 * "Relancer" after a pause used to restart at the first subscriber, and even a
 * correct cursor cannot survive a batch that is retried after a transient
 * failure. Asking the events table what actually went out is the only answer
 * that holds however the send was interrupted.
 *
 * One index lookup per subscriber in the page, asked once per batch rather than
 * once per send, so the cost is a single round-trip for a batch of any size.
 */
export const alreadySentTo = {
  args: {
    campaignId: v.id("emailCampaigns"),
    subscriberIds: v.array(v.id("emailSubscribers")),
  },
  handler: async (ctx: any, args: any): Promise<string[]> => {
    const reached: string[] = []
    for (const subscriberId of args.subscriberIds) {
      const events = await ctx.db
        .query("emailEvents")
        .withIndex("by_campaignId_subscriberId", (q: any) =>
          q.eq("campaignId", args.campaignId).eq("subscriberId", subscriberId)
        )
        .collect()
      if (events.some((e: any) => e.type === "sent")) reached.push(subscriberId)
    }
    return reached
  },
}

/**
 * How many campaign emails each of these subscribers received since `since`,
 * counted no further than `cap`.
 *
 * What `maxEmailsPerWeek` needs, and it counts what was actually SENT rather
 * than a stored tally that could drift — the same source `alreadySentTo` reads,
 * so the two answers cannot disagree about what went out.
 *
 * Asked once per batch, like the idempotency check, rather than once per
 * subscriber.
 *
 * Two things keep the cost of that per-subscriber lookup fixed, and both
 * matter — this query used to have neither, and it was on course to stop email
 * marketing outright for the stores whose subscribers had been around longest.
 *
 * The index does the first. `by_subscriber_type_occurredAt` narrows to this
 * subscriber's `sent` events inside the window, so the read is proportional to
 * the answer. Reading `by_subscriberId` and filtering `type` and `occurredAt`
 * in JavaScript — as this did — makes the read proportional to the
 * subscriber's entire lifetime history instead: sent, delivered and opened, for
 * every campaign and every automation, back to the day they subscribed. That
 * scan only grows, and once a batch of them crosses Convex's per-transaction
 * read ceiling the campaign throws and every retry throws with it.
 *
 * `cap` does the second. The window alone still leaves the read at the mercy of
 * how much mail a store sent this week, which is precisely what is abnormal
 * when the cap starts mattering. Stopping the count at `cap` bounds it by a
 * small constant, and loses nothing: the only question asked of this number is
 * `withinWeeklyCap(count, cap)`, i.e. `count < cap`, and a count that stopped
 * at `cap` answers it identically. The number is a cap verdict, not a
 * statistic — do not repurpose it as one.
 */
export const sentCountsSince = {
  args: {
    subscriberIds: v.array(v.id("emailSubscribers")),
    since: v.number(),
    cap: v.number(),
  },
  handler: async (
    ctx: any,
    args: any
  ): Promise<Array<{ subscriberId: string; count: number }>> => {
    // Refused rather than attempted: `page x cap` documents is what this costs,
    // and past this page size that exceeds what Convex will read in one
    // transaction — the very failure the index was added to remove, back again
    // and just as permanent. Callers send a fixed page (`BATCH_SIZE`), so this
    // fires for a code change, not for data, and says which knob moved.
    if (args.subscriberIds.length > MAX_CAP_LOOKUP_BATCH) {
      throw new Error(
        `sentCountsSince: ${args.subscriberIds.length} subscribers exceeds ` +
          `MAX_CAP_LOOKUP_BATCH (${MAX_CAP_LOOKUP_BATCH}). Split the page ` +
          `across several calls — each runQuery is its own transaction.`
      )
    }
    // Through the same function the caller resolved the cap with. `v.number()`
    // is a float64: it admits NaN and Infinity, and `.take(Infinity)` is the
    // unbounded read this query was fixed to stop making. It admits a
    // non-positive cap too, which would read nothing, report zero, and wave
    // every subscriber through the guard.
    //
    // Callers pass a cap that has already been through this function, and it is
    // idempotent, so the count and the comparison are bounded by the same
    // number. A caller that passed a raw fractional cap instead would break
    // that: the count would stop at the floor while the comparison used the
    // fraction, and a saturated count then always reads as under the cap. That
    // is what `resolveWeeklyCap` being the single definition of a cap prevents
    // — do not compare against anything else.
    const limit = resolveWeeklyCap(args.cap)
    const counts: Array<{ subscriberId: string; count: number }> = []
    for (const subscriberId of args.subscriberIds) {
      const events = await ctx.db
        .query("emailEvents")
        .withIndex("by_subscriber_type_occurredAt", (q: any) =>
          q
            .eq("subscriberId", subscriberId)
            .eq("type", "sent")
            .gte("occurredAt", args.since)
        )
        .take(limit)
      counts.push({ subscriberId, count: events.length })
    }
    return counts
  },
}

export const create = {
  args: {
    storeId: v.id("stores"),
    campaignId: v.optional(v.id("emailCampaigns")),
    automationId: v.optional(v.id("emailAutomations")),
    subscriberId: v.id("emailSubscribers"),
    type: eventTypeValidator,
    metadata: metadataValidator,
    occurredAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("emailEvents", args)
  },
}

export const createBatch = {
  args: {
    events: v.array(
      v.object({
        storeId: v.id("stores"),
        campaignId: v.optional(v.id("emailCampaigns")),
        automationId: v.optional(v.id("emailAutomations")),
        subscriberId: v.id("emailSubscribers"),
        type: eventTypeValidator,
        metadata: metadataValidator,
        occurredAt: v.number(),
      })
    ),
  },
  handler: async (ctx: any, args: any) => {
    for (const event of args.events) {
      await ctx.db.insert("emailEvents", event)
    }
  },
}
