import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "./admin";
import {
  SITE_SUBJECT,
  assertFieldLengths,
  consumeRateLimit,
  tryConsumeRateLimit,
} from "./rateLimit";

/**
 * Contact form leads.
 *
 * The public site form used to simulate its submit (setTimeout) and drop every
 * prospect on the floor. `submit` now persists the lead and fires two emails
 * best-effort: a confirmation to the prospect and a notification to the team.
 *
 * WHY IT IS GUARDED: `submit` is public by necessity — a visitor has no session
 * — and it schedules mail. One of those messages goes to an address the caller
 * typed, which made this an unauthenticated relay: a loop was both an inbox
 * flood and a way to spend the sending reputation of the identity that also
 * carries renewal receipts and dunning mail. See ./rateLimit.ts for the
 * windows and the reasoning behind each number.
 */

/** First token of a full name, for a warm greeting. */
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    restaurant: v.optional(v.string()),
    message: v.string(),
    /**
     * Honeypot. A real form keeps this hidden and empty; a bot that fills every
     * input it can find fills this one too.
     */
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Cheapest guard first, and the only one that needs no database read: cap
    // the arguments before anything else looks at them. `v.string()` has no
    // length of its own, so until now `message` could be a megabyte.
    assertFieldLengths({
      name: args.name,
      email: args.email,
      restaurant: args.restaurant,
      message: args.message,
    });

    // The honeypot, checked BEFORE the limiters and never length-checked.
    //
    // Three reasons, in order of importance. It must not consume the shared
    // window: a bot that trips it would otherwise exhaust `contactSiteWide` and
    // lock real visitors out of the form — the guard would become the denial of
    // service. The caller is told nothing: accepted and dropped, with the same
    // shape of answer a real submit gets, because an error would teach the next
    // iteration of the script which field to leave alone. And for that same
    // reason the field is absent from `assertFieldLengths` above — a
    // "Le champ « website » dépasse…" would name the honeypot out loud. Its
    // size needs no bound of ours: nothing here reads or stores it, and Convex
    // caps the arguments before the handler ever runs.
    if (args.website !== undefined && args.website.trim() !== "") {
      return { ok: true };
    }

    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const restaurant = args.restaurant?.trim() || undefined;
    const message = args.message.trim();

    if (!name || !email || !message) {
      throw new Error("Nom, email et message sont requis.");
    }

    // Two windows, because neither is enough alone. The per-address one stops
    // the double-submit and the naive script, and is dodged by changing the
    // address. The site-wide one cannot be dodged and bounds the flood.
    await consumeRateLimit(ctx, "contactPerEmail", email);
    await consumeRateLimit(ctx, "contactSiteWide", SITE_SUBJECT);

    const now = Date.now();
    await ctx.db.insert("contactLeads", {
      name,
      email,
      restaurant,
      message,
      status: "new",
      createdAt: now,
    });

    // Confirmation to the prospect (best-effort), under a third and tighter
    // window of its own. This is the only message addressed to somebody the
    // caller chose, so it is the relay vector and it is bounded hardest.
    //
    // Spending this window does not refuse the submit: the lead is stored above
    // and the team is told below. A prospect who receives no courtesy email is
    // a smaller loss than a prospect we never hear about.
    const mayConfirm = await tryConsumeRateLimit(
      ctx,
      "contactConfirmationSiteWide",
      SITE_SUBJECT,
      now,
    );
    if (mayConfirm.allowed) {
      await ctx.scheduler.runAfter(
        0,
        internal.email.send.sendContactConfirmation,
        { toEmail: email, firstName: firstNameOf(name) },
      );
    }

    // Internal notification to the team (best-effort). It only ever reaches our
    // own inbox, so the two windows above are the whole bound it needs.
    await ctx.scheduler.runAfter(
      0,
      internal.email.send.sendContactTeamNotification,
      {
        name,
        email,
        restaurant,
        message,
        submittedAtMs: now,
      },
    );

    return { ok: true };
  },
});

/** Admin: contact-form leads, most recent first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("contactLeads")
      .withIndex("by_createdAt")
      .order("desc")
      .take(2000);
    return rows;
  },
});
