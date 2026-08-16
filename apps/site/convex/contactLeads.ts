import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

/**
 * Contact form leads.
 *
 * The public site form used to simulate its submit (setTimeout) and drop every
 * prospect on the floor. `submit` now persists the lead and fires two emails
 * best-effort: a confirmation to the prospect and a notification to the team.
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
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const restaurant = args.restaurant?.trim() || undefined;
    const message = args.message.trim();

    if (!name || !email || !message) {
      throw new Error("Nom, email et message sont requis.");
    }

    const now = Date.now();
    await ctx.db.insert("contactLeads", {
      name,
      email,
      restaurant,
      message,
      status: "new",
      createdAt: now,
    });

    // Confirmation to the prospect (best-effort)
    await ctx.scheduler.runAfter(0, internal.email.send.sendContactConfirmation, {
      toEmail: email,
      firstName: firstNameOf(name),
    });

    // Internal notification to the team (best-effort)
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
