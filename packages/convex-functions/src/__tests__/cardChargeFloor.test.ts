import { describe, it, expect } from "vitest"
import {
  assertCardChargeable,
  cardMinimumFor,
  isCardChargeable,
  CardAmountRefusedError,
  DEFAULT_CARD_MINIMUM,
} from "../cardChargeFloor"

describe("cardMinimumFor", () => {
  it("knows Stripe's published floors", () => {
    expect(cardMinimumFor("EUR")).toBe(50)
    expect(cardMinimumFor("GBP")).toBe(30)
    expect(cardMinimumFor("SEK")).toBe(300)
  })

  it("does not care how the code is cased", () => {
    expect(cardMinimumFor("eur")).toBe(50)
  })

  it("falls back for a currency it has not been told about", () => {
    expect(cardMinimumFor("XYZ")).toBe(DEFAULT_CARD_MINIMUM)
    expect(cardMinimumFor(undefined)).toBe(DEFAULT_CARD_MINIMUM)
    expect(cardMinimumFor(null)).toBe(DEFAULT_CARD_MINIMUM)
  })
})

describe("assertCardChargeable", () => {
  it("passes an ordinary order", () => {
    expect(() =>
      assertCardChargeable({ amountMinor: 1_850, currency: "EUR" })
    ).not.toThrow()
  })

  it("passes exactly at the floor", () => {
    expect(() =>
      assertCardChargeable({ amountMinor: 50, currency: "EUR" })
    ).not.toThrow()
  })

  it("refuses a free order as its own case, not as a small one", () => {
    // A 100 % coupon. There is no charge to route anywhere, so the sentence
    // must not tell the diner to try a different card.
    try {
      assertCardChargeable({ amountMinor: 0, currency: "EUR" })
      throw new Error("expected a refusal")
    } catch (error) {
      expect(error).toBeInstanceOf(CardAmountRefusedError)
      expect((error as CardAmountRefusedError).reason).toBe("nothing_to_pay")
      expect((error as CardAmountRefusedError).message).toMatch(/ne coûte rien/)
    }
  })

  it("refuses an amount under the provider's floor, and says the floor", () => {
    try {
      assertCardChargeable({ amountMinor: 30, currency: "EUR" })
      throw new Error("expected a refusal")
    } catch (error) {
      expect(error).toBeInstanceOf(CardAmountRefusedError)
      const refusal = error as CardAmountRefusedError
      expect(refusal.reason).toBe("below_provider_minimum")
      // The diner reads a sentence, not "Server Error": the whole point of it
      // being a ConvexError.
      expect(refusal.message).toMatch(/0,50/)
      expect(refusal.data.minimum).toBe(50)
    }
  })

  it("refuses a negative or non-finite total rather than sending it", () => {
    expect(() => assertCardChargeable({ amountMinor: -1 })).toThrow(
      CardAmountRefusedError
    )
    expect(() => assertCardChargeable({ amountMinor: Number.NaN })).toThrow(
      CardAmountRefusedError
    )
  })

  it("applies the currency's own floor, not the default", () => {
    // 40 p clears GBP's 30 p floor and would not clear EUR's 50 c one.
    expect(() =>
      assertCardChargeable({ amountMinor: 40, currency: "GBP" })
    ).not.toThrow()
    expect(() =>
      assertCardChargeable({ amountMinor: 40, currency: "EUR" })
    ).toThrow(CardAmountRefusedError)
  })
})

describe("isCardChargeable", () => {
  it("is the same rule, without the sentence", () => {
    expect(isCardChargeable({ amountMinor: 1_850, currency: "EUR" })).toBe(true)
    expect(isCardChargeable({ amountMinor: 50, currency: "EUR" })).toBe(true)
    expect(isCardChargeable({ amountMinor: 49, currency: "EUR" })).toBe(false)
    // Zero is not chargeable either — a different refusal, the same tile.
    expect(isCardChargeable({ amountMinor: 0, currency: "EUR" })).toBe(false)
  })
})
