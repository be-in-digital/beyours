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
 * So a repeat join is now an update, not a refusal. That is also the truthful
 * reading of it: somebody who submits the form again has made contact again,
 * which is what `lastContactAt` records and what the three-year prospect
 * retention published in /confidentialite counts from. See ./retention.
 */
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

    /* The oracle above is only worth probing if it can be probed at scale.
       Site-wide, so inventing addresses does not buy another quota — the same
       window `contactLeads.submit` uses, and for the same reason. Refusing is
       indistinguishable between a known and an unknown address. */
    await consumeRateLimit(ctx, "contactSiteWide", SITE_SUBJECT);

    const email = args.email.trim().toLowerCase();
    const now = Date.now();

    const existing = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      /* Refresh the details and the contact date. Returns nothing, exactly as
         the first-time path does: a caller cannot tell the two apart. */
      await ctx.db.patch(existing._id, {
        firstName: args.firstName,
        lastName: args.lastName,
        phone: args.phone,
        restaurantName: args.restaurantName,
        city: args.city,
        plan: args.plan,
        message: args.message,
        lastContactAt: now,
      });
      return;
    }

    await ctx.db.insert("whitelist", {
      ...args,
      email,
      createdAt: now,
      lastContactAt: now,
    });
  },
});
