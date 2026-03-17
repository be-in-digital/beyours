import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/stores";

// === Queries (public for storefront) ===

export const list = query(defs.list);
export const getById = query(defs.getById);
export const getBySlug = query(defs.getBySlug);

// === Mutations (protected) ===

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

export const updateHours = mutation({
  args: defs.updateHours.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateHours.handler(ctx, args);
  },
});

export const updateOverrides = mutation({
  args: defs.updateOverrides.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateOverrides.handler(ctx, args);
  },
});

export const updateAddress = mutation({
  args: defs.updateAddress.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateAddress.handler(ctx, args);
  },
});

export const updatePrintConfig = mutation({
  args: defs.updatePrintConfig.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updatePrintConfig.handler(ctx, args);
  },
});

export const updateDisplayConfig = mutation({
  args: defs.updateDisplayConfig.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateDisplayConfig.handler(ctx, args);
  },
});

export const updateSoundConfig = mutation({
  args: defs.updateSoundConfig.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateSoundConfig.handler(ctx, args);
  },
});

export const updateOrderConfirmation = mutation({
  args: defs.updateOrderConfirmation.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateOrderConfirmation.handler(ctx, args);
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

export const remove = mutation({
  args: defs.remove.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.remove.handler(ctx, args);
  },
});
