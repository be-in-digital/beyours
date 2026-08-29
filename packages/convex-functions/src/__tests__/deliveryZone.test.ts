import { describe, it, expect } from "vitest"
import {
  assertMeetsMinimum,
  assertWithinDeliveryRadius,
  distanceInKm,
  OrderZoneRejectedError,
} from "../deliveryZone"

function reasonOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof OrderZoneRejectedError) return error.reason
    throw error
  }
  throw new Error("expected a rejection, got none")
}

/** Place de la Bastille and the Arc de Triomphe: 5,9 km apart. */
const BASTILLE = { latitude: 48.8532, longitude: 2.3692 }
const ETOILE = { latitude: 48.8738, longitude: 2.295 }

describe("distanceInKm", () => {
  it("measures across Paris", () => {
    expect(Math.round(distanceInKm(BASTILLE, ETOILE) * 10) / 10).toBe(5.9)
  })

  it("is zero at the same point", () => {
    expect(distanceInKm(BASTILLE, BASTILLE)).toBe(0)
  })
})

describe("the minimum order amount", () => {
  it("refuses an order below it", () => {
    // The reported case: 3,30 € against a 15 € minimum.
    expect(
      reasonOf(() => assertMeetsMinimum({ subtotal: 330, minimumOrderAmount: 1_500 }))
    ).toBe("below_minimum")
  })

  it("names the amount the customer has to reach", () => {
    try {
      assertMeetsMinimum({ subtotal: 330, minimumOrderAmount: 1_500 })
      throw new Error("expected a rejection")
    } catch (error) {
      expect((error as Error).message).toContain("15,00 €")
    }
  })

  it("accepts an order exactly at it", () => {
    expect(() =>
      assertMeetsMinimum({ subtotal: 1_500, minimumOrderAmount: 1_500 })
    ).not.toThrow()
  })

  it("does nothing when no minimum is configured", () => {
    expect(() => assertMeetsMinimum({ subtotal: 1 })).not.toThrow()
    expect(() =>
      assertMeetsMinimum({ subtotal: 1, minimumOrderAmount: 0 })
    ).not.toThrow()
  })
})

describe("the delivery radius", () => {
  it("refuses an address beyond it", () => {
    expect(
      reasonOf(() =>
        assertWithinDeliveryRadius({
          radiusKm: 3,
          store: BASTILLE,
          dropoff: ETOILE,
        })
      )
    ).toBe("outside_radius")
  })

  it("accepts one inside it", () => {
    expect(() =>
      assertWithinDeliveryRadius({ radiusKm: 10, store: BASTILLE, dropoff: ETOILE })
    ).not.toThrow()
  })

  it("refuses an address that was never located", () => {
    // A saved address with no geocode is exactly how a forty-kilometre delivery
    // slips past a radius check.
    expect(
      reasonOf(() =>
        assertWithinDeliveryRadius({ radiusKm: 3, store: BASTILLE, dropoff: {} })
      )
    ).toBe("not_located")
  })

  it("stays out of the way when no radius is configured", () => {
    expect(() =>
      assertWithinDeliveryRadius({ store: BASTILLE, dropoff: {} })
    ).not.toThrow()
  })

  it("stays out of the way when the establishment itself has no coordinates", () => {
    // The owner never geocoded their own address. That is their gap to close,
    // not a reason to refuse a customer.
    expect(() =>
      assertWithinDeliveryRadius({ radiusKm: 3, store: {}, dropoff: ETOILE })
    ).not.toThrow()
  })
})
