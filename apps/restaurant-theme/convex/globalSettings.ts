import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/globalSettings";

// === Queries ===

export const get = query(defs.get);

// === Mutations ===

export const upsert = mutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.upsert.handler(ctx, args);
  },
});
