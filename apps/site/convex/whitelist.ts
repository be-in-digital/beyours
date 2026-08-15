import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
    const existing = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("Cette adresse email est déjà inscrite à la waitlist.");
    }

    await ctx.db.insert("whitelist", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
