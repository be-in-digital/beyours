"use client"

/**
 * The wrapper that makes a refused save explain itself.
 *
 * Twin of `pages/payments/refund-control.tsx`, and it exists for the same
 * reason that one does: the shared `Button` sets `disabled:pointer-events-none`,
 * so a disabled button is not hit-testable and the browser never renders its
 * `title`. Putting the explanation on the button would leave it in the DOM and
 * invisible on screen — worse than none, because a dead control with no reason
 * reads as a broken page. The span is what the pointer can land on.
 */

import { cn } from "../../lib/utils"
import type { BrandingControlState } from "../../lib/branding-eligibility"

interface BrandingControlProps {
  /** The decision from `brandingControlState`. */
  state: BrandingControlState
  className?: string
  children: React.ReactNode
}

export function BrandingControl({ state, className, children }: BrandingControlProps) {
  return (
    <span
      className={cn("inline-flex", className)}
      title={state.reason}
      data-branding-blocked={state.disabled ? "" : undefined}
    >
      {children}
    </span>
  )
}
