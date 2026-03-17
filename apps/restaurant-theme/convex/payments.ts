import { query, mutation, internalMutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/payments";

export const getByOrder = query(defs.getByOrder);
export const getByStore = query(defs.getByStore);

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.create.handler(ctx, args);
  },
});

export const updateStatus = mutation({
  args: defs.updateStatus.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateStatus.handler(ctx, args);
  },
});

export const refund = mutation({
  args: defs.refund.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.refund.handler(ctx, args);
  },
});

// === Internal Mutations (for payment actions and webhooks) ===

/** Create payment record without auth — used by payment verification actions */
export const internalCreate = internalMutation(defs.create);

/** Update payment status without auth — used by webhooks */
export const internalUpdateStatus = internalMutation(defs.updateStatus);
