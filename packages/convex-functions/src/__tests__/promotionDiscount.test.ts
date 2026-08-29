import { describe, it, expect } from "vitest"
import {
  resolvePromotionDiscount,
  PromotionRejectedError,
  type PromotionForDiscount,
} from "../promotionDiscount"

const NOW = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

function promo(overrides: Partial<PromotionForDiscount> = {}): PromotionForDiscount {
  return {
    _id: "promotions:1",
    storeId: "stores:1",
    isActive: true,
    startDate: NOW - DAY,
    endDate: NOW + DAY,
    discountType: "percentage",
    discountValue: 10,
    usageCount: 0,
    ...overrides,
  }
}

function resolve(
  promotion: PromotionForDiscount,
  over: Partial<Parameters<typeof resolvePromotionDiscount>[0]> = {}
) {
  return resolvePromotionDiscount({
    promotion,
    storeId: "stores:1",
    subtotal: 10_000,
    deliveryFee: 0,
    now: NOW,
    ...over,
  })
}

function rejection(fn: () => unknown): PromotionRejectedError {
  try {
    fn()
  } catch (error) {
    if (error instanceof PromotionRejectedError) return error
    throw error
  }
  throw new Error("expected the promotion to be rejected, but it resolved")
}

// ============================================================================
// Tenant boundary
// ============================================================================

describe("tenant boundary", () => {
  it("rejects a promotion belonging to another store", () => {
    const error = rejection(() =>
      resolve(promo({ storeId: "stores:999" }), { storeId: "stores:1" })
    )
    expect(error.reason).toBe("wrong_store")
  })

  it("accepts a promotion from the matching store", () => {
    expect(resolve(promo()).discount).toBe(1_000)
  })
})

// ============================================================================
// Eligibility windows and caps
// ============================================================================

describe("eligibility", () => {
  it("rejects an inactive promotion", () => {
    expect(rejection(() => resolve(promo({ isActive: false }))).reason).toBe("inactive")
  })

  it("rejects a promotion whose window has not opened", () => {
    expect(rejection(() => resolve(promo({ startDate: NOW + DAY }))).reason).toBe(
      "not_started"
    )
  })

  it("rejects an expired promotion", () => {
    expect(rejection(() => resolve(promo({ endDate: NOW - 1 }))).reason).toBe("expired")
  })

  it("accepts a promotion on its exact boundaries", () => {
    expect(resolve(promo({ startDate: NOW, endDate: NOW })).discount).toBe(1_000)
  })

  it("rejects once the global usage cap is reached", () => {
    const error = rejection(() =>
      resolve(promo({ maxTotalUsage: 5, usageCount: 5 }))
    )
    expect(error.reason).toBe("total_usage_exceeded")
  })

  it("still accepts one use below the global cap", () => {
    expect(resolve(promo({ maxTotalUsage: 5, usageCount: 4 })).discount).toBe(1_000)
  })

  it("rejects once this customer reached their personal cap", () => {
    const error = rejection(() =>
      resolve(promo({ maxUsagePerCustomer: 1 }), { customerUsageCount: 1 })
    )
    expect(error.reason).toBe("customer_usage_exceeded")
  })

  it("treats a missing customer usage count as zero", () => {
    expect(resolve(promo({ maxUsagePerCustomer: 1 })).discount).toBe(1_000)
  })

  it("refuses a per-customer cap on an anonymous order", () => {
    // `customerInfo.email` is optional, so counting an unidentified customer as
    // "never used it" would make the cap bypassable by omitting one field.
    const error = rejection(() =>
      resolve(promo({ maxUsagePerCustomer: 1 }), { customerIdentified: false })
    )
    expect(error.reason).toBe("customer_unidentified")
  })

  it("still allows an anonymous order on an uncapped promotion", () => {
    expect(resolve(promo(), { customerIdentified: false }).discount).toBe(1_000)
  })

  it("rejects when the order is below the minimum", () => {
    const error = rejection(() =>
      resolve(promo({ minimumOrderAmount: 20_000 }), { subtotal: 19_999 })
    )
    expect(error.reason).toBe("minimum_not_met")
  })

  it("accepts an order exactly on the minimum", () => {
    expect(
      resolve(promo({ minimumOrderAmount: 20_000 }), { subtotal: 20_000 }).discount
    ).toBe(2_000)
  })
})

