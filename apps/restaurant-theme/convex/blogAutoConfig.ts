/**
 * Blog Auto Config App Wrappers
 *
 * Auth-protected wrappers with entitlement checks.
 * The upsert mutation validates plan limits before saving.
 */

import { query, mutation } from "./_generated/server"
import * as blogAutoConfigDefs from "@beindigital-engine/convex-functions/blogAutoConfig"
import {
  checkAutoBlogAccess,
  validateConfigAgainstPlan,
} from "@beindigital-engine/convex-functions/blogAutoGuards"

// ============================================================================
// Queries
// ============================================================================

/** Get auto blog config for a store */
export const getByStoreId = query({
  args: blogAutoConfigDefs.getByStoreId.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return blogAutoConfigDefs.getByStoreId.handler(ctx, args)
  },
})

/** Get auto-blog access status for the authenticated owner */
export const getAccessStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return checkAutoBlogAccess(ctx, identity.subject)
  },
})

// ============================================================================
// Mutations
// ============================================================================

/** Upsert auto blog config with entitlement checks */
export const upsert = mutation({
  args: blogAutoConfigDefs.upsert.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Check entitlements
    const access = await checkAutoBlogAccess(ctx, identity.subject)
    if (!access.allowed) {
      throw new Error(access.reason ?? "Acces refuse")
    }

    // Validate plan-specific limits
    validateConfigAgainstPlan(access.entitlements, {
      themes: args.themes,
      approvalMode: args.approvalMode,
      autoTranslate: args.autoTranslate,
    })

    return blogAutoConfigDefs.upsert.handler(ctx, {
      ...args,
      ownerId: identity.subject,
    })
  },
})
