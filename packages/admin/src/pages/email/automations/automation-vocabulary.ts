/**
 * The words and the arithmetic the automations screen shares (#270).
 *
 * Separate from both files that use it so the list page and the dialog cannot
 * disagree about what « J+3 » means — which is the failure mode the issue warns
 * about: `delayForStep` counts every delay from the TRIGGER, and an editor that
 * read it as "after the previous step" would drift.
 */

/** One step, as the editor holds it before it is saved. */
export interface AutomationStepDraft {
  id: string
  /** Minutes after the TRIGGER — never after the previous step. */
  delayMinutes: number
  templateId: string
  segmentId?: string
}

/** An automation as the screen reads it back. */
export interface AutomationDoc {
  _id: string
  name: string
  trigger: string
  status: "draft" | "active" | "paused"
  steps?: AutomationStepDraft[]
  inactiveAfterDays?: number
  updatedAt?: number
  stats?: { sent?: number; opened?: number; clicked?: number }
}

/** What the owner calls each trigger. */
export const AUTOMATION_TRIGGER_LABELS = {
  welcome: "Bienvenue",
  post_order: "Après une commande",
  inactive: "Client inactif",
  birthday: "Anniversaire",
  abandoned_cart: "Panier abandonné",
} as const

/** What the owner calls each status. */
export const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  active: "Active",
  paused: "En pause",
}

/** The default the win-back sweep applies when no automation sets one. */
export const DEFAULT_INACTIVE_AFTER_DAYS = 90

/**
 * A delay in the words the rest of the admin already uses.
 *
 * « Immédiat » for zero, then hours, then « J+n » — the reading the campaigns
 * screen presents. Always ANCHORED to the trigger in the wording, because the
 * number is anchored there in the dispatcher: `delayForStep` adds
 * `step.delayMinutes` to the occurrence time, not to the previous step's send.
 */
export function describeDelay(delayMinutes: number): string {
  if (delayMinutes <= 0) return "immédiatement après le déclencheur"
  if (delayMinutes < 60) {
    return `${delayMinutes} min après le déclencheur`
  }
  if (delayMinutes < 24 * 60) {
    const hours = Math.round(delayMinutes / 60)
    return `${hours} h après le déclencheur`
  }
  // Rounded down: a step at 36 hours is « J+1 », not « J+2 ». The hour figure is
  // what the field holds, and this line is the summary beside it.
  const days = Math.floor(delayMinutes / (24 * 60))
  return `J+${days} après le déclencheur`
}
