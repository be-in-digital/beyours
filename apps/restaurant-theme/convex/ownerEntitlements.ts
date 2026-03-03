/**
 * Owner Entitlements App Wrappers
 *
 * Auth-protected wrappers around package-level entitlements functions.
 * All queries and mutations require authentication.
 */

import { query, mutation } from "./_generated/server"
import * as ownerEntitlementsDefs from "@beindigital-engine/convex-functions/ownerEntitlements"

// ============================================================================
// Queries
// ============================================================================

/** Get entitlements for the authenticated owner */
export const getMyEntitlements = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return ownerEntitlementsDefs.getByOwnerId.handler(ctx, {
      ownerId: identity.subject,
    })
  },
})

/** Get entitlements by ownerId (admin use) */
export const getByOwnerId = query({
  args: ownerEntitlementsDefs.getByOwnerId.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return ownerEntitlementsDefs.getByOwnerId.handler(ctx, args)
  },
})

// ============================================================================
// Mutations
// ============================================================================

/** Upsert owner entitlements (admin-only for now, Stripe webhooks in Phase 1B) */
export const upsert = mutation({
  args: ownerEntitlementsDefs.upsert.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return ownerEntitlementsDefs.upsert.handler(ctx, args)
  },
})
