/**
 * Blog Auto Usage Functions (Package Layer)
 *
 * Pure logic — no auth. Auth is handled in app wrappers.
 * Monthly quota tracking per owner.
 */

import { v } from "convex/values"

// ============================================================================
// Queries
// ============================================================================

/** Get usage for an owner in a specific period */
export const getByOwnerIdPeriod = {
  args: {
    ownerId: v.string(),
    periodKey: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("blogAutoUsage")
      .withIndex("by_ownerId_periodKey", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("periodKey", args.periodKey)
      )
      .first()
  },
}

// ============================================================================
// Helpers (pure functions)
// ============================================================================

/** Get current period key (YYYY-MM) */
export function getCurrentPeriodKey(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}
