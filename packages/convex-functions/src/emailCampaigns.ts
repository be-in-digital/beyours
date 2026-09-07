/**
 * Email campaigns functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 * Stats are incremented in real-time — never aggregated from emailEvents
 */

import { v } from "convex/values"

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("paused"),
  v.literal("cancelled"),
  v.literal("failed")
)

const statsValidator = v.object({
  sent: v.number(),
  delivered: v.number(),
  opened: v.number(),
  clicked: v.number(),
  bounced: v.number(),
  unsubscribed: v.number(),
  converted: v.number(),
  revenue: v.number(),
})

const emptyStats = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
  converted: 0,
  revenue: 0,
}

// === QUERIES ===

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailCampaigns")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
}

export const getById = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

export const listRecent = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailCampaigns")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(args.limit ?? 5)
  },
}

export const listByStatus = {
  args: {
    storeId: v.id("stores"),
    status: statusValidator,
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailCampaigns")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      .collect()
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    subject: v.string(),
    previewText: v.optional(v.string()),
    templateId: v.id("emailTemplates"),
    segmentId: v.optional(v.id("emailSegments")),
    abTestEnabled: v.boolean(),
    variants: v.optional(
      v.array(
        v.object({
          id: v.string(),
          subject: v.string(),
          percentage: v.number(),
        })
      )
    ),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("emailCampaigns", {
      ...args,
      status: args.scheduledAt ? "scheduled" : "draft",
      stats: emptyStats,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailCampaigns"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    previewText: v.optional(v.string()),
    templateId: v.optional(v.id("emailTemplates")),
    segmentId: v.optional(v.id("emailSegments")),
    abTestEnabled: v.optional(v.boolean()),
    variants: v.optional(
      v.array(
        v.object({
          id: v.string(),
          subject: v.string(),
          percentage: v.number(),
        })
      )
    ),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}

export const schedule = {
  args: {
    id: v.id("emailCampaigns"),
    scheduledAt: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) throw new Error("Campagne introuvable")
    if (campaign.status !== "draft") {
      throw new Error("Seule une campagne en brouillon peut être planifiée")
    }
    await ctx.db.patch(args.id, {
      status: "scheduled",
      scheduledAt: args.scheduledAt,
      updatedAt: Date.now(),
    })
  },
}

export const cancel = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) throw new Error("Campagne introuvable")
    if (!["draft", "scheduled", "paused", "failed"].includes(campaign.status)) {
      throw new Error("Cette campagne ne peut pas être annulée")
    }
    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    })
  },
}

export const pause = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) throw new Error("Campagne introuvable")
    if (campaign.status !== "sending") {
      throw new Error("Seule une campagne en cours d'envoi peut être mise en pause")
    }
    await ctx.db.patch(args.id, {
      status: "paused",
      updatedAt: Date.now(),
    })
  },
}

export const markSending = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) throw new Error("Campagne introuvable")
    // `failed` is relaunchable, and that is the point of having it: the owner
    // fixes what the reason names — restores the template, re-creates the
    // segment — and presses "Relancer". The cursor is untouched, so the send
    // resumes where it stopped rather than mailing the first batch twice.
    if (!["draft", "scheduled", "paused", "failed"].includes(campaign.status)) {
      throw new Error("Cette campagne ne peut pas être envoyée dans son état actuel")
    }
    await ctx.db.patch(args.id, {
      status: "sending",
      // Cleared here rather than left to rot: a stale reason under a running
      // campaign reads as a live problem.
      failureReason: undefined,
      sentAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

export const markSent = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) throw new Error("Campagne introuvable")
    if (campaign.status !== "sending") {
      throw new Error("Seule une campagne en cours d'envoi peut être marquée comme envoyée")
    }
    await ctx.db.patch(args.id, {
      status: "sent",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

/**
 * Stop the send and say why, on the screen the owner is looking at.
 *
 * WHY THIS EXISTS: `sendBatch` had exactly one reaction to a template, a config
 * or a segment it could not read — `console.error` and `return`. The campaign
 * stayed at `sending` for ever. The owner saw "En cours" against a send that had
 * stopped hours earlier, the only trace was a log line no restaurant can read,
 * and "Relancer" restarted a send that would stop again at the same place.
 *
 * `reason` is the sentence shown under the campaign's name, so it has to name
 * the thing to fix — the template that is missing, the segment that is gone —
 * not "an error occurred".
 *
 * Internal: the send action is the only caller, and a campaign nobody sends
 * cannot fail.
 */
export const markFailed = {
  args: {
    id: v.id("emailCampaigns"),
    reason: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) return

    // Only a send in flight can fail. A campaign the owner paused or cancelled
    // between two batches has already been given a state by a human, and a late
    // batch must not overwrite it.
    if (campaign.status !== "sending") return

    await ctx.db.patch(args.id, {
      status: "failed",
      failureReason: args.reason,
      updatedAt: Date.now(),
    })
  },
}

/** Record how far the send has got, so the next batch resumes there. */
export const saveSendCursor = {
  args: {
    id: v.id("emailCampaigns"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      sendCursor: args.cursor ?? undefined,
      updatedAt: Date.now(),
    })
  },
}

/**
 * The campaigns whose scheduled time has arrived.
 *
 * `schedule` set `status: "scheduled"` and `scheduledAt`, the wizard offered a
 * date and time picker, and nothing anywhere ever looked at either: a scheduled
 * campaign sat at `scheduled` for good, and the only way to send was the manual
 * menu item.
 *
 * Store-scoped queries cannot serve this — the sweep runs for the deployment,
 * not for one restaurant — so it walks `by_storeId_status` per store. The caller
 * is a cron with no identity; see `crons.ts`.
 */
export const dueForSending = {
  args: { now: v.number() },
  handler: async (ctx: any, args: any) => {
    const scheduled = await ctx.db
      .query("emailCampaigns")
      .filter((q: any) => q.eq(q.field("status"), "scheduled"))
      .collect()

    return scheduled
      .filter((c: any) => c.scheduledAt !== undefined && c.scheduledAt <= args.now)
      .map((c: any) => c._id)
  },
}

// === INTERNAL ===

/**
 * Increment a single stat field atomically.
 * Called by the SES webhook handler on each tracking event.
 */
export const incrementStats = {
  args: {
    id: v.id("emailCampaigns"),
    field: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("unsubscribed"),
      v.literal("converted")
    ),
    amount: v.optional(v.number()), // defaults to 1
  },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) return
    const delta = args.amount ?? 1
    await ctx.db.patch(args.id, {
      stats: {
        ...campaign.stats,
        [args.field]: (campaign.stats[args.field] ?? 0) + delta,
      },
      updatedAt: Date.now(),
    })
  },
}

/**
 * Reset stats and put campaign back to draft (for resend).
 */
export const resetStats = {
  args: { id: v.id("emailCampaigns") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      stats: emptyStats,
      status: "draft",
      sentAt: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Increment revenue stat atomically.
 */
export const incrementRevenue = {
  args: {
    id: v.id("emailCampaigns"),
    amount: v.number(), // in cents
  },
  handler: async (ctx: any, args: any) => {
    const campaign = await ctx.db.get(args.id)
    if (!campaign) return
    await ctx.db.patch(args.id, {
      stats: {
        ...campaign.stats,
        revenue: (campaign.stats.revenue ?? 0) + args.amount,
        converted: (campaign.stats.converted ?? 0) + 1,
      },
      updatedAt: Date.now(),
    })
  },
}
