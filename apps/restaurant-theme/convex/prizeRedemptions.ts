import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/prizeRedemptions";

export const list = query(defs.list);

export const markRedeemed = mutation({
  args: defs.markRedeemed.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.markRedeemed.handler(ctx, args);
  },
});

export const markExpired = mutation({
  args: defs.markExpired.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.markExpired.handler(ctx, args);
  },
});
