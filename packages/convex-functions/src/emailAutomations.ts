/**
 * Email automations functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"

import { TRIGGER_READINESS } from "./automationDispatch"

const triggerValidator = v.union(
  v.literal("welcome"),
  v.literal("birthday"),
  v.literal("inactive"),
  v.literal("post_order"),
  v.literal("abandoned_cart")
)

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused")
)

const stepValidator = v.object({
  id: v.string(),
  delayMinutes: v.number(),
  templateId: v.id("emailTemplates"),
  segmentId: v.optional(v.id("emailSegments")),
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
      .query("emailAutomations")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

export const getById = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

export const listActive = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailAutomations")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "active")
      )
      .collect()
  },
}

/**
 * Every active automation on one trigger, across the whole deployment.
 *
 * The store-scoped `listActive` cannot serve the nightly win-back sweep: it
 * runs for the deployment, not for one restaurant, and a cron has no store to
 * scope by. Filtered rather than indexed because a deployment holds a handful
 * of automations, not a table worth scanning.
 */
export const listActiveByTrigger = {
  args: { trigger: v.string() },
  handler: async (ctx: any, args: any) => {
    const all = await ctx.db.query("emailAutomations").collect()
    return all.filter(
      (a: any) => a.status === "active" && a.trigger === args.trigger
    )
  },
}

// === MUTATIONS ===

/** How long a subscriber must be quiet before a win-back sequence fires. */
export const DEFAULT_INACTIVE_AFTER_DAYS = 90

/**
 * At least one step, and not more than a sequence anybody would write.
 *
 * The ceiling is not a business rule — it is there so a forged payload cannot
 * schedule ten thousand sends off one trigger.
 */
export const MAX_AUTOMATION_STEPS = 20

/**
 * Refuse a trigger that cannot fire, at the door.
 *
 * THE SAME SHAPE AS `HONOURABLE_DISCOUNT_TYPES`, and for the same reason. Two of
 * the five triggers have no data behind them — `birthday` (no record carries a
 * date of birth) and `abandoned_cart` (carts live in the browser and are never
 * persisted) — and `TRIGGER_READINESS` in `automationDispatch.ts` already
 * carries the reason for each. Until now nothing enforced it anywhere: the
 * settings screen offered the toggle, `create` accepted the trigger, `activate`
 * activated it, and not one email was ever sent.
 *
 * Enforced HERE rather than only in the editor, because the mutation is public
 * under `marketing:write` and the editor is not the only caller — an API call
 * was the only way to make an automation at all until this issue.
 *
 * Implement a trigger in `TRIGGER_READINESS` and it becomes creatable on the
 * same commit, in the editor and on the API together.
 */
function assertTriggerCanFire(trigger: string): void {
  const readiness = TRIGGER_READINESS[trigger as keyof typeof TRIGGER_READINESS]
  if (readiness && !readiness.ready) {
    throw new ConvexError({
      code: "automation_trigger_not_ready",
      message:
        `Ce déclencheur n'est pas encore disponible : ${readiness.missing ?? "les données nécessaires n'existent pas"}. ` +
        "Une automatisation sur ce déclencheur n'enverrait jamais rien.",
      trigger,
    })
  }
}