// ============================================================================
// Discount arithmetic
// ============================================================================

describe("percentage discounts", () => {
  it("applies the rate to the subtotal only, not to tax or delivery", () => {
    const result = resolve(promo({ discountValue: 10 }), {
      subtotal: 10_000,
      deliveryFee: 500,
    })
    expect(result.discount).toBe(1_000)
  })

  it("honours the maximum discount cap", () => {
    const result = resolve(
      promo({ discountValue: 50, maxDiscountAmount: 1_500 }),
      { subtotal: 10_000 }
    )
    expect(result.discount).toBe(1_500)
  })

  it("rounds to the nearest cent", () => {
    // 3333 * 15% = 499.95
    expect(resolve(promo({ discountValue: 15 }), { subtotal: 3_333 }).discount).toBe(500)
  })

  it("rejects a zero or negative rate rather than granting nothing silently", () => {
    expect(rejection(() => resolve(promo({ discountValue: 0 }))).reason).toBe(
      "not_applicable"
    )
  })
})

describe("fixed amount discounts", () => {
  it("grants the stored amount", () => {
    const result = resolve(promo({ discountType: "fixed_amount", discountValue: 250 }))
    expect(result.discount).toBe(250)
  })

  it("rejects a zero amount", () => {
    const error = rejection(() =>
      resolve(promo({ discountType: "fixed_amount", discountValue: 0 }))
    )
    expect(error.reason).toBe("not_applicable")
  })
})

describe("free delivery", () => {
  it("discounts exactly the delivery fee and flags the waiver", () => {
    const result = resolve(promo({ discountType: "free_delivery" }), {
      deliveryFee: 490,
    })
    expect(result).toEqual({ discount: 490, freeDelivery: true })
  })

  it("grants nothing on a pickup order, where there is no fee to waive", () => {
    const result = resolve(promo({ discountType: "free_delivery" }), {
      deliveryFee: 0,
    })
    expect(result).toEqual({ discount: 0, freeDelivery: true })
  })
})

describe("item-altering promotions", () => {
  it.each(["free_product", "bogo"] as const)(
    "rejects %s rather than inventing a rebate",
    (discountType) => {
      expect(rejection(() => resolve(promo({ discountType }))).reason).toBe(
        "not_applicable"
      )
    }
  )
})

// ============================================================================
// The regression this module exists for
// ============================================================================

describe("discount can never exceed the order", () => {
  it("caps a fixed amount larger than the order at the order total", () => {
    const result = resolve(
      promo({ discountType: "fixed_amount", discountValue: 99_999_999 }),
      { subtotal: 10_000, taxAmount: 1_000, deliveryFee: 500 }
    )
    // Goods plus delivery. Since #127 the tax is *inside* the subtotal, so
    // adding it to the cap would let a discount exceed what is owed.
    expect(result.discount).toBe(10_500)
  })

  it("never returns a negative discount", () => {
    const result = resolve(
      promo({ discountType: "fixed_amount", discountValue: 1 }),
      { subtotal: 0, taxAmount: 0, deliveryFee: 0 }
    )
    expect(result.discount).toBe(0)
  })

  it("ignores any amount a caller smuggles alongside the real inputs", () => {
    // The historic exploit was `orders.create({ discountAmount: 99999999 })`.
    // The resolver derives everything from the stored promotion, so an extra
    // field on the params object must change nothing. This pins that contract
    // so it cannot be quietly reintroduced.
    const honest = resolve(promo({ discountValue: 10 }), { subtotal: 10_000 })
    const smuggled = resolvePromotionDiscount({
      promotion: promo({ discountValue: 10 }),
      storeId: "stores:1",
      subtotal: 10_000,
      deliveryFee: 0,
      now: NOW,
      discountAmount: 99_999_999,
    } as never)

    expect(smuggled).toEqual(honest)
    expect(smuggled.discount).toBe(1_000)
  })
})

/**
 * Everything a promotion is configured with and nothing read it.
 */
