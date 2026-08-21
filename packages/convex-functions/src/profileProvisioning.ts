/**
 * User profile provisioning policy
 *
 * Who may create or change whose role, and on which stores.
 *
 * WHY THIS EXISTS: `userProfiles.upsert` took `userId`, `role`, `storeIds` and
 * `permissions` straight from the caller, and its only guard rejected the two
 * literal strings "super_admin" and "client_admin". Everything else passed —
 * including `manager`, which carries `products:write`, `orders:read/write` and
 * `customers:read`.
 *
 * Since `stores.list` was public, the attack was three calls: sign up on the
 * storefront, list the stores, then `upsert({ userId: <self>, role: "manager",
 * storeIds: [<someone else's store>] })`. The symmetric version was worse —
 * rewrite the real owner's profile to `customer` with no stores and lock them
 * out of their own restaurant.
 *
 * The rules below are the whole authorisation model for provisioning, kept
 * pure so they can be tested without a database.
 */

import { Role, type Permission } from "@be-in-digital/core/auth/rbac"

/** The person performing the change. */
export interface ProvisioningActor {
  userId: string
  role: Role
  /** Stores the actor administers. Ignored for a super admin. */
  storeIds: string[]
}

/** The profile being written. */
export interface ProvisioningTarget {
  userId: string
  role: Role
  storeIds: string[]
  permissions?: string[]
}

export type ProvisioningRejectionReason =
  | "not_permitted"
  | "cannot_grant_admin"
  | "store_not_owned"
  | "cannot_demote_self"
  | "custom_permissions_forbidden"

export class ProvisioningRejectedError extends Error {
  readonly reason: ProvisioningRejectionReason

  constructor(reason: ProvisioningRejectionReason, message: string) {
    super(message)
    this.name = "ProvisioningRejectedError"
    this.reason = reason
  }
}

/** Roles that carry administrative reach and may only be granted by a super admin. */
const ADMIN_ROLES: ReadonlySet<Role> = new Set([Role.SUPER_ADMIN, Role.CLIENT_ADMIN])

/** Roles a client admin may hand out inside their own stores. */
const DELEGATABLE_ROLES: ReadonlySet<Role> = new Set([
  Role.MANAGER,
  Role.KITCHEN,
  Role.WAITER,
  Role.DELIVERY,
  Role.CUSTOMER,
])

/**
 * Throw unless `actor` may write `target`.
 *
 * A super admin may do anything. A client admin may hand out non-admin roles,
 * but only on stores they administer. Nobody else may provision at all — a
 * `manager` running the admin UI cannot mint more managers.
 */
export function assertCanAssignProfile(params: {
  actor: ProvisioningActor
  target: ProvisioningTarget
}): void {
  const { actor, target } = params

  if (actor.role === Role.SUPER_ADMIN) {
    // Even a super admin should not strip their own super-admin role by
    // accident: that is how a deployment ends up with no administrator at all.
    if (target.userId === actor.userId && target.role !== Role.SUPER_ADMIN) {
      throw new ProvisioningRejectedError(
        "cannot_demote_self",
        "Un super administrateur ne peut pas retirer son propre rôle."
      )
    }
    return
  }

  if (actor.role !== Role.CLIENT_ADMIN) {
    throw new ProvisioningRejectedError(
      "not_permitted",
      "Vous n'avez pas le droit de gérer les profils utilisateurs."
    )
  }

  // From here on the actor is a client admin.
  if (ADMIN_ROLES.has(target.role)) {
    throw new ProvisioningRejectedError(
      "cannot_grant_admin",
      "Seul un super administrateur peut attribuer un rôle d'administration."
    )
  }

  if (!DELEGATABLE_ROLES.has(target.role)) {
    throw new ProvisioningRejectedError(
      "cannot_grant_admin",
      `Le rôle « ${target.role} » ne peut pas être délégué.`
    )
  }

  // Granting access to a store the actor does not administer is the escalation
  // that made this whole module necessary.
  const owned = new Set(actor.storeIds)
  const foreign = target.storeIds.filter((id) => !owned.has(id))
  if (foreign.length > 0) {
    throw new ProvisioningRejectedError(
      "store_not_owned",
      "Vous ne pouvez accorder l'accès qu'aux établissements que vous administrez."
    )
  }

  // Per-user permission lists bypass the role table entirely, so only a super
  // admin may set them.
  if (target.permissions && target.permissions.length > 0) {
    throw new ProvisioningRejectedError(
      "custom_permissions_forbidden",
      "Seul un super administrateur peut définir des permissions sur mesure."
    )
  }
}

/**
 * Whether the authenticated caller may claim the first super-admin seat.
 *
 * Provisioning requires a super admin, and a fresh deployment has none — so
 * without this there is no way to appoint the first one short of writing to the
 * database by hand. The claim is self-closing: it only succeeds while no super
 * admin exists, so it cannot be replayed once the deployment is set up.
 */
export function canClaimFirstAdmin(params: {
  existingSuperAdminCount: number
}): boolean {
  return params.existingSuperAdminCount === 0
}

/** Permission required to provision other people's profiles. */
export const PROVISIONING_PERMISSION: Permission = "team:write"
