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

/**
 * Why a save that the role IS allowed to make would still change nothing.
 *
 * `stores.updateBranding` writes `store.branding` correctly; no reader exists.
 * Every branding read in either app goes through the CMS `branding` block on
 * the `storefront-layout` page, and the storefront's palette and fonts are
 * compile-time constants besides. So the colour and typography saves reported
 * success and left the public site exactly as it was.
 *
 * Stated as a setting-level fact rather than a role-level one, because that is
 * what it is: no role can get around it, the owner included.
 */
export const BRANDING_UNAPPLIED_REASON =
  "Ce réglage n'est pas encore appliqué à votre site public"

/**
 * A save that is correct, permitted, and pointless.
 *
 * The role question is asked first and still wins when it refuses, for two
 * reasons. It is the more specific answer to "why is this button dead for me":
 * a manager would not be allowed to save this even once the storefront learns
 * to read it, so telling them the wiring is at fault would be one more thing to
 * unlearn later. And it keeps `brandingControlState` on the live path, so the
 * permission mirror this module exists for cannot quietly rot while the screen
 * waits for its reader.
 *
 * DISABLED RATHER THAN HIDDEN, for the third time on this screen: the fields
 * hold values an establishment may already have saved, and a tab that vanishes
 * reads as a feature withdrawn. The tab states its own reason in an `Alert`
 * above the fields — the tooltip here is the second half of that, for whoever
 * goes straight for the button.
 */
export function unappliedBrandingState(
  role: Role | undefined
): BrandingControlState {
  const byRole = brandingControlState(role)
  if (byRole.disabled) return byRole

  return { disabled: true, reason: BRANDING_UNAPPLIED_REASON }
}
