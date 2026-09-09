import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Claim a Stripe event id — the read and the insert in ONE transaction.
 *
 * This used to be an `internalQuery` and an `internalMutation` called one after
 * the other from `http.ts`, which is two transactions with a gap between them,
 * from an `httpAction` that is not a transaction at all. Stripe delivers the
 * same event more than once by design — retries, and at-least-once delivery —
 * and two deliveries that overlap in that gap both read nothing and both
 * insert. `schema.ts` declares an index on `eventId`, not a unique constraint;
 * Convex has none to declare.
 *
 * One duplicate row was permanent damage, not a tidiness problem. The read was
 * `.unique()`, which THROWS on a second row, and it sat before the `try` that
 * reports — so every later delivery of that id died uncaught, answered 500,
 * and never reached `captureBackendError`. For a `charge.refunded` that means
 * the refund never registers, the subscription keeps billing, the commission is
 * never clawed back, and nothing anywhere says so. Stripe retries for three
 * days against the same duplicate and gives up.
 *
 * A Convex mutation is a serialisable transaction: the index read is in this
 * handler's read set and the insert writes it, so two concurrent claims
 * conflict and one is retried against the row the other wrote. That is the
 * whole fix — the gap cannot be entered because there is no gap.
 *
 * `.first()` rather than `.unique()` throughout, deliberately. A deployment
 * that already ran the old code holds duplicate rows, and a reader that throws
 * on them keeps the endpoint bricked long after the race is closed. The claim
 * is the same either way: an id already present has been claimed.
 *
 * @returns `processed` — whether this event has already been handled to
 *   completion. A claim that inserts is never processed.
 */
export const claim = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripe_events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing) return { processed: existing.processed };

    await ctx.db.insert("stripe_events", {
      eventId: args.eventId,
      eventType: args.eventType,
      processed: false,
      createdAt: Date.now(),
    });
    return { processed: false };
  },
});

/**
 * Retire every row for this event id.
 *
 * Every row, not the one `.unique()` would have insisted on: a deployment that
 * ran the racing version holds duplicates, and settling one of them leaves the
 * other reading `processed: false`. The next delivery would then be admitted
 * and the whole handler would run a second time — which for a reversal means
 * refunding, cancelling and clawing back twice.
 */
export const markProcessed = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("stripe_events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();

    for (const row of rows) {
      if (!row.processed) await ctx.db.patch(row._id, { processed: true });
    }
  },
});
