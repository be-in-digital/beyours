import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import * as defs from "@beindigital-engine/convex-functions/storeIntegrations";
import { requireStoreAccess } from "@beindigital-engine/convex-functions/auth";

// === Queries (auth-protected where applicable) ===

export const listByStore = query({
  args: defs.listByStore.args,
  handler: async (ctx, args) => {
    await requireStoreAccess(ctx, args.storeId);
    return defs.listByStore.handler(ctx, args);
  },
});
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

export const toggleAutoAccept = mutation({
  args: defs.toggleAutoAccept.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.toggleAutoAccept.handler(ctx, args);
  },
});

export const updateOrderMode = mutation({
  args: defs.updateOrderMode.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateOrderMode.handler(ctx, args);
  },
});

// === Internal Mutations (for webhooks and schedulers) ===

export const internalUpdateMenuSyncStatus = internalMutation(defs.updateMenuSyncStatus);
export const internalUpsert = internalMutation(defs.upsert);

export const setOrderMode = internalMutation({
  args: {
    platformStoreId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    orderMode: v.union(v.literal("auto_accept"), v.literal("auto_reject"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q) => q.eq("platform", args.platform).eq("enabled", true))
      .filter((q) => q.eq(q.field("platformStoreId"), args.platformStoreId))
      .first();
    if (!integration) throw new Error(`No integration found for ${args.platformStoreId}`);
    await ctx.db.patch(integration._id, { orderMode: args.orderMode });
    return { success: true, id: integration._id, orderMode: args.orderMode };
  },
});
