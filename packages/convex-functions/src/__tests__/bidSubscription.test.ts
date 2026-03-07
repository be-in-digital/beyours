import { describe, it, expect } from "vitest"
import {
  resolvePlanFromPriceId,
  buildPriceMap,
  resolvePriceIdFromPlan,
} from "../bidSubscription"

// ============================================================================
// resolvePlanFromPriceId
// ============================================================================

describe("resolvePlanFromPriceId", () => {
  const priceMap = {
    price_starter_monthly: "starter" as const,
    price_pro_monthly: "pro" as const,
    price_enterprise_monthly: "enterprise" as const,
  }

  it("should resolve starter plan", () => {
    expect(resolvePlanFromPriceId("price_starter_monthly", priceMap)).toBe(
      "starter"
    )
  })

  it("should resolve pro plan", () => {
    expect(resolvePlanFromPriceId("price_pro_monthly", priceMap)).toBe("pro")
  })

  it("should resolve enterprise plan", () => {
    expect(
      resolvePlanFromPriceId("price_enterprise_monthly", priceMap)
    ).toBe("enterprise")
  })

  it("should return undefined for unknown priceId", () => {
    expect(resolvePlanFromPriceId("price_unknown", priceMap)).toBeUndefined()
  })

  it("should return undefined for empty string", () => {
    expect(resolvePlanFromPriceId("", priceMap)).toBeUndefined()
  })
})

// ============================================================================
// buildPriceMap
// ============================================================================

describe("buildPriceMap", () => {
  it("should build map from all env vars", () => {
    const map = buildPriceMap({
      STRIPE_BID_PRICE_STARTER: "price_s_m",
      STRIPE_BID_PRICE_PRO: "price_p_m",
      STRIPE_BID_PRICE_ENTERPRISE: "price_e_m",
      STRIPE_BID_PRICE_STARTER_ANNUAL: "price_s_a",
      STRIPE_BID_PRICE_PRO_ANNUAL: "price_p_a",
      STRIPE_BID_PRICE_ENTERPRISE_ANNUAL: "price_e_a",
    })

    expect(map).toEqual({
      price_s_m: "starter",
      price_p_m: "pro",
      price_e_m: "enterprise",
      price_s_a: "starter",
      price_p_a: "pro",
      price_e_a: "enterprise",
    })
  })

  it("should handle partial env vars (monthly only)", () => {
    const map = buildPriceMap({
      STRIPE_BID_PRICE_STARTER: "price_s",
      STRIPE_BID_PRICE_PRO: "price_p",
    })

    expect(Object.keys(map)).toHaveLength(2)
    expect(map["price_s"]).toBe("starter")
    expect(map["price_p"]).toBe("pro")
  })

  it("should handle empty env vars", () => {
    const map = buildPriceMap({})
    expect(Object.keys(map)).toHaveLength(0)
  })

  it("should handle only annual prices", () => {
    const map = buildPriceMap({
      STRIPE_BID_PRICE_PRO_ANNUAL: "price_pro_yr",
    })

    expect(map["price_pro_yr"]).toBe("pro")
    expect(Object.keys(map)).toHaveLength(1)
  })
})

// ============================================================================
// resolvePriceIdFromPlan
// ============================================================================

describe("resolvePriceIdFromPlan", () => {
  const env = {
    STRIPE_BID_PRICE_STARTER: "price_s_m",
    STRIPE_BID_PRICE_PRO: "price_p_m",
    STRIPE_BID_PRICE_ENTERPRISE: "price_e_m",
    STRIPE_BID_PRICE_STARTER_ANNUAL: "price_s_a",
    STRIPE_BID_PRICE_PRO_ANNUAL: "price_p_a",
    STRIPE_BID_PRICE_ENTERPRISE_ANNUAL: "price_e_a",
  }

  it("should resolve monthly starter price", () => {
    expect(resolvePriceIdFromPlan("starter", env, "monthly")).toBe("price_s_m")
  })

  it("should resolve monthly pro price", () => {
    expect(resolvePriceIdFromPlan("pro", env, "monthly")).toBe("price_p_m")
  })

  it("should resolve monthly enterprise price", () => {
    expect(resolvePriceIdFromPlan("enterprise", env, "monthly")).toBe(
      "price_e_m"
    )
  })

  it("should resolve annual starter price", () => {
    expect(resolvePriceIdFromPlan("starter", env, "annual")).toBe("price_s_a")
  })

  it("should resolve annual pro price", () => {
    expect(resolvePriceIdFromPlan("pro", env, "annual")).toBe("price_p_a")
  })

  it("should resolve annual enterprise price", () => {
    expect(resolvePriceIdFromPlan("enterprise", env, "annual")).toBe(
      "price_e_a"
    )
  })

  it("should default to monthly when billing not specified", () => {
    expect(resolvePriceIdFromPlan("starter", env)).toBe("price_s_m")
  })

  it("should throw when monthly price is missing", () => {
    expect(() =>
      resolvePriceIdFromPlan("starter", {}, "monthly")
    ).toThrow("STRIPE_BID_PRICE_STARTER non configure")
  })

  it("should throw when annual price is missing", () => {
    expect(() =>
      resolvePriceIdFromPlan("pro", { STRIPE_BID_PRICE_PRO: "p" }, "annual")
    ).toThrow("STRIPE_BID_PRICE_PRO_ANNUAL non configure")
  })

  it("should throw with correct plan name in error (enterprise)", () => {
    expect(() =>
      resolvePriceIdFromPlan("enterprise", {}, "monthly")
    ).toThrow("STRIPE_BID_PRICE_ENTERPRISE")
  })
})
