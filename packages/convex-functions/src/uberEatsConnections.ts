/**
 * Uber Eats merchant connection functions (OAuth Authorization Code tokens).
 *
 * Plain { args, handler } objects wrapped by Convex query/mutation in the app
 * layer. Encrypted tokens are NEVER returned to the client — only metadata.
 */

import { v } from "convex/values"

const statusValidator = v.union(
  v.literal("connected"),
  v.literal("disconnected"),
  v.literal("error")
)

// === QUERIES ===

/**
 * Internal: return the full connection row including encrypted tokens.
 * Only call from "use node" actions that need to decrypt the token.
 */
export const getConnection = {
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("uberEatsConnections").first()
  },
}

/**
 * Safe metadata for the admin UI — no token material.
 */
export const getStatus = {
  args: {},
  handler: async (ctx: any) => {
    const c = await ctx.db.query("uberEatsConnections").first()
    if (!c) return null
    return {
      _id: c._id,
      merchantUserId: c.merchantUserId,
      status: c.status,
      scope: c.scope,
      connectedAt: c.connectedAt,
      updatedAt: c.updatedAt,
      hasRefreshToken: !!c.encryptedRefreshToken,
      tokenExpiresAt: c.tokenExpiresAt,
    }
  },
}

// === MUTATIONS ===

/**
 * Upsert the single Uber Eats connection. Call only from "use node" actions
 * after token exchange/refresh — never directly from the client.
 */
export const upsert = {
  args: {
    merchantUserId: v.optional(v.string()),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    status: statusValidator,
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.query("uberEatsConnections").first()
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now })
      return existing._id
    }

    return await ctx.db.insert("uberEatsConnections", {
      ...args,
      connectedAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Remove the Uber Eats connection (disconnect). Auth enforced in the wrapper.
 */
export const disconnect = {
  args: {},
  handler: async (ctx: any) => {
    const c = await ctx.db.query("uberEatsConnections").first()
    if (c) await ctx.db.delete(c._id)
  },
}
