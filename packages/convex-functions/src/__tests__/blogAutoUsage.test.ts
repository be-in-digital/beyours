import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getCurrentPeriodKey } from "../blogAutoUsage"

describe("getCurrentPeriodKey", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should return YYYY-MM format", () => {
    vi.setSystemTime(new Date(2026, 2, 15)) // March 2026
    expect(getCurrentPeriodKey()).toBe("2026-03")
  })

  it("should pad single-digit month with zero", () => {
    vi.setSystemTime(new Date(2026, 0, 1)) // January 2026
    expect(getCurrentPeriodKey()).toBe("2026-01")
  })

  it("should handle December correctly", () => {
    vi.setSystemTime(new Date(2026, 11, 31)) // December 2026
    expect(getCurrentPeriodKey()).toBe("2026-12")
  })

  it("should handle year boundary", () => {
    vi.setSystemTime(new Date(2027, 0, 1)) // January 2027
    expect(getCurrentPeriodKey()).toBe("2027-01")
  })

  it("should match regex YYYY-MM", () => {
    expect(getCurrentPeriodKey()).toMatch(/^\d{4}-\d{2}$/)
  })
})
