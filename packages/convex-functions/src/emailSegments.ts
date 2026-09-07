/**
 * Email segments functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"
import {
  automationsReferencing,
  liveCampaignsReferencing,
  quoteNames,
} from "./emailAssetReferences"

const ruleValidator = v.object({
  id: v.string(),
  field: v.string(),
  operator: v.union(
    v.literal("equals"),
    v.literal("not_equals"),
    v.literal("gt"),
    v.literal("lt"),
    v.literal("gte"),
    v.literal("lte"),
    v.literal("contains"),
    v.literal("not_contains"),
    v.literal("before"),
    v.literal("after"),
    v.literal("in_last_days")
  ),
  value: v.string(),
})

const ruleOperatorValidator = v.union(v.literal("and"), v.literal("or"))

// === QUERIES ===

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailSegments")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

export const getById = {
  args: { id: v.id("emailSegments") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * The most active subscribers the segment preview will read.
 *
 * A segment rule is written against whatever field the owner picked —
 * `metadata.totalSpent`, `tags`, `city` — with operators like « contient ».
 * None of that is indexable, so the preview has to read rows and decide in
 * JavaScript, and the only honest bound is on how many rows it reads.
 *
 * This is a debounced live `useQuery`: it re-runs every time the owner edits a
 * rule. Collecting the whole active list per keystroke is what made the segment
 * editor unusable on a list that had grown, and past 16,384 rows it made the
 * dialog throw instead of previewing anything at all. The answer says how far
 * it looked so the dialog can present the count as the sample it is.
 */
export const SEGMENT_PREVIEW_SCAN_LIMIT = 2_000

/**
 * How many active subscribers match these rules, out of the first
 * `SEGMENT_PREVIEW_SCAN_LIMIT`.
 *
 * Returns `{ count, scanned, truncated }` rather than a bare number: a bare
 * number cannot say whether it describes the list or the first two thousand of
 * it, and the dialog has to be able to say which.
 */
export const countMatchingSubscribers = {
  args: {
    storeId: v.id("stores"),
    rules: v.array(ruleValidator),
    ruleOperator: ruleOperatorValidator,
  },
  handler: async (
    ctx: any,
    args: { storeId: string; rules: any[]; ruleOperator: "and" | "or" }
  ) => {
    // One more than the cap, so a list that stops exactly at it is not reported
    // as truncated.
    const rows = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "active")
      )
      .take(SEGMENT_PREVIEW_SCAN_LIMIT + 1)

    const truncated = rows.length > SEGMENT_PREVIEW_SCAN_LIMIT
    const scanned = truncated ? rows.slice(0, SEGMENT_PREVIEW_SCAN_LIMIT) : rows

    if (args.rules.length === 0) {
      return { count: scanned.length, scanned: scanned.length, truncated }
    }

    const count = scanned.filter((subscriber: any) => {
      const results = args.rules.map((rule: any) => evaluateRule(subscriber, rule))
      return args.ruleOperator === "and"
        ? results.every(Boolean)
        : results.some(Boolean)
    }).length

    return { count, scanned: scanned.length, truncated }
  },
}

/**
 * Pure rule evaluator — also exported for use in buildSegmentFilter util
 */
