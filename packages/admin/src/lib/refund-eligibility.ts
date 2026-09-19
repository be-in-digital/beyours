/**
 * Refund eligibility — the one predicate that decides whether the admin offers
 * a "Rembourser" button.
 *
 * WHY THIS EXISTS: the same three-clause test was written inline twice, on the
 * payments page and on the order detail page, and both copies gated on
 * `status === "succeeded"` alone. The backend policy
 * (`@be-yours/convex-functions/refundPolicy`) accepts `succeeded` *and*
 * `partially_refunded`, so a payment refunded halfway could not be refunded the
 * rest of the way from the UI — the operator saw no button for a refund the
 * server would have granted. Two copies also meant fixing one and shipping the
 * other unchanged.
 *
 * The status set below must stay equal to `REFUNDABLE_STATUSES` in
 * `refundPolicy.ts`. That module keeps it private, so this is not imported but
 * mirrored — and `refund-eligibility.test.ts` drives the real `planRefund()`
 * across every payment status and fails if the two ever disagree. Change the
 * backend and the test goes red here.
 */

import { hasPermission, type Permission, type Role } from "@be-yours/core"

import type { PaymentProvider } from "./types"

/**
 * Statuses from which money can still be sent back.
 *
 * Mirrors `REFUNDABLE_STATUSES` in the backend refund policy; locked by test.
 */
export const REFUNDABLE_PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  "succeeded",
  "partially_refunded",
])

/** The fields the decision needs — structurally satisfied by `Payment`. */
export interface RefundablePayment {
  status: string
  provider: PaymentProvider
  /** Amount originally captured, in cents. */
  amount: number
  /** Cumulative amount already refunded, in cents. */
  refundedAmount?: number
}

/**
 * Whether the admin should offer to refund this payment.
 *
 * Cash is excluded on purpose: it is handed back at the counter, and the
 * refund route for it is a manual declaration rather than a provider call.
 */
export function canRefundPayment(payment: RefundablePayment | null | undefined): boolean {
  if (!payment) return false

  return (
    REFUNDABLE_PAYMENT_STATUSES.has(payment.status) &&
    payment.provider !== "cash" &&
    (payment.refundedAmount ?? 0) < payment.amount
  )
}

/**
 * The permission the server demands before it will move any money back.
 *
 * Mirrors `requireStorePermission(ctx, payment.storeId, "payments:refund")` in
 * the apps' `convex/payments.ts`. `payments:read` is held by `manager` and
 * `waiter` as well, so seeing the payments screen has never implied being
 * allowed to act on it.
 */
export const REFUND_PERMISSION: Permission = "payments:refund"

/**
 * Why a role that can read payments still may not refund one.
 *
 * `payments:refund` belongs to `super_admin` and `client_admin` only — from the
 * restaurant's side, the owner.
 */
export const REFUND_FORBIDDEN_REASON =
  "Seul le propriétaire peut effectuer un remboursement"

/** How the "Rembourser" control should be rendered, if at all. */
export interface RefundControlState {
  /** Render the control at all — false when the payment itself is not refundable. */
  visible: boolean
  /** Render it inert — true when the role may not refund. */
  disabled: boolean
  /** French explanation for the inert state; undefined when the control is live. */
  reason?: string
}

/**
 * The single decision behind every "Rembourser" button.
 *
 * WHY IT RETURNS A STATE RATHER THAN A BOOLEAN: the payment's state and the
 * operator's rights fail differently and deserve different screens.
 *
 *  - Not refundable (cash, failed, already fully refunded): no control. The
 *    order detail banner already explains that case in words.
 *  - Refundable, but the role lacks `payments:refund`: the control is drawn and
 *    disabled, carrying the reason. HIDDEN was the other option, and the
 *    sidebar does hide what a role cannot reach — but the sidebar is
 *    navigation, where an absent link reads as "not your job". Here the manager
 *    is standing on the payments screen with a customer waiting, and a missing
 *    button reads as a broken page: they escalate, or worse, refund out of band
 *    at the provider and leave the two records disagreeing. Saying "ask the
 *    owner" costs one tooltip and answers the question.
 *
 * Either way the button no longer lies: it was live for a `manager` and the
 * server threw on the click — the same shape of defect as the refund button
 * wired to a Convex function that had been deleted.
 */
export function refundControlState(
  payment: RefundablePayment | null | undefined,
  role: Role | undefined
): RefundControlState {
  if (!canRefundPayment(payment)) {
    return { visible: false, disabled: true }
  }

  if (!role || !hasPermission(role, REFUND_PERMISSION)) {
    return { visible: true, disabled: true, reason: REFUND_FORBIDDEN_REASON }
  }

  return { visible: true, disabled: false }
}
