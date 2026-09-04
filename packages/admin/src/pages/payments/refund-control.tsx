"use client"

/**
 * The wrapper that makes a refused refund explain itself.
 *
 * WHY IT EXISTS AT ALL: the refund button used to be drawn from the payment's
 * state alone, so `manager` and `waiter` — who hold `payments:read` and reach
 * the payments screen — were given a live "Rembourser" that the server refused
 * on the click with `requireStorePermission(..., "payments:refund")`.
 *
 * WHY A WRAPPER AND NOT A `title` ON THE BUTTON: the shared button sets
 * `disabled:pointer-events-none`, so a disabled button is not hit-testable and
 * the browser never renders its tooltip. The explanation would have been in the
 * DOM and invisible on screen, which is worse than none: a dead control with no
 * reason reads as a broken page. The span is what the pointer can land on.
 */

import { cn } from "../../lib/utils"
import type { RefundControlState } from "../../lib/refund-eligibility"

interface RefundControlProps {
  /** The decision from `refundControlState`. */
  state: RefundControlState
  className?: string
  children: React.ReactNode
}

export function RefundControl({ state, className, children }: RefundControlProps) {
  // Not refundable at all — no cash refund through a provider, nothing left to
  // send back. The order detail banner says so in words; a control here would
  // only be one more thing to click and be refused.
  if (!state.visible) return null

  return (
    <span
      className={cn("inline-flex", className)}
      title={state.reason}
      data-refund-blocked={state.disabled ? "" : undefined}
    >
      {children}
    </span>
  )
}
