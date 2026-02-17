import { query, mutation, internalMutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/storeIntegrations";

// === Queries (public - used by webhook actions) ===

export const listByStore = query(defs.listByStore);
export const listByPlatformEnabled = query(defs.listByPlatformEnabled);
export const getByStorePlatform = query(defs.getByStorePlatform);
export const getBySiteId = query(defs.getBySiteId);
export const getByBrandId = query(defs.getByBrandId);

// === Mutations (protected) ===

export const upsert = mutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.upsert.handler(ctx, args);
  },
});

export const updateMenuSyncStatus = mutation({
  args: defs.updateMenuSyncStatus.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateMenuSyncStatus.handler(ctx, args);
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

// === Internal Mutations (for webhooks and schedulers) ===

export const internalUpdateMenuSyncStatus = internalMutation(defs.updateMenuSyncStatus);
