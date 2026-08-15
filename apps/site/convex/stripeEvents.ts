import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByEventId = internalQuery({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stripe_events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
  },
});

export const create = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("stripe_events", {
      eventId: args.eventId,
      eventType: args.eventType,
      processed: false,
      createdAt: Date.now(),
    });
  },
});

export const markProcessed = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("stripe_events")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (event) {
      await ctx.db.patch(event._id, { processed: true });
    }
  },
});
