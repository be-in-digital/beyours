import { describe, expect, it } from "vitest"
import {
  TRIGGER_READINESS,
  canDispatch,
  delayForStep,
  nextStep,
  readyTriggers,
  type AutomationStep,
} from "../automationDispatch"

const step = (id: string, delayMinutes = 0): AutomationStep => ({
  id,
  delayMinutes,
  templateId: "templates:a",
})

describe("TRIGGER_READINESS", () => {
  it("admits that only one of the five triggers can fire", () => {
    // The settings screen offers five toggles. Four of them cannot reach a
    // subscriber on the current schema, and each `missing` says why. This test
    // exists so that wiring one is a deliberate edit here, not a silent drift.
    expect(readyTriggers()).toEqual(["welcome"])
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
