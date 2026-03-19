import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/emailConfig";
import { requireStoreAccess } from "@beindigital-engine/convex-functions/auth";

// === Queries (auth-protected — contains fromEmail/replyToEmail) ===

export const get = query({
  args: defs.get.args,
  handler: async (ctx, args) => {
    await requireStoreAccess(ctx, args.storeId);
    return defs.get.handler(ctx, args);
  },
});

// === Mutations (auth-protected) ===

export const upsert = mutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    await requireStoreAccess(ctx, args.storeId);
    return defs.upsert.handler(ctx, args);
  },
});
