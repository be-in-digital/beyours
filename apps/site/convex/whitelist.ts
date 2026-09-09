import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  SITE_SUBJECT,
  assertFieldLengths,
  consumeRateLimit,
} from "./rateLimit";

/**
 * The pre-launch waitlist.
 *
 * WHY THIS ANSWERS THE SAME WAY TWICE: it used to throw « Cette adresse email
 * est déjà inscrite à la waitlist. » for an address already on the list and
 * succeed for one that was not. That is an unauthenticated membership oracle:
 * anybody could ask this public endpoint, one address at a time, which
 * restaurateurs had signed up — and each miss silently inserted a row of the
 * caller's choosing. `contactLeads.submit` next door already answers a bot and
 * a prospect identically for exactly this reason.
 *
 * So a repeat join is accepted and DROPPED — the same shape as a first-time
 * join, and the same shape `contactLeads.submit` gives a honeypot hit.
 *
 * Dropped rather than patched, which was the first attempt at this and was
 * worse than the bug it fixed. Nothing here is authenticated and no address is
 * verified, so a caller who guesses an address is not its owner: patching let
 * a stranger overwrite a real prospect's name, phone, restaurant and city, and
 * — because ./retention.ts counts three years from `lastContactAt` — let them
 * push that record's deletion date forward for ever, one call at a time. An
 * unauthenticated write over somebody else's record is not a smaller problem
 * than the oracle.
 *
 * The cost is real and is the right way round: a prospect correcting their own
 * phone number is silently ignored, and their three years run from their FIRST
 * submission rather than their latest. The published sentence says « jusqu'à
 * trois (3) ans », so deleting sooner honours it; deleting later would not.
 * `lastContactAt` stays in the schema because it is the field that sentence
 * names, and a future authenticated path — or an operator — may advance it.
 */
// @public-by-design: the waiting-list form on beyours.fr, filled in by a
//   restaurateur who has no account yet; field-length caps and two rate
//   limits stand in for a session
export const join = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    /* Cheapest guard first, and the one this endpoint never had: `v.string()`
       carries no length, so `message` could be a megabyte. */
    assertFieldLengths({
      name: `${args.firstName} ${args.lastName}`,
      email: args.email,
      restaurant: args.restaurantName,
      message: args.message,
    });

    const email = args.email.trim().toLowerCase();

    /* An oracle is only worth probing if it can be probed at scale. Both
       windows are spent BEFORE the lookup below, so a known and an unknown
       address leave the counters in identical states — the limiter must not
       become the oracle the error message used to be.

       Its own windows, not the contact form's: sharing `contactSiteWide` meant
       forty joins locked every visitor out of the contact form for the hour. */
    await consumeRateLimit(ctx, "whitelistPerEmail", email);
    await consumeRateLimit(ctx, "whitelistSiteWide", SITE_SUBJECT);

    const existing = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    // Already on the list: accepted, and nothing written. See the note above.
    if (existing) return;

    const now = Date.now();
    await ctx.db.insert("whitelist", {
      ...args,
      email,
      createdAt: now,
      lastContactAt: now,
    });
  },
});