/** A sequence the dispatcher can actually run. */
function assertSteps(steps: Array<{ delayMinutes: number }>): void {
  if (steps.length === 0) {
    throw new ConvexError({
      code: "automation_without_steps",
      message: "Ajoutez au moins une étape : une automatisation sans étape n'envoie rien.",
    })
  }
  if (steps.length > MAX_AUTOMATION_STEPS) {
    throw new ConvexError({
      code: "automation_too_many_steps",
      message: `Une automatisation accepte au maximum ${MAX_AUTOMATION_STEPS} étapes.`,
    })
  }
  for (const step of steps) {
    // `delayForStep` counts every delay FROM THE TRIGGER, not from the previous
    // step, so a negative one would schedule a send before the event that
    // caused it and a fractional one would land between minutes.
    if (!Number.isInteger(step.delayMinutes) || step.delayMinutes < 0) {
      throw new ConvexError({
        code: "automation_invalid_delay",
        message: "Un délai se compte en minutes entières, à partir du déclencheur.",
      })
    }
  }
}

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    trigger: triggerValidator,
    steps: v.array(stepValidator),
    /**
     * Quiet days before a win-back sequence fires — `inactive` only.
     *
     * IT WAS ON THE TABLE AND ON NEITHER MUTATION. `emailAutomations.inactiveAfterDays`
     * is read by the nightly win-back sweep and no caller, UI or API, could ever
     * set it, so every win-back automation in existence was stuck on the 90-day
     * default. Added here and on `update` together; the editor exposes it only
     * for the trigger it belongs to.
     */
    inactiveAfterDays: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    assertTriggerCanFire(args.trigger)
    assertSteps(args.steps)
    const now = Date.now()
    return await ctx.db.insert("emailAutomations", {
      ...args,
      status: "draft",
      stats: emptyStats,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailAutomations"),
    name: v.optional(v.string()),
    trigger: v.optional(triggerValidator),
    steps: v.optional(v.array(stepValidator)),
    inactiveAfterDays: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    if (fields.trigger !== undefined) assertTriggerCanFire(fields.trigger)
    if (fields.steps !== undefined) assertSteps(fields.steps)
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete an automation — unless it has already mailed somebody.
 *
 * WHAT WENT WRONG (#412 P3-F4). A bare `ctx.db.delete(args.id)` over
 * `emailAutomationRuns.automationId`, which is REQUIRED. Those rows are the
 * record of which step reached which subscriber, and the dedupe that stops a
 * retried or rescheduled step mailing the same person the same message twice.
 * They also outlive the trigger by design — an automation's later steps are
 * scheduled days out — so deleting the automation strands every one of them and
 * silently drops every step still in flight: a subscriber gets step 1 and never
 * step 2, with nothing anywhere saying why.
 *
 * There is no automation editor in the product, so this delete has no UI caller
 * today. It is public on the API under `marketing:write` all the same, and the
 * person who wires the first button to it will not be reading this file.
 *
 * The way out is `pause`, which already exists here and which `listActive` and
 * `listActiveByTrigger` both respect, so a paused automation fires nothing.
 *
 * The read goes through the `automationId` prefix of
 * `by_automation_subscriber_occurrence_step`. `by_automationId` is deliberately
 * NOT re-added — see the note on its removal in the schema.
 */
export const remove = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    const automation = await ctx.db.get(args.id)
    if (!automation) throw new Error("Automatisation introuvable")

    const run = await ctx.db
      .query("emailAutomationRuns")
      .withIndex("by_automation_subscriber_occurrence_step", (q: any) =>
        q.eq("automationId", args.id)
      )
      .first()

    if (run) {
      throw new ConvexError({
        code: "automation_has_runs",
        message:
          `« ${automation.name} » a déjà envoyé des emails : la supprimer effacerait ` +
          "la trace de qui a reçu quoi, et les étapes encore programmées " +
          "n'arriveraient jamais. Mettez-la en pause pour l'arrêter.",
      })
    }

    await ctx.db.delete(args.id)
  },
}

/**
 * Switch an automation on.
 *
 * The same two checks `create` makes, re-made here. A draft written before those
 * checks existed — every automation on every deployment today was written by an
 * API call against the unguarded mutation — can hold an unready trigger or no
 * steps at all, and activating it is the moment the promise is made to the
 * owner. Refusing at activation is the last place it can be refused before a
 * screen starts reporting "active" about a sequence that sends nothing.
 */
export const activate = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    const automation = await ctx.db.get(args.id)
    if (!automation) throw new Error("Automatisation introuvable")
    assertTriggerCanFire(automation.trigger)
    assertSteps(automation.steps ?? [])
    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() })
  },
}

export const pause = {
  args: { id: v.id("emailAutomations") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() })
  },
}

// === INTERNAL ===

export const incrementStats = {
  args: {
    id: v.id("emailAutomations"),
    field: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("unsubscribed"),
      v.literal("converted")
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const automation = await ctx.db.get(args.id)
    if (!automation) return
    const delta = args.amount ?? 1
    await ctx.db.patch(args.id, {
      stats: {
        ...automation.stats,
        [args.field]: (automation.stats[args.field] ?? 0) + delta,
      },
      updatedAt: Date.now(),
    })
  },
}
