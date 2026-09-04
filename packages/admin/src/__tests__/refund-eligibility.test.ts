/**
 * The admin's refund predicate, and its agreement with the backend policy.
 *
 * The bug this locks down: both refund buttons gated on `status === "succeeded"`
 * alone, so a `partially_refunded` payment was offered no button even though
 * `planRefund()` would have accepted it. The predicate was also written inline
 * twice, which is how one copy got fixed and the other did not.
 */

import { describe, it, expect } from "vitest"
import {
  planRefund,
  RefundRejectedError,
} from "@be-in-digital/convex-functions/refundPolicy"
import { Role, hasPermission } from "@be-in-digital/core"
import {
  canRefundPayment,
  refundControlState,
  REFUNDABLE_PAYMENT_STATUSES,
  REFUND_FORBIDDEN_REASON,
  REFUND_PERMISSION,
  type RefundablePayment,
} from "../lib/refund-eligibility"
import type { PaymentStatus } from "../lib/types"

const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]

const payment = (over: Partial<RefundablePayment> = {}): RefundablePayment => ({
  status: "succeeded",
  provider: "stripe",
  amount: 5000,
  refundedAmount: 0,
  ...over,
})

describe("canRefundPayment", () => {
  it("offers a refund on a settled payment", () => {
    expect(canRefundPayment(payment())).toBe(true)
  })

  it("offers a refund on a PARTIALLY REFUNDED payment with headroom left", () => {
    // The regression this file exists for: the backend allows it, the UI did not.
    expect(
      canRefundPayment(payment({ status: "partially_refunded", refundedAmount: 2000 }))
    ).toBe(true)
  })

  it("refuses a payment that never settled", () => {
    for (const status of ["pending", "processing", "failed"]) {
      expect(canRefundPayment(payment({ status })), status).toBe(false)
    }
  })

  it("refuses a fully refunded payment", () => {
    expect(canRefundPayment(payment({ status: "refunded", refundedAmount: 5000 }))).toBe(
      false
    )
  })

  it("refuses once the refunded amount reaches the captured amount", () => {
    expect(
      canRefundPayment(payment({ status: "partially_refunded", refundedAmount: 5000 }))
    ).toBe(false)
  })

  it("refuses cash: it is handed back at the counter, not through a provider", () => {
    expect(canRefundPayment(payment({ provider: "cash" }))).toBe(false)
  })

  it("treats a missing refundedAmount as zero", () => {
    expect(canRefundPayment(payment({ refundedAmount: undefined }))).toBe(true)
  })

  it("refuses a missing payment instead of throwing", () => {
    expect(canRefundPayment(null)).toBe(false)
    expect(canRefundPayment(undefined)).toBe(false)
  })
})

describe("agreement with the backend refund policy", () => {
  /** Statuses `planRefund()` actually accepts, measured rather than assumed. */
  const backendAccepts = ALL_PAYMENT_STATUSES.filter((status) => {
    try {
      planRefund({
        payment: { provider: "stripe", status, amount: 5000, refundedAmount: 0 },
        amount: 1000,
      })
      return true
    } catch (error) {
      // Only a status rejection means "this status is not refundable".
      return !(
        error instanceof RefundRejectedError && error.reason === "not_settled"
      )
    }
  })

  it("mirrors REFUNDABLE_STATUSES exactly", () => {
    // `refundPolicy.ts` keeps that set private, so the admin mirrors it. If the
    // backend ever changes, this is the test that goes red.
    expect([...REFUNDABLE_PAYMENT_STATUSES].sort()).toEqual([...backendAccepts].sort())
  })

  it("never offers a refund the backend would reject on status grounds", () => {
    for (const status of ALL_PAYMENT_STATUSES) {
      if (canRefundPayment(payment({ status }))) {
        expect(backendAccepts, `UI offers a refund for "${status}"`).toContain(status)
      }
    }
  })
})

describe("refundControlState — the role decides too", () => {
  /**
   * The bug: `canRefundPayment` weighed status, provider and amount, and never
   * asked who was looking. `manager` and `waiter` both hold `payments:read`, so
   * both reach the payments screen and both were handed a live "Rembourser"
   * button — which the server then refused with `requireStorePermission(ctx,
   * payment.storeId, "payments:refund")`. A button that looks live and throws
   * on the click is the same defect the dead `payments.refund` wiring was.
   */
  const REFUNDABLE = payment()

  /** Measured, not assumed: who the RBAC table actually lets refund. */
  const MAY_REFUND = Object.values(Role).filter((role) =>
    hasPermission(role, REFUND_PERMISSION)
  )

  it("names exactly the roles the backend would accept", () => {
    expect([...MAY_REFUND].sort()).toEqual([Role.CLIENT_ADMIN, Role.SUPER_ADMIN].sort())
  })

  it("offers a live button to the roles that hold payments:refund", () => {
    for (const role of MAY_REFUND) {
      expect(refundControlState(REFUNDABLE, role), role).toEqual({
        visible: true,
        disabled: false,
      })
    }
  })

  it("shows a manager the button, disabled, with the reason in French", () => {
    // A manager reads payments all day; a vanished control reads as a broken
    // page. Disabled plus an explanation is the deliberate choice — see the
    // helper's doc comment.
    expect(refundControlState(REFUNDABLE, Role.MANAGER)).toEqual({
      visible: true,
      disabled: true,
      reason: REFUND_FORBIDDEN_REASON,
    })
  })

  it("never leaves a live button in the hands of a role that cannot refund", () => {
    for (const role of Object.values(Role)) {
      const state = refundControlState(REFUNDABLE, role)
      if (!state.disabled) {
        expect(hasPermission(role, REFUND_PERMISSION), `${role} got a live button`).toBe(
          true
        )
      }
    }
  })

  it("explains itself whenever it disables a visible control", () => {
    for (const role of Object.values(Role)) {
      const state = refundControlState(REFUNDABLE, role)
      if (state.visible && state.disabled) {
        expect(state.reason, role).toBeTruthy()
      }
    }
  })

  it("treats an unresolved role as unable to refund", () => {
    // `admin-auth-store` starts on "customer" and the profile arrives later.
    expect(refundControlState(REFUNDABLE, undefined).disabled).toBe(true)
  })

  it("draws no control at all when the payment itself is not refundable", () => {
    for (const over of [
      { status: "failed" },
      { provider: "cash" as const },
      { status: "refunded", refundedAmount: 5000 },
    ]) {
      const state = refundControlState(payment(over), Role.CLIENT_ADMIN)
      expect(state.visible, JSON.stringify(over)).toBe(false)
    }
    expect(refundControlState(null, Role.CLIENT_ADMIN).visible).toBe(false)
  })

  it("keeps the payment half of the decision identical to canRefundPayment", () => {
    // One predicate, so the two can never drift into disagreeing about money.
    for (const status of ALL_PAYMENT_STATUSES) {
      for (const provider of ["stripe", "cash"] as const) {
        const p = payment({ status, provider })
        expect(refundControlState(p, Role.CLIENT_ADMIN).visible, `${status}/${provider}`).toBe(
          canRefundPayment(p)
        )
      }
    }
  })
})