function evaluateRule(subscriber: any, rule: any): boolean {
  const value = getNestedValue(subscriber, rule.field)
  const ruleValue = rule.value

  switch (rule.operator) {
    case "equals":
      return String(value) === ruleValue
    case "not_equals":
      return String(value) !== ruleValue
    case "gt":
      return Number(value) > Number(ruleValue)
    case "lt":
      return Number(value) < Number(ruleValue)
    case "gte":
      return Number(value) >= Number(ruleValue)
    case "lte":
      return Number(value) <= Number(ruleValue)
    case "contains":
      if (Array.isArray(value)) return value.includes(ruleValue)
      return String(value).toLowerCase().includes(ruleValue.toLowerCase())
    case "not_contains":
      if (Array.isArray(value)) return !value.includes(ruleValue)
      return !String(value).toLowerCase().includes(ruleValue.toLowerCase())
    case "before":
      return Number(value) < Number(ruleValue)
    case "after":
      return Number(value) > Number(ruleValue)
    case "in_last_days": {
      const days = Number(ruleValue)
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      return Number(value) >= cutoff
    }
    default:
      return false
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj)
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    rules: v.array(ruleValidator),
    ruleOperator: ruleOperatorValidator,
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("emailSegments", {
      ...args,
      subscriberCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailSegments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    rules: v.optional(v.array(ruleValidator)),
    ruleOperator: v.optional(ruleOperatorValidator),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete an audience segment.
 *
 * This was a bare `ctx.db.delete(args.id)`, and it is the worse half of the pair
 * `emailTemplates.remove` makes up. `emailCampaigns.segmentId` is OPTIONAL, and
 * `sendBatch` treated "the segment came back null" as "there is no segment": it
 * skipped the audience filter entirely. So deleting a segment a scheduled
 * campaign named did not halt that campaign — it **broadened** it. Copy written
 * for one slice of the list went to the whole list, in batches, and marketing
 * mail cannot be recalled.
 *
 * `emailAutomations.steps[].segmentId` carries the same column and was reachable
 * from no delete path.
 *
 * Which references block, and why only some of them, is in
 * `emailAssetReferences.ts`.
 *
 * Two defences, and the second is not redundant: this refusal stops the segment
 * going while a campaign still depends on it, and `sendBatch` now fails a
 * campaign whose segment cannot be read rather than sending to everyone. A
 * segment deleted before this shipped is exactly the case the second one is for.
 */
export const remove = {
  args: { id: v.id("emailSegments") },
  handler: async (ctx: any, args: any) => {
    const segment = await ctx.db.get(args.id)
    if (!segment) throw new Error("Segment introuvable")

    const campaigns = await liveCampaignsReferencing(
      ctx,
      segment.storeId,
      "segmentId",
      args.id
    )
    if (campaigns.length > 0) {
      const plural = campaigns.length > 1
      throw new ConvexError({
        code: "segment_in_campaign",
        message:
          `Ce segment cible ${campaigns.length} campagne${plural ? "s" : ""} ` +
          `en cours ou à venir : ${quoteNames(campaigns)}. Sans lui, ` +
          `${plural ? "elles partiraient" : "elle partirait"} à toute la liste. ` +
          `Changez ${plural ? "leur" : "son"} audience ou annulez-${plural ? "les" : "la"} ` +
          "avant de le supprimer.",
      })
    }

    const automations = await automationsReferencing(
      ctx,
      segment.storeId,
      "segmentId",
      args.id
    )
    if (automations.length > 0) {
      const plural = automations.length > 1
      throw new ConvexError({
        code: "segment_in_automation",
        message:
          `Ce segment est utilisé par ${automations.length} automatisation${plural ? "s" : ""} : ` +
          `${quoteNames(automations)}. Modifiez ${plural ? "ces automatisations" : "cette automatisation"} ` +
          "avant de supprimer le segment.",
      })
    }

    await ctx.db.delete(args.id)
  },
}

export const duplicate = {
  args: { id: v.id("emailSegments") },
  handler: async (ctx: any, args: any) => {
    const original = await ctx.db.get(args.id)
    if (!original) throw new Error("Segment introuvable")
    const now = Date.now()
    return await ctx.db.insert("emailSegments", {
      storeId: original.storeId,
      name: `${original.name} (copie)`,
      description: original.description,
      rules: original.rules,
      ruleOperator: original.ruleOperator,
      subscriberCount: original.subscriberCount,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const refreshCount = {
  args: {
    id: v.id("emailSegments"),
    count: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      subscriberCount: args.count,
      updatedAt: Date.now(),
    })
  },
}
