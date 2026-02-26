import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import * as defs from "@beindigital-engine/convex-functions/products";
import { scheduleTranslation } from "./autoTranslate";

// === Queries (public for storefront) ===

export const list = query(defs.list);
export const getById = query(defs.getById);
export const getByCategory = query(defs.getByCategory);
export const getBySlug = query(defs.getBySlug);
export const getFeatured = query(defs.getFeatured);

// === Mutations (with menu sync trigger) ===

/**
 * Schedule Uber Eats and Deliveroo menu sync after a product mutation.
 * Uses a 5-second delay to debounce rapid consecutive edits.
 * Non-critical: failures are logged but do not affect the product mutation.
 */
async function scheduleMenuSync(ctx: MutationCtx) {
  try {
    await ctx.scheduler.runAfter(5000, internal.uberEatsMenuSync.syncAllStores, {});
    await ctx.scheduler.runAfter(5000, internal.deliverooMenuSync.syncAllStores, {});
  } catch (error) {
    console.error("Failed to schedule menu sync:", error);
  }
}

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.create.handler(ctx, args);
    await scheduleMenuSync(ctx);
    await scheduleTranslation(ctx, result, "products", args.storeId);
    return result;
  },
});

export const update = mutation({
  args: defs.update.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.update.handler(ctx, args);
    await scheduleMenuSync(ctx);
    const product = await ctx.db.get(args.id);
    if (product?.storeId) {
      await scheduleTranslation(ctx, args.id, "products", product.storeId);
    }
    return result;
  },
});

export const updateStock = mutation({
  args: defs.updateStock.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.updateStock.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const toggleStatus = mutation({
  args: defs.toggleStatus.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.toggleStatus.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const toggleStockTracking = mutation({
  args: defs.toggleStockTracking.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.toggleStockTracking.handler(ctx, args);
  },
});

export const updateAutoDisable = mutation({
  args: defs.updateAutoDisable.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateAutoDisable.handler(ctx, args);
  },
});

export const updateLowStockThreshold = mutation({
  args: defs.updateLowStockThreshold.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateLowStockThreshold.handler(ctx, args);
  },
});

export const remove = mutation({
  args: defs.remove.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.remove.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const updateWithPropagation = mutation({
  args: defs.updateWithPropagation.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.updateWithPropagation.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const duplicateCatalog = mutation({
  args: defs.duplicateCatalog.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.duplicateCatalog.handler(ctx, args);
  },
});
