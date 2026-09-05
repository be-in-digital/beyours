/**
 * What an automation has already sent, and to whom.
 *
 * The record that makes a sequence safe to re-enter. An automation fires from
 * an event and then keeps firing on a delay, so its later steps outlive the
 * thing that started them: without this, a retried step, a second confirmation
 * or a redeploy mails the same person the same message again — silently, one
 * subscriber at a time, with nobody watching a progress bar.
 */

import { v } from "convex/values"

/**
 * The step ids this automation has already sent to this subscriber.
 *
 * Scoped to one firing when `occurrenceKey` is given: a post-order thank-you
 * asks "which steps have gone out FOR THIS ORDER", not "ever", or the second
 * order would be met with a sequence that considers itself finished.
 */
export const stepsSentTo = {
  args: {
    automationId: v.id("emailAutomations"),
    subscriberId: v.id("emailSubscribers"),
    occurrenceKey: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any): Promise<string[]> => {
    /**
     * Read exactly this subscriber's firing, not the automation's whole history.
     *
     * This narrowed on `automationId` alone and matched `subscriberId` and
     * `occurrenceKey` in JavaScript, so answering "which steps has Camille had
     * for order #4012" read every run the automation had ever recorded, for
     * every subscriber who ever entered it — and the dispatcher asks it once
     * per subscriber per step. A store with 500 subscribers in a four-step
     * sequence read 2,000 documents to return four strings, then did it again
     * for the next subscriber. Convex aborts a transaction past 16,384
     * documents, which is a two-year-old mailing list.
     *
     * The write path at `record` below has always used this index. The read is
     * now on the same one: three equalities leave only the steps of this one
     * firing, so the cost is the length of the sequence and nothing else.
     */
    const runs = await ctx.db
      .query("emailAutomationRuns")
      .withIndex("by_automation_subscriber_occurrence_step", (q: any) =>
        q
          .eq("automationId", args.automationId)
          .eq("subscriberId", args.subscriberId)
          .eq("occurrenceKey", args.occurrenceKey)
      )
      .collect()
    return runs.map((r: any) => r.stepId)
  },
}

/**
 * Record a step as sent.
 *
 * Written immediately after the send rather than before it: a step recorded
 * but never sent is an email the subscriber silently never receives, which is
 * harder to notice than one sent twice — and the caller checks for an existing
 * record before sending anyway.
 */
export const record = {
  args: {
    automationId: v.id("emailAutomations"),
    subscriberId: v.id("emailSubscribers"),
    storeId: v.id("stores"),
    stepId: v.string(),
    occurrenceKey: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    // Guard against the race the index exists for: two dispatches of the same
    // step landing together. The reader above is a page behind by the time the
    // send finishes.
    const existing = await ctx.db
      .query("emailAutomationRuns")
      .withIndex("by_automation_subscriber_occurrence_step", (q: any) =>
        q
          .eq("automationId", args.automationId)
          .eq("subscriberId", args.subscriberId)
          .eq("occurrenceKey", args.occurrenceKey)
          .eq("stepId", args.stepId)
      )
      .first()
    if (existing) return existing._id

    return await ctx.db.insert("emailAutomationRuns", {
      automationId: args.automationId,
      subscriberId: args.subscriberId,
      storeId: args.storeId,
      stepId: args.stepId,
      occurrenceKey: args.occurrenceKey,
      sentAt: Date.now(),
    })
  },
}
