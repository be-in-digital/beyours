import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/categories";
import { scheduleTranslation } from "./autoTranslate";

// === Queries (public for storefront) ===

export const list = query(defs.list);
export const getById = query(defs.getById);

// === Mutations (protected) ===

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.create.handler(ctx, args);
    await scheduleTranslation(ctx, result, "categories", args.storeId);
    return result;
  },
});

export const update = mutation({
  args: defs.update.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const result = await defs.update.handler(ctx, args);
    const category = await ctx.db.get(args.id);
    if (category) {
      await scheduleTranslation(ctx, args.id, "categories", category.storeId);
    }
    return result;
  },
});

export const reorder = mutation({
  args: defs.reorder.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.reorder.handler(ctx, args);
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
