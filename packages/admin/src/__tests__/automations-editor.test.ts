import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  DEFAULT_INACTIVE_AFTER_DAYS,
  describeDelay,
} from "../pages/email/automations/automation-vocabulary"
import { adminRoutes } from "../config/admin-routes"
import { navGroups, isCollapsible } from "../config/nav-config"
import { subTitles } from "../config/route-titles"

/**
 * The automations screen (#270).
 *
 * The card `pages/email/dashboard/` fills from `listActive` said « Aucune
 * automation active » to every owner, permanently, because nothing in the
 * product created one. Six email pages shipped and the sidebar listed the same
 * six; none of them created, edited or deleted an automation.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname)
const PAGE = path.join(HERE, "..", "pages", "email", "automations")

describe("describeDelay", () => {
  it("says the delay is measured from the trigger, every time", () => {
    /*
     * THE DEFECT THIS WORDING PREVENTS. `delayForStep` adds `step.delayMinutes`
     * to the occurrence time — the trigger — and NOT to the previous step's
     * send. An editor that read « 1 jour » as "a day after the last email" would
     * put step 3 on day four while the owner wrote J+1, and nothing in the
     * product would say which reading it used.
     */
    for (const minutes of [0, 30, 120, 24 * 60, 3 * 24 * 60]) {
      expect(describeDelay(minutes)).toContain("déclencheur")
    }
  })

  it("calls zero immediate", () => {
    expect(describeDelay(0)).toMatch(/immédiatement/)
  })

  it("reads under an hour in minutes", () => {
    expect(describeDelay(30)).toMatch(/^30 min/)
  })

  it("reads under a day in hours", () => {
    expect(describeDelay(6 * 60)).toMatch(/^6 h/)
  })

  it("reads a day or more as J+n", () => {
    expect(describeDelay(24 * 60)).toMatch(/^J\+1/)
    expect(describeDelay(3 * 24 * 60)).toMatch(/^J\+3/)
  })

  it("rounds a day down, so 36 hours is J+1", () => {
    // J+2 would claim the email lands a day later than it does.
    expect(describeDelay(36 * 60)).toMatch(/^J\+1/)
  })

  it("treats a negative delay as immediate rather than printing one", () => {
    // The mutation refuses a negative delay; this is what the screen shows if
    // one is already stored from before that guard.
    expect(describeDelay(-60)).toMatch(/immédiatement/)
  })
})

describe("the screen is reachable", () => {
  it("has a route", () => {
    expect(adminRoutes.emailAutomations).toBe("/dashboard/email/automations")
  })

  it("has a title, so the header is not blank", () => {
    expect(subTitles["email/automations"]).toBe("Automatisations")
  })

  it("is in the Email Marketing menu", () => {
    // The card that said « Aucune automation active » had no path to a first
    // one, and a page nobody can navigate to is the same thing.
    const emailEntry = navGroups
      .flatMap((group) => group.items)
      .find((entry) => isCollapsible(entry) && entry.label === "Email Marketing")
    expect(emailEntry).toBeDefined()
    const children = isCollapsible(emailEntry!) ? emailEntry!.children : []
    expect(children.map((child) => child.href)).toContain(adminRoutes.emailAutomations)
  })
})

describe("the vocabulary", () => {
  it("names all five triggers, including the two that cannot fire", () => {
    // The unready ones are OFFERED and disabled with their reason, rather than
    // hidden: an absent option leaves an owner wondering, and « aucune date de
    // naissance n'est enregistrée » tells them what would have to change.
    expect(Object.keys(AUTOMATION_TRIGGER_LABELS).sort()).toEqual([
      "abandoned_cart",
      "birthday",
      "inactive",
      "post_order",
      "welcome",
    ])
  })

  it("names all three statuses the schema allows", () => {
    for (const status of ["draft", "active", "paused"]) {
      expect(AUTOMATION_STATUS_LABELS[status]).toBeTruthy()
    }
  })

  it("carries the win-back default the sweep applies", () => {
    expect(DEFAULT_INACTIVE_AFTER_DAYS).toBe(90)
  })
})

describe("the editor's own shape", () => {
  const dialog = fs.readFileSync(path.join(PAGE, "automation-form-dialog.tsx"), "utf8")
  const list = fs.readFileSync(path.join(PAGE, "email-automations-page.tsx"), "utf8")

  it("reads the readiness from the dispatcher's own constant", () => {
    // A second list here is a second list to drift. Implement a trigger in
    // `TRIGGER_READINESS` and the picker offers it on the same commit.
    expect(dialog).toContain("TRIGGER_READINESS")
    expect(dialog).toContain("@be-in-digital/convex-functions/automationDispatch")
  })

  it("sends inactiveAfterDays only for the trigger it belongs to", () => {
    // On a welcome sequence it would store a number the sweep never reads.
    expect(dialog).toMatch(/trigger === "inactive"[\s\S]{0,120}inactiveAfterDays/)
  })

  it("surfaces the server's sentence rather than a generic failure", () => {
    // The refusals here are the useful kind: which data a trigger is missing,
    // and why a delete was refused.
    expect(dialog).toContain("convexErrorMessage")
    expect(list).toContain("convexErrorMessage")
  })

  it("does not generate a step id at random", () => {
    /* `emailAutomationRuns` dedupes on
       `(automationId, subscriberId, occurrence, stepId)`. A step id that changed
       between renders would let the same message reach the same person twice.
       Matched on a CALL rather than on the name, because the comment in the file
       explains why the call is absent — and a scan that cannot tell a mention
       from a use is the defect `onboarding-tour.test.ts` hit from the other
       side. */
    expect(dialog).not.toMatch(/Math\.random\s*\(/)
  })

  it("calls every mutation the screen needs", () => {
    for (const name of ["create", "update"]) {
      expect(dialog).toContain(`emailAutomations?.${name}`)
    }
    for (const name of ["list", "remove", "activate", "pause"]) {
      expect(list).toContain(`emailAutomations?.${name}`)
    }
  })
})
