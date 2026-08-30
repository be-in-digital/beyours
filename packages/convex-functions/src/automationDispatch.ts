/**
 * Which automations may fire, and which step comes next.
 *
 * WHY THIS EXISTS: `emailAutomations` was CRUD and nothing else. An owner could
 * create a sequence, set its steps and their delays, switch it to `active`, and
 * watch five toggles in the settings screen — and no code anywhere dispatched
 * on a trigger. The whole feature was a form that saved rows.
 *
 * The dispatch rules live here, apart from the sending, because what an
 * automation may do is a policy question and the answer should be readable
 * without a database or an SES client in the room.
 *
 * WHAT THIS FILE ALSO RECORDS, deliberately: three of the five triggers cannot
 * fire at all on the current schema, and saying so in code is more honest than
 * a switch statement that silently falls through. See `TRIGGER_READINESS`.
 */

/** The five triggers the schema and the settings screen both offer. */
export type AutomationTrigger =
  | "welcome"
  | "birthday"
  | "inactive"
  | "post_order"
  | "abandoned_cart"

/** One step of a sequence, as dispatch cares about it. */
export interface AutomationStep {
  id: string
  delayMinutes: number
  templateId: string
  segmentId?: string
}

export interface AutomationRecord {
  trigger: AutomationTrigger
  status: "draft" | "active" | "paused"
  steps: AutomationStep[]
}

/**
 * Whether a trigger can fire, and if not, what is missing.
 *
 * Not a TODO list: each `false` here is a promise the product currently makes
 * in its settings screen and cannot keep. An owner switching on "Anniversaire"
 * gets a toggle that saves, an automation that activates, and no email, ever —
 * because no record in this system carries a date of birth.
 *
 * Wiring a trigger means collecting the data first; until then, refusing loudly
 * beats dispatching into nothing.
 */
export const TRIGGER_READINESS: Record<
  AutomationTrigger,
  { ready: boolean; missing?: string }
> = {
  // Fires when a subscriber confirms their double opt-in.
  welcome: { ready: true },

  birthday: {
    ready: false,
    missing:
      "no record carries a date of birth — not emailSubscribers, not userProfiles",
  },

  inactive: {
    ready: false,
    missing:
      "depends on emailSubscribers.metadata.lastOrderAt, which only " +
      "`updateMetadataIncremental` writes and nothing calls",
  },

  post_order: {
    ready: false,
    missing:
      "no order path notifies the marketing side; " +
      "`updateMetadataIncremental` exists for exactly this and has no caller",
  },

  abandoned_cart: {
    ready: false,
    missing: "carts live in the browser's Zustand store and are never persisted",
  },
}

/** Triggers that can actually reach a subscriber today. */
export function readyTriggers(): AutomationTrigger[] {
  return (Object.keys(TRIGGER_READINESS) as AutomationTrigger[]).filter(
    (t) => TRIGGER_READINESS[t]!.ready
  )
}

/**
 * May this automation run for this trigger right now?
 *
 * `paused` and `draft` both mean no. The readiness check is the second gate: an
 * automation on an unwired trigger is not a fault of the automation, and it
 * should not be started only to stall silently at its first step.
 */
export function canDispatch(
  automation: Pick<AutomationRecord, "trigger" | "status" | "steps">
): boolean {
  if (automation.status !== "active") return false
  if (!TRIGGER_READINESS[automation.trigger]?.ready) return false
  return automation.steps.length > 0
}

/**
 * The next step to send, given the ones already sent to this subscriber.
 *
 * Steps run in the order the owner arranged them, and a step already recorded
 * is never repeated — that record is what makes a retried or re-entered
 * automation safe. Returns `null` when the sequence is finished.
 */
export function nextStep(
  steps: AutomationStep[],
  sentStepIds: readonly string[]
): AutomationStep | null {
  const sent = new Set(sentStepIds)
  return steps.find((step) => !sent.has(step.id)) ?? null
}

/**
 * When a step should be sent, in milliseconds from now.
 *
 * `delayMinutes` is counted from the trigger, not from the previous step, which
 * is how the admin presents it: "J+1", "J+3". Scheduling each step relative to
 * the one before would drift, and an owner who wrote 0 / 1440 / 4320 means the
 * first day, the second and the fourth.
 */
export function delayForStep(
  step: AutomationStep,
  triggeredAt: number,
  now: number
): number {
  const due = triggeredAt + step.delayMinutes * 60_000
  return Math.max(0, due - now)
}
