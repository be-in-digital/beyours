import { describe, it, expect } from "vitest"
import {
  planRefund,
  routeRefund,
  RefundRejectedError,
  type PaymentForRefund,
} from "../refundPolicy"

function payment(over: Partial<PaymentForRefund> = {}): PaymentForRefund {
  return {
    provider: "stripe",
    status: "succeeded",
    amount: 10_000,
    externalId: "pi_123",
    ...over,
  }
}

function rejection(fn: () => unknown): RefundRejectedError {
  try {
    fn()
  } catch (error) {
    if (error instanceof RefundRejectedError) return error
    throw error
  }
  throw new Error("expected the refund to be rejected, but it was planned")
}

// ============================================================================
// What may be refunded at all
// ============================================================================

describe("refundable statuses", () => {
  it.each(["succeeded", "partially_refunded"])(
    "allows a refund on a %s payment",
    (status) => {
      expect(planRefund({ payment: payment({ status }), amount: 100 }).amount).toBe(100)
    }
  )

  it.each(["pending", "processing", "failed", "refunded"])(
    "refuses a refund on a %s payment",
    (status) => {
      // The old code refunded anything, including payments that never captured.
      const error = rejection(() =>
        planRefund({ payment: payment({ status }), amount: 100 })
      )
      expect(error.reason).toBe("not_settled")
    }
  )
})

// ============================================================================
// Amount rules
// ============================================================================

describe("refund amount", () => {
  it("refuses zero and negative amounts", () => {
    expect(rejection(() => planRefund({ payment: payment(), amount: 0 })).reason).toBe(
      "amount_not_positive"
    )
    expect(rejection(() => planRefund({ payment: payment(), amount: -500 })).reason).toBe(
      "amount_not_positive"
    )
  })

  it("refuses a non-integer amount of cents", () => {
    expect(
      rejection(() => planRefund({ payment: payment(), amount: 10.5 })).reason
    ).toBe("amount_not_positive")
  })

  it("refuses NaN and Infinity", () => {
    expect(
      rejection(() => planRefund({ payment: payment(), amount: Number.NaN })).reason
    ).toBe("amount_not_positive")
    expect(
      rejection(() =>
        planRefund({ payment: payment(), amount: Number.POSITIVE_INFINITY })
      ).reason
    ).toBe("amount_not_positive")
  })

  it("refuses more than the captured amount", () => {
    const error = rejection(() =>
      planRefund({ payment: payment({ amount: 10_000 }), amount: 10_001 })
    )
    expect(error.reason).toBe("exceeds_balance")
  })

  it("refuses more than the remaining balance after a partial refund", () => {
    const error = rejection(() =>
      planRefund({
        payment: payment({ status: "partially_refunded", refundedAmount: 6_000 }),
        amount: 4_001,
      })
    )
    expect(error.reason).toBe("exceeds_balance")
    expect(error.message).toContain("4000")
  })
})

// ============================================================================
// The state a refund leaves behind
// ============================================================================

describe("resulting state", () => {
  it("marks a full refund on both the payment and the order", () => {
    const plan = planRefund({ payment: payment({ amount: 10_000 }), amount: 10_000 })
    expect(plan).toEqual({
      amount: 10_000,
      refundedAmount: 10_000,
      isFullRefund: true,
      paymentStatus: "refunded",
      orderPaymentStatus: "refunded",
    })
  })

  it("marks a partial refund", () => {
    const plan = planRefund({ payment: payment({ amount: 10_000 }), amount: 2_500 })
    expect(plan.isFullRefund).toBe(false)
    expect(plan.paymentStatus).toBe("partially_refunded")
    expect(plan.refundedAmount).toBe(2_500)
  })

  it("accumulates across successive partial refunds", () => {
    const first = planRefund({ payment: payment(), amount: 3_000 })
    const second = planRefund({
      payment: payment({
        status: "partially_refunded",
        refundedAmount: first.refundedAmount,
      }),
      amount: 7_000,
    })
    expect(second.refundedAmount).toBe(10_000)
    expect(second.isFullRefund).toBe(true)
    expect(second.paymentStatus).toBe("refunded")
  })

  it("treats the exact remaining balance as a full refund", () => {
    const plan = planRefund({
      payment: payment({ status: "partially_refunded", refundedAmount: 9_999 }),
      amount: 1,
    })
    expect(plan.isFullRefund).toBe(true)
  })
})

// ============================================================================
// How the refund gets executed — the part that was missing entirely
// ============================================================================

describe("routeRefund", () => {
  it.each(["stripe", "sumup", "paypal"] as const)(
    "routes %s to a provider API call",
    (provider) => {
      expect(routeRefund(payment({ provider, externalId: "ext_1" }))).toEqual({
        kind: "api",
        provider,
        externalId: "ext_1",
      })
    }
  )

  it("routes cash to a manual, human-declared refund", () => {
    expect(routeRefund(payment({ provider: "cash", externalId: undefined }))).toEqual({
      kind: "manual",
      provider: "cash",
    })
  })

  it("refuses Square, which has no integration", () => {
    const route = routeRefund(payment({ provider: "square" }))
    expect(route.kind).toBe("unsupported")
    if (route.kind === "unsupported") {
      expect(route.reason).toMatch(/Square/)
    }
  })

  it("refuses a card payment with no stored transaction id", () => {
    // Without an id there is nothing to refund against — claiming success here
    // is exactly the bug this module exists to prevent.
    const route = routeRefund(payment({ provider: "stripe", externalId: undefined }))
    expect(route.kind).toBe("unsupported")
    if (route.kind === "unsupported") {
      expect(route.reason).toMatch(/tableau de bord/)
    }
  })

  it("refuses an empty transaction id, not just a missing one", () => {
    expect(routeRefund(payment({ externalId: "" })).kind).toBe("unsupported")
  })
})
