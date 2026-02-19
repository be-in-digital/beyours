import { query, mutation, internalMutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/paymentConnections";

// === Queries ===

/** Get a single connection by provider (tokens stripped). */
export const getByProvider = query(defs.getByProvider);

/** Get all connections (tokens stripped). */
export const getAll = query(defs.getAll);

// === Mutations ===

/**
 * Internal upsert called exclusively from the OAuth callback action.
 * Not callable from the client.
 */
export const upsert = internalMutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    return defs.upsert.handler(ctx, args);
  },
});

/**
 * Disconnect (delete) a payment connection.
 * Requires an authenticated session.
 */
export const disconnect = mutation({
  args: defs.disconnect.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return defs.disconnect.handler(ctx, args);
  },
});
