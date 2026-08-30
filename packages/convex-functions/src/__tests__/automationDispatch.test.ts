import { describe, expect, it } from "vitest"
import {
  DEFAULT_INACTIVE_AFTER_DAYS,
  TRIGGER_READINESS,
  canDispatch,
  delayForStep,
  isLapsed,
  nextStep,
  occurrenceFor,
  readyTriggers,
  type AutomationStep,
} from "../automationDispatch"

const step = (id: string, delayMinutes = 0): AutomationStep => ({
  id,
  delayMinutes,
  templateId: "templates:a",
})

describe("TRIGGER_READINESS", () => {
  it("names exactly the triggers that can reach a subscriber", () => {
    // The settings screen offers five toggles. Two of them still cannot reach
    // anyone — no record carries a date of birth, and no cart is ever
    // persisted — and each `missing` says why. This test exists so that wiring
    // one is a deliberate edit here, not a silent drift.
    expect(readyTriggers().sort()).toEqual(["inactive", "post_order", "welcome"])
  })

  it("gives a reason for every trigger it refuses", () => {
    for (const [trigger, readiness] of Object.entries(TRIGGER_READINESS)) {
      if (!readiness.ready) {
        expect(readiness.missing, `${trigger} must say what is missing`).toBeTruthy()
      }
    }
  })
})

describe("canDispatch", () => {
  it("runs an active automation on a wired trigger", () => {
    expect(
      canDispatch({ trigger: "welcome", status: "active", steps: [step("s1")] })
    ).toBe(true)
  })

  it("refuses anything not active", () => {
    for (const status of ["draft", "paused"] as const) {
      expect(canDispatch({ trigger: "welcome", status, steps: [step("s1")] })).toBe(
        false
      )
    }
  })

  it("refuses a trigger nothing can fire", () => {
    // Not the automation's fault, and the reason it matters: starting it would
    // mean a sequence sitting at step one for good, looking live.
    expect(
      canDispatch({ trigger: "birthday", status: "active", steps: [step("s1")] })
    ).toBe(false)
  })

  it("obeys the settings toggle for its trigger", () => {
    const automation = {
      trigger: "post_order" as const,
      status: "active" as const,
      steps: [step("s1")],
    }
    // Five switches in the settings screen, and until now not one was read
    // anywhere: turning "Post-commande" off stored a boolean and nothing else.
    expect(canDispatch(automation, { postOrderEnabled: false })).toBe(false)
    expect(canDispatch(automation, { postOrderEnabled: true })).toBe(true)
    // A different trigger's switch is not this one's business.
    expect(canDispatch(automation, { welcomeEnabled: false })).toBe(true)
  })

  it("treats absent settings as permission, not refusal", () => {
    // A caller with no config in hand should not silently stop every
    // automation in the deployment.
    expect(
      canDispatch({ trigger: "welcome", status: "active", steps: [step("s1")] }, null)
    ).toBe(true)
  })

  it("refuses a sequence with no steps", () => {
    expect(canDispatch({ trigger: "welcome", status: "active", steps: [] })).toBe(false)
  })
})

describe("nextStep", () => {
  const steps = [step("s1"), step("s2", 1440), step("s3", 4320)]

  it("starts at the first step", () => {
    expect(nextStep(steps, [])?.id).toBe("s1")
  })

  it("continues after what has already been sent", () => {
    expect(nextStep(steps, ["s1"])?.id).toBe("s2")
    expect(nextStep(steps, ["s1", "s2"])?.id).toBe("s3")
  })

  it("never repeats a step, whatever order the record arrives in", () => {
    // The record is what makes a retried or re-entered automation safe.
    expect(nextStep(steps, ["s2", "s1"])?.id).toBe("s3")
  })

  it("ends the sequence when every step has gone", () => {
    expect(nextStep(steps, ["s1", "s2", "s3"])).toBeNull()
  })

  it("keeps the owner's order rather than the delay order", () => {
    const outOfOrder = [step("late", 4320), step("early", 0)]
    expect(nextStep(outOfOrder, [])?.id).toBe("late")
  })
})

describe("delayForStep", () => {
  const T = 1_700_000_000_000

  it("counts the delay from the trigger, not from the step before", () => {
    // The admin says "J+1", "J+3". Chaining each step off the previous one
    // would drift by however long the earlier sends took.
    expect(delayForStep(step("s2", 1440), T, T)).toBe(1440 * 60_000)
    expect(delayForStep(step("s3", 4320), T, T)).toBe(4320 * 60_000)
  })

  it("subtracts the time already elapsed", () => {
    const anHourIn = T + 60 * 60_000
    expect(delayForStep(step("s2", 1440), T, anHourIn)).toBe((1440 - 60) * 60_000)
  })

  it("sends immediately rather than into the past", () => {
    const lateByADay = T + 2880 * 60_000
    expect(delayForStep(step("s2", 1440), T, lateByADay)).toBe(0)
    expect(delayForStep(step("s1", 0), T, T)).toBe(0)
  })
})

const DAY = 24 * 60 * 60 * 1000

describe("isLapsed", () => {
  const T = 1_700_000_000_000

  it("is true once the customer has been away long enough", () => {
    const sub = { metadata: { lastOrderAt: T - 91 * DAY } }
    expect(isLapsed(sub, 90, T)).toBe(true)
  })

  it("is false for someone who ordered recently", () => {
    expect(isLapsed({ metadata: { lastOrderAt: T - 10 * DAY } }, 90, T)).toBe(false)
  })

  it("counts the boundary day as lapsed", () => {
    expect(isLapsed({ metadata: { lastOrderAt: T - 90 * DAY } }, 90, T)).toBe(true)
  })

  it("never calls someone lapsed who has never ordered", () => {
    // "Come back, we miss you" to a person who has never been is how a sender
    // gets reported. An absent `lastOrderAt` is exactly that case.
    expect(isLapsed({ metadata: {} }, 90, T)).toBe(false)
    expect(isLapsed({}, 90, T)).toBe(false)
  })

  it("honours a threshold the automation chose", () => {
    const sub = { metadata: { lastOrderAt: T - 40 * DAY } }
    expect(isLapsed(sub, 30, T)).toBe(true)
    expect(isLapsed(sub, DEFAULT_INACTIVE_AFTER_DAYS, T)).toBe(false)
  })
})

describe("occurrenceFor", () => {
  it("gives a post-order sequence the order it follows", () => {
    // Without this the run record would key on the step alone, and a customer
    // would be thanked for their first order and never again.
    expect(occurrenceFor("post_order", { orderId: "orders:1" })).toBe("orders:1")
    expect(occurrenceFor("post_order", { orderId: "orders:2" })).toBe("orders:2")
  })

  it("gives a win-back the order the customer lapsed after", () => {
    // Stable while they stay away, so the sequence does not repeat; different
    // once they order again, so a later lapse can be won back too.
    const first = occurrenceFor("inactive", { lastOrderAt: 1_000 })
    expect(occurrenceFor("inactive", { lastOrderAt: 1_000 })).toBe(first)
    expect(occurrenceFor("inactive", { lastOrderAt: 2_000 })).not.toBe(first)
  })

  it("gives a welcome none — it happens once per person", () => {
    expect(occurrenceFor("welcome", {})).toBeUndefined()
  })

  it("gives none when there is nothing to key on", () => {
    expect(occurrenceFor("post_order", {})).toBeUndefined()
    expect(occurrenceFor("inactive", {})).toBeUndefined()
  })
})
