import { describe, expect, test } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  TRIGGER_READINESS,
  TRIGGER_TOGGLE,
  canDispatch,
  type AutomationTrigger,
} from "@be-yours/convex-functions/automationDispatch"
import {
  AUTOMATION_CONTROLS,
  UNAVAILABLE_AUTOMATION_KEYS,
  automationControls,
  isTriggerAvailable,
  normalizeAutomationSettings,
  type AutomationSettingKey,
} from "../pages/email/config/automation-controls"

/**
 * The settings screen may not offer a switch the engine will refuse.
 *
 * `emailConfig` carries five `automationSettings` booleans and the screen used
 * to render five switches, all of them live. Two govern triggers
 * `automationDispatch` refuses outright: no record carries a date of birth, and
 * no cart is ever persisted. An owner switched "Email d'anniversaire" on, the
 * save succeeded, the screen said it was on, and nothing would ever send
 * (issue #166, card TECH-07).
 *
 * What matters here is not that those two triggers are unwired today — that is
 * `TRIGGER_READINESS`'s business and may change. It is that the screen and
 * `TRIGGER_READINESS` cannot drift apart: a trigger marked `ready: false` must
 * never be reachable as an enabled control, and one wired later must light up
 * without anyone editing the screen.
 */

const ALL_TRIGGERS = Object.keys(TRIGGER_READINESS) as AutomationTrigger[]

const control = (trigger: AutomationTrigger) => {
  const found = AUTOMATION_CONTROLS.find((c) => c.trigger === trigger)
  if (!found) throw new Error(`no control renders the ${trigger} trigger`)
  return found
}

describe("the automations card is derived from TRIGGER_READINESS", () => {
  test("every trigger the engine knows has exactly one switch", () => {
    expect(AUTOMATION_CONTROLS.map((c) => c.trigger).sort()).toEqual(
      [...ALL_TRIGGERS].sort()
    )
  })

  test("each switch writes the toggle dispatch reads", () => {
    for (const c of AUTOMATION_CONTROLS) {
      expect(c.key).toBe(TRIGGER_TOGGLE[c.trigger])
    }
  })

  test.each(ALL_TRIGGERS)(
    "%s is offered as an enabled control only if the engine can dispatch it",
    (trigger) => {
      expect(control(trigger).available).toBe(TRIGGER_READINESS[trigger].ready)
    }
  )

  test("an unavailable switch says why, in French, and an available one does not", () => {
    for (const c of AUTOMATION_CONTROLS) {
      if (c.available) {
        expect(c.unavailableReason).toBeUndefined()
      } else {
        expect(c.unavailableReason ?? "").not.toHaveLength(0)
      }
    }
  })

  test("wiring a trigger re-enables its switch with no edit to this screen", () => {
    const allWired = Object.fromEntries(
      ALL_TRIGGERS.map((t) => [t, { ready: true }])
    ) as typeof TRIGGER_READINESS

    for (const c of automationControls(allWired)) {
      expect(c.available).toBe(true)
      expect(c.unavailableReason).toBeUndefined()
    }
  })

  test("unwiring a trigger disables its switch with no edit to this screen", () => {
    const noneWired = Object.fromEntries(
      ALL_TRIGGERS.map((t) => [t, { ready: false, missing: "under construction" }])
    ) as typeof TRIGGER_READINESS

    for (const c of automationControls(noneWired)) {
      expect(c.available).toBe(false)
      expect(c.unavailableReason ?? "").not.toHaveLength(0)
    }
  })

  test("isTriggerAvailable agrees with the engine, and refuses what it does not know", () => {
    for (const trigger of ALL_TRIGGERS) {
      expect(isTriggerAvailable(trigger)).toBe(TRIGGER_READINESS[trigger].ready)
    }
    expect(isTriggerAvailable("loyalty_milestone")).toBe(false)
  })
})

describe("what the screen offers, the engine can honour", () => {
  const withSteps = (trigger: AutomationTrigger) => ({
    trigger,
    status: "active" as const,
    steps: [{ id: "s1", delayMinutes: 0, templateId: "t1" }],
  })

  test("every enabled switch governs a trigger canDispatch accepts", () => {
    for (const c of AUTOMATION_CONTROLS.filter((x) => x.available)) {
      expect(canDispatch(withSteps(c.trigger), { [c.key]: true })).toBe(true)
    }
  })

  test("no disabled switch hides a trigger canDispatch would have accepted", () => {
    for (const c of AUTOMATION_CONTROLS.filter((x) => !x.available)) {
      expect(canDispatch(withSteps(c.trigger), { [c.key]: true })).toBe(false)
    }
  })
})

describe("what is stored matches what is shown", () => {
  const allOn: Record<AutomationSettingKey, boolean> = {
    welcomeEnabled: true,
    postOrderEnabled: true,
    birthdayEnabled: true,
    inactiveEnabled: true,
    abandonedCartEnabled: true,
  }

  test("a toggle the engine refuses is never saved as on", () => {
    const stored = normalizeAutomationSettings(allOn)
    for (const key of UNAVAILABLE_AUTOMATION_KEYS) {
      expect(stored[key]).toBe(false)
    }
  })

  test("a toggle the engine honours is left alone", () => {
    const stored = normalizeAutomationSettings(allOn)
    for (const c of AUTOMATION_CONTROLS.filter((x) => x.available)) {
      expect(stored[c.key]).toBe(true)
    }
  })

  test("normalising does not mutate the caller's object", () => {
    const input = { ...allOn }
    normalizeAutomationSettings(input)
    expect(input).toEqual(allOn)
  })
})

/**
 * Source with its comments stripped.
 *
 * Every file here explains itself, and a toggle key named in a comment would
 * fail the assertion below on prose rather than on code.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

/**
 * Asserted against the source, like `contact-messages-screen.test.ts`: what
 * regressed here is a rendering decision, and `packages/admin` has no DOM test
 * environment. The checks are deliberately about *where the screen gets its
 * answer from* — a re-introduced hard-coded list is exactly the regression.
 */
describe("the screens read readiness rather than restating it", () => {
  const source = (...segments: string[]) =>
    readFileSync(join(__dirname, "..", "pages", "email", ...segments), "utf8")

  const configPage = source("config", "email-config-page.tsx")
  const dashboardPage = source("dashboard", "email-dashboard-page.tsx")

  test("the settings screen renders the derived control list", () => {
    expect(configPage).toMatch(/AUTOMATION_CONTROLS\.map\(/)
    expect(configPage).toMatch(/from "\.\/automation-controls"/)
  })

  test("the settings screen disables the switch it may not offer", () => {
    expect(configPage).toMatch(/<Switch[^>]*\sdisabled=\{!available\}/)
  })

  test("the settings screen never saves a toggle it did not offer", () => {
    expect(configPage).toMatch(/normalizeAutomationSettings\(/)
  })

  test("the dashboard marks an active automation that cannot fire", () => {
    expect(dashboardPage).toMatch(/isTriggerAvailable\(/)
  })

  test("no screen hard-codes an automation toggle key", () => {
    for (const page of [configPage, dashboardPage]) {
      for (const key of Object.values(TRIGGER_TOGGLE)) {
        expect(code(page)).not.toContain(`"${key}"`)
      }
    }
  })
})

