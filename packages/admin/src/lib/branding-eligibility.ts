/**
 * Who may restyle an establishment — the one predicate behind every save button
 * on the Design screen.
 *
 * WHY IT EXISTS: the sidebar lets anyone holding `stores:read` onto this screen,
 * and `manager` holds exactly that and not `stores:write`. The four save buttons
 * were drawn live for them, and `stores.updateBranding` — a `storeMutation` with
 * `permission: "stores:write"` in both apps' `convex/stores.ts` — would have
 * thrown on the click. That is the same defect the refund button had, and
 * `lib/refund-eligibility.ts` is the shape of its cure; this module is its twin
 * for branding.
 *
 * The one difference from the refund case: nothing about a store makes its
 * branding un-editable, so there is no `visible` here. The control is always
 * drawn; only the role decides whether it works.
 */

import { hasPermission, type Permission, type Role } from "@be-in-digital/core"

/**
 * The permission the server demands before it will write `store.branding`.
 *
 * Mirrors `permission: "stores:write"` on `updateBranding` in the apps'
 * `convex/stores.ts`, and is locked by `design-surface.test.ts` so the mirror
 * cannot fall out of step with what the backend enforces.
 */
export const BRANDING_PERMISSION: Permission = "stores:write"

/**
 * Why a role that can open the Design screen still may not save from it.
 *
 * `stores:write` belongs to `super_admin` and `client_admin` only — from the
 * restaurant's side, the owner. `manager` has `stores:read` and stops here.
 */
export const BRANDING_FORBIDDEN_REASON =
  "Seul le propriétaire peut modifier l'apparence du site"

/** How a save control on the Design screen should be rendered. */
export interface BrandingControlState {
  /** Render it inert — true when the role may not write branding. */
  disabled: boolean
  /** French explanation for the inert state; undefined when the control is live. */
  reason?: string
}

/**
 * The single decision behind every "Enregistrer" on the Design screen.
 *
 * DISABLED RATHER THAN HIDDEN, for the reason `refundControlState` gives at
 * length: the sidebar hides what a role cannot reach, because an absent link
 * reads as "not your job", but a manager standing on a screen full of colour
 * pickers with no save button reads a broken page. Saying "ask the owner" costs
 * one tooltip and answers the question.
 */
export function brandingControlState(role: Role | undefined): BrandingControlState {
  if (!role || !hasPermission(role, BRANDING_PERMISSION)) {
    return { disabled: true, reason: BRANDING_FORBIDDEN_REASON }
  }

  return { disabled: false }
}