describe("what a promotion actually reaches", () => {
  const pizza = { productId: "products:pizza", categoryId: "categories:pizzas", subtotal: 1_200 }
  const drinks = { productId: "products:cola", categoryId: "categories:drinks", subtotal: 2_400 }

  it("discounts only the products it names", () => {
    // The reported case: −20 % on pizzas over 1 pizza (12 €) and 8 drinks
    // (24 €) took 7,20 € off instead of 2,40 €.
    const result = resolve(
      promo({
        discountType: "percentage",
        discountValue: 20,
        scope: "product",
        targetProductIds: ["products:pizza"],
      }),
      { subtotal: 3_600, items: [pizza, drinks] }
    )
    expect(result.discount).toBe(240)
  })

  it("discounts only the categories it names", () => {
    const result = resolve(
      promo({
        discountType: "percentage",
        discountValue: 50,
        scope: "category",
        targetCategoryIds: ["categories:drinks"],
      }),
      { subtotal: 3_600, items: [pizza, drinks] }
    )
    expect(result.discount).toBe(1_200)
  })

  it("still discounts the whole basket when scoped to the order", () => {
    const result = resolve(
      promo({ discountType: "percentage", discountValue: 20, scope: "order" }),
      { subtotal: 3_600, items: [pizza, drinks] }
    )
    expect(result.discount).toBe(720)
  })

  it("refuses when the basket holds none of what it names", () => {
    expect(
      rejection(() =>
        resolve(
          promo({
            scope: "product",
            targetProductIds: ["products:dessert"],
          }),
          { subtotal: 3_600, items: [pizza, drinks] }
        )
      ).reason
    ).toBe("no_eligible_items")
  })

  it("refuses a scoped promotion when the caller cannot say what is in the basket", () => {
    // Without the lines, discounting by product would fall on the whole
    // basket — which is the bug, not a fallback.
    expect(
      rejection(() =>
        resolve(
          promo({ scope: "product", targetProductIds: ["products:pizza"] }),
          { subtotal: 3_600 }
        )
      ).reason
    ).toBe("no_eligible_items")
  })

  it("caps a scoped fixed amount at what it applies to", () => {
    const result = resolve(
      promo({
        discountType: "fixed_amount",
        discountValue: 5_000,
        scope: "category",
        targetCategoryIds: ["categories:drinks"],
      }),
      { subtotal: 3_600, items: [pizza, drinks] }
    )
    expect(result.discount).toBe(2_400)
  })
})

describe("happy hour", () => {
  // Tuesday 3 July 2029, 12:00 UTC — 14:00 in Paris.
  const NOON_UTC = Date.UTC(2029, 6, 3, 12, 0, 0)
  const happyHour = {
    activeDays: [1, 2, 3, 4, 5],
    activeTimeFrom: "17:00",
    activeTimeTo: "19:00",
  }

  /** Valid all summer, so only the hours decide. */
  const running = (scheduling?: typeof happyHour) =>
    promo({
      scheduling,
      startDate: Date.UTC(2029, 5, 1),
      endDate: Date.UTC(2029, 7, 31),
    })

  it("refuses outside its hours", () => {
    expect(
      rejection(() =>
        resolve(running(happyHour), {
          now: NOON_UTC,
          timezone: "Europe/Paris",
        })
      ).reason
    ).toBe("not_scheduled")
  })

  it("applies inside them", () => {
    // 16:00 UTC is 18:00 in Paris in July.
    const result = resolve(running(happyHour), {
      now: Date.UTC(2029, 6, 3, 16, 0, 0),
      timezone: "Europe/Paris",
    })
    expect(result.discount).toBe(1_000)
  })

  it("is read on the restaurant's clock, not the server's", () => {
    // 16:00 is inside 17:00–19:00 nowhere but in a timezone ahead of UTC. On
    // the server's own clock this promotion would be refused.
    const at16UTC = Date.UTC(2029, 6, 3, 16, 0, 0)
    expect(
      rejection(() =>
        resolve(running(happyHour), { now: at16UTC, timezone: "UTC" })
      ).reason
    ).toBe("not_scheduled")
  })

  it("refuses on a day it does not run", () => {
    // 1 July 2029 is a Sunday, at 18:00 Paris.
    expect(
      rejection(() =>
        resolve(running(happyHour), {
          now: Date.UTC(2029, 6, 1, 16, 0, 0),
          timezone: "Europe/Paris",
        })
      ).reason
    ).toBe("not_scheduled")
  })

  it("applies at any hour when no schedule is configured", () => {
    const result = resolve(running(), { now: NOON_UTC, timezone: "Europe/Paris" })
    expect(result.discount).toBe(1_000)
  })
})

