import { v } from "convex/values"

/**
 * Check if a player can play based on cooldown (email + fingerprint).
 * Public query (no auth required).
 */
export const checkCooldown = {
  args: {
    storeId: v.optional(v.id("stores")), // Legacy, kept for backward compat
    fingerprint: v.string(),
    cooldownHours: v.number(),
  },
  handler: async (
    ctx: any,
    args: { storeId?: string; fingerprint: string; cooldownHours: number }
  ) => {
    const cooldownMs = args.cooldownHours * 60 * 60 * 1000
    const cutoff = Date.now() - cooldownMs

    // Check by fingerprint globally (across all stores)
    const recentByFingerprint = await ctx.db
      .query("gamePlays")
      .withIndex("by_fingerprint", (q: any) =>
        q.eq("fingerprint", args.fingerprint)
      )
      .order("desc")
      .first()

    if (recentByFingerprint && recentByFingerprint.playedAt > cutoff) {
      return {
        canPlay: false,
        nextPlayAt: recentByFingerprint.playedAt + cooldownMs,
      }
    }

    return { canPlay: true }
  },
}
