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

/**
 * Move this month's counters by a signed delta, creating the row if this is
 * the owner's first use of the month.
 *
 * Counts never go below zero: a release that races a month boundary, or one
 * that runs twice because a retry re-entered the failure path, must not leave
 * a negative count that silently hands out free quota.
 */
export async function bumpUsage(
  ctx: any,
  ownerId: string,
  delta: { generated?: number; images?: number },
): Promise<void> {
  const periodKey = getCurrentPeriodKey()
  const timestamp = Date.now()

  const existing = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  const generated = delta.generated ?? 0
  const images = delta.images ?? 0

  if (existing) {
    await ctx.db.patch(existing._id, {
      generatedCount: Math.max(0, existing.generatedCount + generated),
      imageGeneratedCount: Math.max(0, (existing.imageGeneratedCount ?? 0) + images),
      updatedAt: timestamp,
    })
    return
  }

  await ctx.db.insert("blogAutoUsage", {
    ownerId,
    periodKey,
    generatedCount: Math.max(0, generated),
    publishedCount: 0,
    imageGeneratedCount: Math.max(0, images),
    updatedAt: timestamp,
  })
}

/**
 * The Image-to-Product analysis counter, moved by a signed delta.
 *
 * Separate from `bumpUsage` because it lives on the same row but is a different
 * entitlement with its own quota, and a release must not be able to hand back a
 * slot the caller never took.
 */
export async function bumpImageToProductUsage(
  ctx: any,
  ownerId: string,
  delta: number,
): Promise<void> {
  const periodKey = getCurrentPeriodKey()
  const timestamp = Date.now()

  const existing = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, {
      imageToProductAnalysisCount: Math.max(
        0,
        (existing.imageToProductAnalysisCount ?? 0) + delta,
      ),
      updatedAt: timestamp,
    })
    return
  }

  await ctx.db.insert("blogAutoUsage", {
    ownerId,
    periodKey,
    generatedCount: 0,
    publishedCount: 0,
    imageToProductAnalysisCount: Math.max(0, delta),
    updatedAt: timestamp,
  })
}
