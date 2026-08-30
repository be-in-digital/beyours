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

  // Both of these waited on the same thing: `updateMetadataIncremental` had no
  // caller, so `lastOrderAt` was never written and no order path reached the
  // marketing side at all. That was fixed separately; these are the triggers it
  // was blocking.
  inactive: { ready: true },
  post_order: { ready: true },

  abandoned_cart: {
    ready: false,
    missing: "carts live in the browser's Zustand store and are never persisted",
  },
}

/**
 * The settings toggle that governs each trigger.
 *
 * Five switches in the email settings screen, and until now not one of them was
 * read anywhere: an owner turning "Post-commande" off changed a stored boolean
 * and nothing else. Dispatch consults them now, so the switch means what it
 * says.
 */
export const TRIGGER_TOGGLE: Record<AutomationTrigger, string> = {
  welcome: "welcomeEnabled",
  birthday: "birthdayEnabled",
  inactive: "inactiveEnabled",
  post_order: "postOrderEnabled",
  abandoned_cart: "abandonedCartEnabled",
}

/**
 * How long without ordering counts as lapsed, when the automation does not say.
 *
 * Ninety days is a quarter: long enough that a monthly regular is never called
 * inactive, short enough that the message still lands while they remember the
 * restaurant.
 */
export const DEFAULT_INACTIVE_AFTER_DAYS = 90

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
  automation: Pick<AutomationRecord, "trigger" | "status" | "steps">,
  /**
   * `emailConfig.automationSettings`. Omitted, every toggle is treated as on —
   * which is what a caller with no config in hand should assume rather than
   * silently refusing everything.
   */
  settings?: Record<string, boolean> | null
): boolean {
  if (automation.status !== "active") return false
  if (!TRIGGER_READINESS[automation.trigger]?.ready) return false
  if (automation.steps.length === 0) return false

  if (settings) {
    const toggle = TRIGGER_TOGGLE[automation.trigger]
    if (settings[toggle] === false) return false
  }

  return true
}

/**
 * Has this subscriber gone quiet for long enough?
 *
 * Someone who has never ordered is NOT inactive. "Come back, we miss you" to a
 * person who has never been is the kind of message that gets a sender reported,
 * and `lastOrderAt` being absent is exactly that case.
 */
export function isLapsed(
  subscriber: { metadata?: { lastOrderAt?: number } },
  afterDays: number,
  now: number
): boolean {
  const last = subscriber.metadata?.lastOrderAt
  if (last === undefined) return false
  return now - last >= afterDays * 24 * 60 * 60 * 1000
}

/**
 * What distinguishes one firing of an automation from the next.
 *
 * The run record is keyed by step, which is right for a sequence that happens
 * once — a welcome. It is wrong for the two triggers wired here:
 *
 * - a thank-you must follow EVERY order, so the order's id is the occurrence;
 * - a win-back should be sendable again if the customer returns and lapses a
 *   second time, so the date of the order they lapsed after is the occurrence.
 *   While they stay away that value does not move, so the sequence does not
 *   repeat; when they order again it changes, and a later lapse is a new one.
 */
export function occurrenceFor(
  trigger: AutomationTrigger,
  context: { orderId?: string; lastOrderAt?: number }
): string | undefined {
  if (trigger === "post_order") return context.orderId
  if (trigger === "inactive") {
    return context.lastOrderAt === undefined
      ? undefined
      : `lapsed-${context.lastOrderAt}`
  }
  return undefined
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
