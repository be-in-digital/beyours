import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/kitchenTickets";

export const getByStore = query(defs.getByStore);
export const getByStatus = query(defs.getByStatus);
export const getByStation = query(defs.getByStation);
export const getByOrder = query(defs.getByOrder);

export const create = mutation({
  args: defs.create.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.create.handler(ctx, args);
  },
});

export const updateStatus = mutation({
  args: defs.updateStatus.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.updateStatus.handler(ctx, args);
  },
});

export const assignStation = mutation({
  args: defs.assignStation.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.assignStation.handler(ctx, args);
  },
});

export const assignTo = mutation({
  args: defs.assignTo.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.assignTo.handler(ctx, args);
  },
});

export const incrementPrintCount = mutation({
  args: defs.incrementPrintCount.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.incrementPrintCount.handler(ctx, args);
  },
});
