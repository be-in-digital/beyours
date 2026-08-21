import { describe, it, expect } from "vitest"
import {
  assertSettlesOrder,
  toMinorUnits,
  readPayPalCapture,
  SettlementRejectedError,
  type SettlementClaim,
  type OrderToSettle,
} from "../paymentSettlement"

const ORDER: OrderToSettle = { orderId: "orders:1", total: 11_500 }

function claim(over: Partial<SettlementClaim> = {}): SettlementClaim {
  return {
    provider: "sumup",
    reference: "orders:1",
    amountMajor: 115,
    currency: "EUR",
    ...over,
  }
}

function rejection(fn: () => unknown): SettlementRejectedError {
  try {
    fn()
  } catch (error) {
    if (error instanceof SettlementRejectedError) return error
    throw error
  }
  throw new Error("expected the settlement to be rejected, but it was accepted")
}

// ============================================================================
// toMinorUnits
// ============================================================================

describe("toMinorUnits", () => {
  it("converts a number in euros to cents", () => {
    expect(toMinorUnits(115)).toBe(11_500)
    expect(toMinorUnits(11.5)).toBe(1_150)
  })

  it("converts a decimal string, as PayPal reports it", () => {
    expect(toMinorUnits("115.00")).toBe(11_500)
    expect(toMinorUnits("11.51")).toBe(1_151)
    expect(toMinorUnits(" 9.99 ")).toBe(999)
  })

  it("survives IEEE-754 rounding", () => {
    // 11.51 * 100 is 1150.9999999999998 before rounding
    expect(toMinorUnits(11.51)).toBe(1_151)
    expect(toMinorUnits(0.29)).toBe(29)
    expect(toMinorUnits(1.005)).toBe(101)
  })

  it("returns null rather than 0 for anything unparseable", () => {
    // Coercing to 0 would make a missing amount match a free order.
    expect(toMinorUnits(null)).toBeNull()
    expect(toMinorUnits(undefined)).toBeNull()
    expect(toMinorUnits("")).toBeNull()
    expect(toMinorUnits("gratuit")).toBeNull()
    expect(toMinorUnits(Number.NaN)).toBeNull()
    expect(toMinorUnits(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("keeps a genuine zero distinct from a missing value", () => {
    expect(toMinorUnits(0)).toBe(0)
    expect(toMinorUnits("0.00")).toBe(0)
  })
})

// ============================================================================
// The replay attack this module exists for
// ============================================================================

describe("cross-order replay", () => {
  it("accepts a payment that matches the order", () => {
    expect(() => assertSettlesOrder(claim(), ORDER)).not.toThrow()
  })

  it("refuses a payment made for a different order", () => {
    // The audit scenario: pay a 1 € order, replay its id on a 200 € order.
    const error = rejection(() =>
      assertSettlesOrder(claim({ reference: "orders:cheap", amountMajor: 1 }), ORDER)
    )
    expect(error.reason).toBe("reference_mismatch")
    expect(error.message).toContain("orders:cheap")
  })

  it("refuses a payment whose reference the provider did not return", () => {
    expect(rejection(() => assertSettlesOrder(claim({ reference: undefined }), ORDER)).reason)
      .toBe("reference_missing")
    expect(rejection(() => assertSettlesOrder(claim({ reference: null }), ORDER)).reason)
      .toBe("reference_missing")
    expect(rejection(() => assertSettlesOrder(claim({ reference: "" }), ORDER)).reason)
      .toBe("reference_missing")
  })

  it("checks the reference before the amount, so the error names the real problem", () => {
    const error = rejection(() =>
      assertSettlesOrder(claim({ reference: "orders:other", amountMajor: 999 }), ORDER)
    )
    expect(error.reason).toBe("reference_mismatch")
  })
})

// ============================================================================
// Amount
// ============================================================================

describe("amount verification", () => {
  it("refuses an under-payment", () => {
    const error = rejection(() => assertSettlesOrder(claim({ amountMajor: 1 }), ORDER))
    expect(error.reason).toBe("amount_mismatch")
    expect(error.message).toContain("11500")
  })

  it("refuses an over-payment — the two sides disagree about what was bought", () => {
    expect(rejection(() => assertSettlesOrder(claim({ amountMajor: 200 }), ORDER)).reason)
      .toBe("amount_mismatch")
  })

  it("refuses a payment that reports no amount", () => {
    expect(rejection(() => assertSettlesOrder(claim({ amountMajor: null }), ORDER)).reason)
      .toBe("amount_missing")
  })

  it("refuses a one-cent discrepancy", () => {
    expect(rejection(() => assertSettlesOrder(claim({ amountMajor: 114.99 }), ORDER)).reason)
      .toBe("amount_mismatch")
  })

  it("accepts a PayPal-style decimal string", () => {
    expect(() =>
      assertSettlesOrder(
        claim({ provider: "paypal", amountMajor: "115.00" }),
        ORDER
      )
    ).not.toThrow()
  })

  it("accepts a free order settled for zero", () => {
    expect(() =>
      assertSettlesOrder(claim({ amountMajor: 0 }), { orderId: "orders:1", total: 0 })
    ).not.toThrow()
  })
})

// ============================================================================
// Currency
// ============================================================================

describe("currency verification", () => {
  it("refuses a payment in another currency", () => {
    const error = rejection(() => assertSettlesOrder(claim({ currency: "USD" }), ORDER))
    expect(error.reason).toBe("currency_mismatch")
  })

  it("is case-insensitive", () => {
    expect(() => assertSettlesOrder(claim({ currency: "eur" }), ORDER)).not.toThrow()
  })

  it("skips the check when the provider reports no currency", () => {
    expect(() => assertSettlesOrder(claim({ currency: null }), ORDER)).not.toThrow()
  })

  it("honours an explicit order currency", () => {
    expect(() =>
      assertSettlesOrder(claim({ currency: "CHF" }), {
        orderId: "orders:1",
        total: 11_500,
        currency: "CHF",
      })
    ).not.toThrow()
  })
})

// ============================================================================
// PayPal capture parsing
// ============================================================================

describe("readPayPalCapture", () => {
  it("pulls the reference and captured amount out of a real capture shape", () => {
    const parsed = readPayPalCapture({
      purchase_units: [
        {
          reference_id: "orders:1",
          payments: {
            captures: [{ amount: { currency_code: "EUR", value: "115.00" } }],
          },
        },
      ],
    })

    expect(parsed).toEqual({
      reference: "orders:1",
      amountMajor: "115.00",
      currency: "EUR",
    })
  })

  it("returns undefined fields rather than throwing on a truncated response", () => {
    expect(readPayPalCapture({})).toEqual({
      reference: undefined,
      amountMajor: undefined,
      currency: undefined,
    })
    expect(readPayPalCapture({ purchase_units: [] }).reference).toBeUndefined()
    expect(
      readPayPalCapture({ purchase_units: [{ reference_id: "orders:1" }] }).amountMajor
    ).toBeUndefined()
  })

  it("feeds a truncated capture straight into a rejection", () => {
    // A response missing purchase_units must not settle anything.
    const parsed = readPayPalCapture({})
    const error = rejection(() =>
      assertSettlesOrder({ provider: "paypal", ...parsed }, ORDER)
    )
    expect(error.reason).toBe("reference_missing")
  })
})
