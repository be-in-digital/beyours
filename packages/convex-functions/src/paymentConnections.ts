/**
 * Payment connections management functions
 *
 * Exports plain { args, handler } objects for Convex query/mutation wrappers.
 * Sensitive token fields are never returned to the client — only metadata.
 */

import { v } from "convex/values"

// Shared provider validator used in multiple function args
const providerValidator = v.union(
  v.literal("stripe"),
  v.literal("sumup"),
  v.literal("paypal")
)

/**
 * Connection status validator — must stay equal to the `status` union in
 * `@be-yours/convex-schema` (`tables/paymentConnections.ts`), which
 * documents what each value means.
 *
 * `onboarding_complete` says the provider account exists and onboarding
 * finished, but the charge path does not route to it. Only `connected` means
 * the restaurant is actually being paid, so only `connected` may open a charge
 * path (see `getSumUpAccessToken` in each app's `convex/sumup.ts`).
 */
const statusValidator = v.union(
  v.literal("connected"),
  v.literal("onboarding_complete"),
  v.literal("disconnected"),
  v.literal("error")
)

// === QUERIES ===

/**
 * Get a single payment connection by provider.
 * Returns metadata only — encrypted tokens are stripped.
 */
export const getByProvider = {
  args: {
    provider: providerValidator,
  },
  handler: async (ctx: any, args: any) => {
    const connection = await ctx.db
      .query("paymentConnections")
      .withIndex("by_provider", (q: any) => q.eq("provider", args.provider))
      .first()

    if (!connection) return null

    // Return safe metadata — never expose encrypted tokens to the client
    return {
      _id: connection._id,
      provider: connection.provider,
      merchantId: connection.merchantId,
      status: connection.status,
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
      hasRefreshToken: !!connection.encryptedRefreshToken,
      tokenExpiresAt: connection.tokenExpiresAt,
    }
  },
}

/**
 * Get all payment connections.
 * Returns metadata only — encrypted tokens are stripped.
 */
export const getAll = {
  args: {},
  handler: async (ctx: any) => {
    const connections = await ctx.db.query("paymentConnections").collect()

    return connections.map((c: any) => ({
      _id: c._id,
      provider: c.provider,
      merchantId: c.merchantId,
      status: c.status,
      connectedAt: c.connectedAt,
      updatedAt: c.updatedAt,
    }))
  },
}

// === MUTATIONS ===

/**
 * Upsert a payment connection.
 *
 * Intended to be called only from "use node" actions (after OAuth token
 * exchange) via an internalMutation wrapper — never directly from the client.
 *
 * If a connection for the provider already exists it is patched in place;
 * otherwise a new row is inserted.
 */
export const upsert = {
  args: {
    provider: providerValidator,
    merchantId: v.string(),
    encryptedAccessToken: v.optional(v.string()),
    encryptedRefreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    status: statusValidator,
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("paymentConnections")
      .withIndex("by_provider", (q: any) => q.eq("provider", args.provider))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now })
      return existing._id
    }

    return await ctx.db.insert("paymentConnections", {
      ...args,
      connectedAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Permanently remove a payment connection for the given provider.
 *
 * Auth checks are enforced in the wrapper mutation in the app layer.
 */
export const disconnect = {
  args: {
    provider: providerValidator,
  },
  handler: async (ctx: any, args: any) => {
    const connection = await ctx.db
      .query("paymentConnections")
      .withIndex("by_provider", (q: any) => q.eq("provider", args.provider))
      .first()

    if (connection) {
      await ctx.db.delete(connection._id)
    }
  },
}
