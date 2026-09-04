import { describe, it, expect } from "vitest"
import {
  assertSettlesOrder,
  toMinorUnits,
  readPayPalCapture,
  readStripeCheckoutSession,
  paymentStatusAfterSettlement,
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

// ============================================================================
// Stripe
//
// Stripe reached this guard last, and for a different reason than the other
// two. `verifyCheckoutSession` derives the order from the SAME session's
// metadata, so there is no cross-order replay to close on that path. What the
// binding closes is the amount: `amount_total` was written to the payment
// record with nothing ever compared to it.
// ============================================================================

describe("Stripe settlement", () => {
  it("accepts stripe as a provider", () => {
    expect(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500,
          currency: "EUR",
        },
        ORDER
      )
    ).not.toThrow()
  })

  it("refuses Stripe's minor units fed into the major-unit field", () => {
    // THE 100x TRAP, and the reason `amountMinor` exists at all.
    //
    // `amountMajor` is documented as euros and runs through `toMinorUnits`,
    // which multiplies by 100. Stripe's `amount_total` is ALREADY cents. Wiring
    // it to `amountMajor` turns a correct 115 EUR payment into 1_150_000 c
    // against an 11_500 c order and rejects EVERY legitimate Stripe payment —
    // the product goes down, not the attack.
    //
    // The naive repair is worse than the bug: dividing by 100 at the call site
    // reintroduces the float rounding `toMinorUnits` exists to avoid, and it is
    // simply wrong for zero-decimal currencies like JPY.
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMajor: 11_500,
          currency: "EUR",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("amount_mismatch")

    // The same number in the right field is the same payment, accepted.
    expect(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500,
          currency: "EUR",
        },
        ORDER
      )
    ).not.toThrow()
  })

  it("refuses a session that settled less than the order total", () => {
    // An order edited after the session was created, a Stripe-side coupon, or a
    // stale session for an earlier cart. All three used to mark the order paid.
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 10_000,
          currency: "EUR",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("amount_mismatch")
  })

  it("refuses a non-integer minor amount rather than rounding it", () => {
    // Cents are integers. Rounding 11500.5 into 11500 would be the guard
    // inventing the number it is meant to be checking.
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500.5,
          currency: "EUR",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("amount_missing")
  })

  it("accepts a zero-amount settlement against a zero-total order", () => {
    // `amountMinor: 0` is a real amount, not a missing one — the falsy-check
    // mistake that `toMinorUnits` was written to avoid on the major side.
    expect(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:free",
          amountMinor: 0,
          currency: "EUR",
        },
        { orderId: "orders:free", total: 0 }
      )
    ).not.toThrow()
  })

  it("refuses a session paid in another currency", () => {
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500,
          currency: "USD",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("currency_mismatch")
  })
})

// ============================================================================
// Stripe checkout session parsing
// ============================================================================

describe("readStripeCheckoutSession", () => {
  it("pulls the reference, minor amount and intent out of a real session", () => {
    expect(
      readStripeCheckoutSession({
        id: "cs_test_1",
        amount_total: 11_500,
        currency: "eur",
        payment_intent: "pi_123",
        metadata: { orderId: "orders:1", storeId: "stores:1" },
      })
    ).toEqual({
      reference: "orders:1",
      amountMinor: 11_500,
      currency: "EUR",
      paymentIntentId: "pi_123",
    })
  })

  it("reads an expanded payment_intent object as well as a bare id", () => {
    expect(
      readStripeCheckoutSession({
        id: "cs_test_1",
        amount_total: 11_500,
        currency: "eur",
        payment_intent: { id: "pi_expanded" },
        metadata: { orderId: "orders:1" },
      }).paymentIntentId
    ).toBe("pi_expanded")
  })

  it("falls back to the session id when there is no intent", () => {
    // Never an empty string: `routeRefund` treats a payment with no externalId
    // as unrefundable, so a charge recorded that way could never be given back.
    expect(
      readStripeCheckoutSession({ id: "cs_test_1", metadata: { orderId: "orders:1" } })
        .paymentIntentId
    ).toBe("cs_test_1")
  })

  it("feeds a truncated session straight into a rejection", () => {
    const parsed = readStripeCheckoutSession({ id: "cs_test_1" })
    const error = rejection(() =>
      assertSettlesOrder({ provider: "stripe", ...parsed }, ORDER)
    )
    expect(error.reason).toBe("reference_missing")
  })

  it("rejects on the amount when the reference is present but the total is not", () => {
    const parsed = readStripeCheckoutSession({
      id: "cs_test_1",
      metadata: { orderId: "orders:1" },
    })
    const error = rejection(() =>
      assertSettlesOrder({ provider: "stripe", ...parsed }, ORDER)
    )
    expect(error.reason).toBe("amount_missing")
  })
})

// ============================================================================
// What a settlement does to the ORDER
// ============================================================================

describe("paymentStatusAfterSettlement", () => {
  it("marks a pending order paid", () => {
    expect(
      paymentStatusAfterSettlement({ status: "confirmed", paymentStatus: "pending" })
    ).toBe("paid")
  })

  it("does nothing to an order that is already paid", () => {
    expect(
      paymentStatusAfterSettlement({ status: "confirmed", paymentStatus: "paid" })
    ).toBeNull()
  })

  it("does not write paid over a refund the customer is still owed", () => {
    // THE BUG. Issue #128 made a cancelled paid order sit at "refund_pending":
    // money owed back, a human still has to send it. All four provider
    // settlement paths guarded with `if (order.paymentStatus !== "paid")`, and
    // "refund_pending" !== "paid" is TRUE — so a Stripe retry (they run for up
    // to three days) or a guest refreshing the success tab entered the branch
    // and wrote "paid" back over the marker. The refund banner and the
    // "Rembourser le client" action then vanish from the admin and NOTHING
    // records that money is owed.
    expect(
      paymentStatusAfterSettlement({
        status: "cancelled",
        paymentStatus: "refund_pending",
      })
    ).toBeNull()
  })

  it("does not write paid over a refund that has already been made", () => {
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: "refunded" })
    ).toBeNull()
    expect(
      paymentStatusAfterSettlement({
        status: "completed",
        paymentStatus: "partially_refunded",
      })
    ).toBeNull()
  })

  it("owes money back when a settlement lands on a cancelled order", () => {
    // A payment that arrives for something nobody will deliver is not "paid",
    // it is owed back. Same conclusion `payments.releaseRefund` reaches for a
    // cancelled order, reached the same way.
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: "pending" })
    ).toBe("refund_pending")
  })

  it("repairs a cancelled order the old code had already flipped to paid", () => {
    // The residue of the bug: cancelled + paid, with no marker saying money is
    // owed. A later delivery of the same charge now corrects it instead of
    // confirming it.
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: "paid" })
    ).toBe("refund_pending")
  })

  it("converges — a second settlement after the repair writes nothing", () => {
    const first = paymentStatusAfterSettlement({
      status: "cancelled",
      paymentStatus: "paid",
    })
    expect(first).toBe("refund_pending")
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: first! })
    ).toBeNull()
  })

  it("settles an order that had failed a previous attempt", () => {
    // A retry with a new session is a legitimate payment.
    expect(
      paymentStatusAfterSettlement({ status: "pending", paymentStatus: "failed" })
    ).toBe("paid")
  })
})
