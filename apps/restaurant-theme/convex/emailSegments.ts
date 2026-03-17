import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/emailSegments";

// === Queries (public) ===

export const list = query(defs.list);
export const getById = query(defs.getById);
export const countMatchingSubscribers = query(defs.countMatchingSubscribers);

// === Mutations (auth-protected) ===

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.create.handler(ctx, args);
  },
});

export const update = mutation({
  args: defs.update.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.update.handler(ctx, args);
  },
});

export const remove = mutation({
  args: defs.remove.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.remove.handler(ctx, args);
  },
});

export const duplicate = mutation({
  args: defs.duplicate.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.duplicate.handler(ctx, args);
  },
});

export const refreshCount = mutation({
  args: defs.refreshCount.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.refreshCount.handler(ctx, args);
  },
});
