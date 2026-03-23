import { describe, it, expect } from "vitest"
import { PLAN_PRESETS } from "../ownerEntitlements"

// ============================================================================
// PLAN_PRESETS
// ============================================================================

describe("PLAN_PRESETS", () => {
  describe("starter", () => {
    it("should have correct autoBlog quotas", () => {
      const p = PLAN_PRESETS.starter.autoBlog
      expect(p.enabled).toBe(true)
      expect(p.plan).toBe("starter")
      expect(p.monthlyQuota).toBe(2)
      expect(p.maxTopics).toBe(3)
      expect(p.monthlyImageQuota).toBe(5)
      expect(p.allowMultiLanguage).toBe(false)
      expect(p.allowAutoPublish).toBe(false)
    })

    it("should have correct imageToProduct quotas", () => {
      const p = PLAN_PRESETS.starter.imageToProduct
      expect(p.enabled).toBe(true)
      expect(p.monthlyAnalysisQuota).toBe(3)
    })
  })

  describe("pro", () => {
    it("should have correct autoBlog quotas", () => {
      const p = PLAN_PRESETS.pro.autoBlog
      expect(p.enabled).toBe(true)
      expect(p.plan).toBe("pro")
      expect(p.monthlyQuota).toBe(8)
      expect(p.maxTopics).toBeUndefined()
      expect(p.monthlyImageQuota).toBe(20)
      expect(p.allowMultiLanguage).toBe(false)
      expect(p.allowAutoPublish).toBe(true)
    })

    it("should have correct imageToProduct quotas", () => {
      const p = PLAN_PRESETS.pro.imageToProduct
      expect(p.enabled).toBe(true)
      expect(p.monthlyAnalysisQuota).toBe(15)
    })
  })

  describe("enterprise", () => {
    it("should have correct autoBlog quotas", () => {
      const p = PLAN_PRESETS.enterprise.autoBlog
      expect(p.enabled).toBe(true)
      expect(p.plan).toBe("enterprise")
      expect(p.monthlyQuota).toBe(30)
      expect(p.maxTopics).toBeUndefined()
      expect(p.monthlyImageQuota).toBe(100)
      expect(p.allowMultiLanguage).toBe(true)
      expect(p.allowAutoPublish).toBe(true)
    })

    it("should have correct imageToProduct quotas", () => {
      const p = PLAN_PRESETS.enterprise.imageToProduct
      expect(p.enabled).toBe(true)
      expect(p.monthlyAnalysisQuota).toBe(50)
    })
  })

  describe("disabled", () => {
    it("should be disabled with zero quotas", () => {
      const ab = PLAN_PRESETS.disabled.autoBlog
      expect(ab.enabled).toBe(false)
      expect(ab.plan).toBeUndefined()
      expect(ab.monthlyQuota).toBe(0)
      expect(ab.monthlyImageQuota).toBe(0)
      expect(ab.allowMultiLanguage).toBe(false)
      expect(ab.allowAutoPublish).toBe(false)

      const itp = PLAN_PRESETS.disabled.imageToProduct
      expect(itp.enabled).toBe(false)
      expect(itp.monthlyAnalysisQuota).toBe(0)
    })
  })

  describe("plan hierarchy", () => {
    it("should have increasing autoBlog monthly quotas", () => {
      expect(PLAN_PRESETS.starter.autoBlog.monthlyQuota).toBeLessThan(
        PLAN_PRESETS.pro.autoBlog.monthlyQuota
      )
      expect(PLAN_PRESETS.pro.autoBlog.monthlyQuota).toBeLessThan(
        PLAN_PRESETS.enterprise.autoBlog.monthlyQuota
      )
    })

    it("should have increasing autoBlog image quotas", () => {
      expect(PLAN_PRESETS.starter.autoBlog.monthlyImageQuota).toBeLessThan(
        PLAN_PRESETS.pro.autoBlog.monthlyImageQuota
      )
      expect(PLAN_PRESETS.pro.autoBlog.monthlyImageQuota).toBeLessThan(
        PLAN_PRESETS.enterprise.autoBlog.monthlyImageQuota
      )
    })

    it("should have increasing imageToProduct analysis quotas", () => {
      expect(PLAN_PRESETS.starter.imageToProduct.monthlyAnalysisQuota).toBeLessThan(
        PLAN_PRESETS.pro.imageToProduct.monthlyAnalysisQuota
      )
      expect(PLAN_PRESETS.pro.imageToProduct.monthlyAnalysisQuota).toBeLessThan(
        PLAN_PRESETS.enterprise.imageToProduct.monthlyAnalysisQuota
      )
    })

    it("disabled should have zero for all quotas", () => {
      expect(PLAN_PRESETS.disabled.autoBlog.monthlyQuota).toBe(0)
      expect(PLAN_PRESETS.disabled.autoBlog.monthlyImageQuota).toBe(0)
      expect(PLAN_PRESETS.disabled.imageToProduct.monthlyAnalysisQuota).toBe(0)
    })
  })
})
