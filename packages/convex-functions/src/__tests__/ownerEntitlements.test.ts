import { describe, it, expect } from "vitest"
import { PLAN_PRESETS } from "../ownerEntitlements"

// ============================================================================
// PLAN_PRESETS
// ============================================================================

describe("PLAN_PRESETS", () => {
  describe("starter", () => {
    it("should be enabled with correct quotas", () => {
      const p = PLAN_PRESETS.starter
      expect(p.enabled).toBe(true)
      expect(p.plan).toBe("starter")
      expect(p.monthlyQuota).toBe(2)
      expect(p.maxTopics).toBe(3)
      expect(p.monthlyImageQuota).toBe(5)
      expect(p.allowMultiLanguage).toBe(false)
      expect(p.allowAutoPublish).toBe(false)
    })
  })

  describe("pro", () => {
    it("should be enabled with correct quotas", () => {
      const p = PLAN_PRESETS.pro
      expect(p.enabled).toBe(true)
      expect(p.plan).toBe("pro")
      expect(p.monthlyQuota).toBe(8)
      expect(p.maxTopics).toBeUndefined()
      expect(p.monthlyImageQuota).toBe(20)
      expect(p.allowMultiLanguage).toBe(false)
      expect(p.allowAutoPublish).toBe(true)
    })
  })

  describe("enterprise", () => {
    it("should be enabled with correct quotas", () => {
      const p = PLAN_PRESETS.enterprise
      expect(p.enabled).toBe(true)
      expect(p.plan).toBe("enterprise")
      expect(p.monthlyQuota).toBe(30)
      expect(p.maxTopics).toBeUndefined()
      expect(p.monthlyImageQuota).toBe(100)
      expect(p.allowMultiLanguage).toBe(true)
      expect(p.allowAutoPublish).toBe(true)
    })
  })

  describe("disabled", () => {
    it("should be disabled with zero quotas", () => {
      const p = PLAN_PRESETS.disabled
      expect(p.enabled).toBe(false)
      expect(p.plan).toBeUndefined()
      expect(p.monthlyQuota).toBe(0)
      expect(p.monthlyImageQuota).toBe(0)
      expect(p.allowMultiLanguage).toBe(false)
      expect(p.allowAutoPublish).toBe(false)
    })
  })

  describe("plan hierarchy", () => {
    it("should have increasing monthly quotas", () => {
      expect(PLAN_PRESETS.starter.monthlyQuota).toBeLessThan(
        PLAN_PRESETS.pro.monthlyQuota
      )
      expect(PLAN_PRESETS.pro.monthlyQuota).toBeLessThan(
        PLAN_PRESETS.enterprise.monthlyQuota
      )
    })

    it("should have increasing image quotas", () => {
      expect(PLAN_PRESETS.starter.monthlyImageQuota).toBeLessThan(
        PLAN_PRESETS.pro.monthlyImageQuota
      )
      expect(PLAN_PRESETS.pro.monthlyImageQuota).toBeLessThan(
        PLAN_PRESETS.enterprise.monthlyImageQuota
      )
    })

    it("disabled should have zero for all quotas", () => {
      expect(PLAN_PRESETS.disabled.monthlyQuota).toBe(0)
      expect(PLAN_PRESETS.disabled.monthlyImageQuota).toBe(0)
    })
  })
})
