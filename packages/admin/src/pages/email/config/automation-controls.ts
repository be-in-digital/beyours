/**
 * The automation switches the email settings screen may offer.
 *
 * WHY THIS EXISTS: the screen used to hard-code five switches. Two of them —
 * "Email d'anniversaire" and "Panier abandonné" — govern triggers the dispatch
 * engine refuses outright (`TRIGGER_READINESS` in `automationDispatch`), because
 * no record carries a date of birth and no cart is ever persisted. An owner
 * switched one on, the save succeeded, the screen said it was on, and nothing
 * would ever send.
 *
 * The list is derived from `TRIGGER_READINESS` rather than restated here, so
 * there is one answer to "can this fire?" and the switch re-enables itself the
 * day the trigger is wired. Only the French copy lives in this file — what the
 * owner reads is a UI concern; whether the engine can honour it is not.
 */

import {
  TRIGGER_READINESS,
  type AutomationTrigger,
} from "@be-in-digital/convex-functions/automationDispatch"

/** The `emailConfig.automationSettings` booleans, as the form names them. */
export type AutomationSettingKey =
  | "welcomeEnabled"
  | "postOrderEnabled"
  | "birthdayEnabled"
  | "inactiveEnabled"
  | "abandonedCartEnabled"

/** One row of the "Automations" card. */
export interface AutomationControl {
  /** The trigger this switch governs, as dispatch names it. */
  trigger: AutomationTrigger
  /** The form field the switch writes. */
  key: AutomationSettingKey
  label: string
  description: string
  /** Whether the engine can dispatch this trigger today. */
  available: boolean
  /**
   * Why the switch is unavailable, in French, for the owner. Present exactly
   * when `available` is false.
   */
  unavailableReason?: string
}

/**
 * French copy, one entry per trigger.
 *
 * `unavailableReason` states the missing piece and stops there: the owner needs
 * to know the switch will not do anything, not to be sold a roadmap. The English
 * `missing` string on `TRIGGER_READINESS` is written for whoever wires the
 * trigger and is not shown here.
 *
 * The record is exhaustive over `AutomationTrigger`, so a sixth trigger will not
 * compile until someone writes its copy. The three wired triggers carry a reason
 * as well — it never renders today, and it is what would show if one of them
 * were ever un-wired.
 */
const TRIGGER_COPY: Record<
  AutomationTrigger,
  {
    key: AutomationSettingKey
    label: string
    description: string
    unavailableReason: string
  }
> = {
  welcome: {
    key: "welcomeEnabled",
    label: "Email de bienvenue",
    description: "Envoyé après la confirmation du double opt-in",
    unavailableReason: "Le déclencheur n'est pas encore raccordé.",
  },
  post_order: {
    key: "postOrderEnabled",
    label: "Email post-commande",
    description: "Envoyé 2h après une commande confirmée",
    unavailableReason: "Le déclencheur n'est pas encore raccordé.",
  },
  birthday: {
    key: "birthdayEnabled",
    label: "Email d'anniversaire",
    description: "Envoyé le jour de l'anniversaire de l'abonné",
    unavailableReason: "La date de naissance des abonnés n'est pas collectée.",
  },
  inactive: {
    key: "inactiveEnabled",
    label: "Email de réengagement",
    description: "Pour les abonnés inactifs depuis 90 jours",
    unavailableReason: "Le déclencheur n'est pas encore raccordé.",
  },
  abandoned_cart: {
    key: "abandonedCartEnabled",
    label: "Panier abandonné",
    description: "Rappel 1h après un panier non finalisé",
    unavailableReason: "Les paniers ne sont pas enregistrés côté serveur.",
  },
}

/** The order the switches appear in, unchanged from the original screen. */
const DISPLAY_ORDER: readonly AutomationTrigger[] = [
  "welcome",
  "post_order",
  "birthday",
  "inactive",
  "abandoned_cart",
]

/**
 * The switches to render, each marked with whether the engine can honour it.
 *
 * `readiness` is a parameter only so a test can ask what the screen would show
 * for a different set of wired triggers; callers pass nothing.
 */
export function automationControls(
  readiness: typeof TRIGGER_READINESS = TRIGGER_READINESS
): AutomationControl[] {
  return DISPLAY_ORDER.map((trigger) => {
    const copy = TRIGGER_COPY[trigger]
    const available = readiness[trigger].ready
    return {
      trigger,
      key: copy.key,
      label: copy.label,
      description: copy.description,
      available,
      ...(available ? {} : { unavailableReason: copy.unavailableReason }),
    }
  })
}

/** What the settings screen renders. */
export const AUTOMATION_CONTROLS: readonly AutomationControl[] =
  automationControls()

/** Toggles the engine cannot honour today. */
export const UNAVAILABLE_AUTOMATION_KEYS: readonly AutomationSettingKey[] =
  AUTOMATION_CONTROLS.filter((c) => !c.available).map((c) => c.key)

const READY_TRIGGERS: ReadonlySet<string> = new Set(
  AUTOMATION_CONTROLS.filter((c) => c.available).map((c) => c.trigger)
)

/**
 * Whether the engine can dispatch this trigger today.
 *
 * Takes a `string` because the dashboard reads `trigger` off an untyped Convex
 * document. An unrecognised value is not available — a screen should not vouch
 * for a trigger this build has never heard of.
 */
export function isTriggerAvailable(trigger: string): boolean {
  return READY_TRIGGERS.has(trigger)
}

/**
 * The automation settings as they should be stored.
 *
 * A stored `true` on a trigger the engine refuses is the same false claim the
 * screen used to make, one layer down: it survives a reload and reads as "on"
 * to anything that queries the row. Forcing those keys to `false` keeps the
 * record, the screen and `canDispatch` saying the same thing. When a trigger is
 * wired the key stops being normalised and the owner turns it on themselves.
 */
export function normalizeAutomationSettings(
  settings: Record<AutomationSettingKey, boolean>
): Record<AutomationSettingKey, boolean> {
  const normalized = { ...settings }
  for (const key of UNAVAILABLE_AUTOMATION_KEYS) {
    normalized[key] = false
  }
  return normalized
}
