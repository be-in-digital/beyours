import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import * as defs from "@beindigital-engine/convex-functions/products";

// === Queries (unchanged) ===

export const list = query(defs.list);
export const getById = query(defs.getById);
export const getByCategory = query(defs.getByCategory);
export const getBySlug = query(defs.getBySlug);
export const getFeatured = query(defs.getFeatured);

// === Mutations (with Uber Eats auto-sync trigger) ===

/**
 * Schedule Uber Eats menu sync after a product mutation.
 * Uses a 5-second delay to debounce rapid consecutive edits.
 * Non-critical: failures are logged but do not affect the product mutation.
 *
 * NOTE: The reference to internal.uberEatsMenuSync.syncAllStores requires
 * running `npx convex dev` to regenerate types after adding the new module.
 * The `as any` cast handles the transition period before types are regenerated.
 */
async function scheduleMenuSync(ctx: any) {
  try {
    const syncRef = (internal as any).uberEatsMenuSync?.syncAllStores;
    if (syncRef) {
      await ctx.scheduler.runAfter(5000, syncRef, {});
    }
  } catch (error) {
    console.error("Failed to schedule Uber Eats menu sync:", error);
  }
}

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const result = await defs.create.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const update = mutation({
  args: defs.update.args,
  handler: async (ctx, args) => {
    const result = await defs.update.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const updateStock = mutation({
  args: defs.updateStock.args,
  handler: async (ctx, args) => {
    const result = await defs.updateStock.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const toggleStatus = mutation({
  args: defs.toggleStatus.args,
  handler: async (ctx, args) => {
    const result = await defs.toggleStatus.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});

export const remove = mutation({
  args: defs.remove.args,
  handler: async (ctx, args) => {
    const result = await defs.remove.handler(ctx, args);
    await scheduleMenuSync(ctx);
    return result;
  },
});
