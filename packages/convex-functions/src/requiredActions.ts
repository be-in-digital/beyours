import { v } from "convex/values"

/**
 * Required social actions before playing (admin CRUD).
 * The public read path lives in gamePlay.getSession.
 */

const actionType = v.union(
  v.literal("google_review"),
  v.literal("instagram_follow"),
  v.literal("facebook_like"),
  v.literal("tiktok_follow"),
  v.literal("email_subscribe")
)

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const actions = await ctx.db
      .query("requiredActions")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    return actions.sort((a: any, b: any) => a.sortOrder - b.sortOrder)
  },
}

export const create = {
  args: {
    storeId: v.id("stores"),
    type: actionType,
    name: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    isRequired: v.boolean(),
    timerSeconds: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("requiredActions")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
    const maxOrder = existing.reduce((max: number, a: any) => Math.max(max, a.sortOrder), -1)
    const now = Date.now()
    return await ctx.db.insert("requiredActions", {
      ...args,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("requiredActions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    timerSeconds: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete a required action. The bare delete is correct, and this says why.
 *
 * `gamePlays.completedActions` holds the ids of the actions a diner did, so a
 * delete here leaves ids in those arrays naming nothing — which reads like the
 * dangling-reference class #400 and #432 swept, and is not one.
 *
 * MEASURED. The only reader is `gamePlay.ts:273`, which folds the arrays into a
 * `done` set to answer "has this device already done this action?". An id that
 * no longer resolves simply never matches an action that is still required, and
 * an action that is no longer required is not asked about. There is nothing to
 * dereference and nothing to repair.
 *
 * AND REWRITING THEM WOULD BE WRONG. `gamePlays` is the record of what a diner
 * actually did — the row a prize claim, a cooldown and the consent under art.
 * 7.1 all hang off. Editing that history to tidy up an admin screen's config
 * change is a worse trade than a string nobody reads. Deleting the plays is
 * worse still.
 *
 * One consequence worth stating rather than discovering: deleting an action and
 * re-creating it mints a NEW id, so every device must do it again. That is the
 * right behaviour — a re-created "Suivez-nous sur Instagram" is a new demand,
 * not a remembered one — and it is the reason this is a decision rather than an
 * omission.
 */
export const remove = {
  args: { id: v.id("requiredActions") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
