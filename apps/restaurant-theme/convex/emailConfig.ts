import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/emailConfig";

// === Queries (public) ===

export const get = query(defs.get);

// === Mutations (auth-protected) ===

export const upsert = mutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.upsert.handler(ctx, args);
  },
});
