import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import * as defs from "@beindigital-engine/convex-functions/teamMembers";

// === QUERIES ===

export const list = query(defs.list);
export const getByUser = query(defs.getByUser);
export const getByRole = query(defs.getByRole);
export const getByEmail = query(defs.getByEmail);
export const getByInvitationToken = query(defs.getByInvitationToken);

// Internal query for actions to read member data
export const getById = internalQuery({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// === MUTATIONS ===

export const invite = mutation({
  args: defs.invite.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.invite.handler(ctx, args);
  },
});

// Internal version of invite (called from sendInvitationEmail action)
export const inviteInternal = internalMutation({
  args: defs.invite.args,
  handler: async (ctx, args) => {
    return defs.invite.handler(ctx, args);
  },
});

export const acceptInvitation = mutation({
  args: defs.acceptInvitation.args,
  handler: async (ctx, args) => {
    return defs.acceptInvitation.handler(ctx, args);
  },
});

export const resendInvitation = mutation({
  args: defs.resendInvitation.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.resendInvitation.handler(ctx, args);
  },
});

// Internal version (called from resendInvitationEmail action)
export const resendInvitationInternal = internalMutation({
  args: defs.resendInvitation.args,
  handler: async (ctx, args) => {
    return defs.resendInvitation.handler(ctx, args);
  },
});

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

export const toggleActive = mutation({
  args: defs.toggleActive.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.toggleActive.handler(ctx, args);
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
