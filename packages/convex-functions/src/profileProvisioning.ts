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
  | "cannot_touch_admin"
  | "store_not_owned"
  | "target_not_owned"
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
  /**
   * The target's profile as it stands today, when one exists.
   *
   * Reasoning only about the REQUESTED role leaves the door wide open, because
   * `upsert` overwrites: a client admin could write
   * `{ userId: <the super admin>, role: "customer", storeIds: [] }` — a
   * non-admin role, no foreign store, every check passes — and lock the owner
   * out of their own deployment. What matters is who the target IS, not only
   * what they are about to become.
   */
  existingTarget?: Pick<ProvisioningTarget, "role" | "storeIds"> | null
}): void {
  const { actor, target, existingTarget } = params

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

  // Never touch someone who already holds an administrative role. Without this,
  // "demoting" an admin passes every other check — the requested role is
  // harmless, and an admin being stripped of their stores has none to compare.
  if (existingTarget && ADMIN_ROLES.has(existingTarget.role)) {
    throw new ProvisioningRejectedError(
      "cannot_touch_admin",
      "Seul un super administrateur peut modifier le profil d'un administrateur."
    )
  }

  // An existing member of another restaurant is not yours to reassign, even
  // towards your own stores — that is how you poach or lock out a colleague.
  if (existingTarget) {
    const owned = new Set(actor.storeIds)
    const foreignExisting = existingTarget.storeIds.filter((id) => !owned.has(id))
    if (foreignExisting.length > 0) {
      throw new ProvisioningRejectedError(
        "target_not_owned",
        "Cet utilisateur appartient à un établissement que vous n'administrez pas."
      )
    }
  }

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

/* ------------------------------------------------------------------ */
/* Creating an establishment                                           */
/* ------------------------------------------------------------------ */

/**
 * Does creating an establishment make its creator an administrator of it?
 *
 * `stores.create` is the one mutation the store-scoped seam cannot guard: at
 * the time of the call there is no store to check membership against, so it
 * runs on a bare `stores:write`. Nothing then added the new establishment to
 * the creator's profile, and the rules above forbid a client admin from writing
 * any administrative profile — their own included, which
 * `assertCanAssignProfile` rejects as `cannot_touch_admin` before the storeIds
 * rules are ever reached. An owner who opened a second location was locked out
 * of it and could not let themselves back in; only a super admin could. (#117)
 *
 * A super admin is left alone, for two reasons worth keeping straight. The
 * mutation cannot know which owner a store created on someone's behalf is meant
 * for, so any membership it invented would be a guess written into an
 * access-control field. And every guard exempts a super admin BEFORE it reads
 * `storeIds` — `requireStoreAccess`, `assertCanManageMember`, the branch above
 * — so the invariant is not "empty means global", it is that the field is never
 * consulted for them at all. Populating it would break nothing today and would
 * leave behind data that means nothing while reading like it means something;
 * the next person to write a guard is the one who would pay. Not writing it
 * keeps "never consulted" and "never populated" saying the same thing.
 *
 * THIS IS THE ONLY SELF-GRANT THE PROVISIONING MODEL ALLOWS, and it is narrow
 * by construction rather than by good intentions: the store id comes from the
 * insert that just happened and never from the caller, the target is always the
 * caller's own profile, and the role is untouched. It hands back exactly what
 * creating the establishment already implied — nothing the caller could not
 * have had by calling `stores.create` again.
 *
 * The write lives in `grantCreatedStoreAccess` (./auth); this stays pure so the
 * rule can be read and tested without a database, like everything else here.
 */
export function creatorAdministersNewStore(role: Role): boolean {
  return role === Role.CLIENT_ADMIN
}

/**
 * The longest bootstrap token this will consider, in characters.
 *
 * `openssl rand -base64 32` — what every document and the `/setup` screen tell
 * an operator to run — produces 44. 512 is an order of magnitude of headroom
 * and still a hard bound, which is the point: without one the comparison does
 * work proportional to whatever a caller sends, and `claimFirstAdmin` is public.
 *
 * A configured token longer than this can never match. That is a deliberate
 * refusal rather than a silent truncation, because comparing the first 512
 * characters of a longer secret would call two different tokens equal.
 */
export const MAX_BOOTSTRAP_TOKEN_LENGTH = 512

/**
 * Does the supplied bootstrap token match the one configured on the deployment?
 *
 * Constant-time, and the reason is not theoretical: a plain `===` returns on
 * the first differing byte, and `claimFirstAdmin` is a PUBLIC mutation anyone
 * holding the deployment URL can call in a loop. That is enough to recover the
 * token one character at a time.
 *
 * The loop runs a FIXED number of rounds — `MAX_BOOTSTRAP_TOKEN_LENGTH`, never
 * a function of either argument — and folds the length difference into the same
 * accumulator. Two earlier versions each got this half right and were each
 * measured wrong:
 *
 *   - The original opened with `if (a.length !== b.length) return false`, under
 *     a comment promising to leak neither length nor content. It did zero byte
 *     comparisons for a wrong-length guess, so the token's length fell out of
 *     the timing before its bytes were ever attacked.
 *   - Replacing that with `rounds = Math.max(supplied.length, expected.length)`
 *     moved the oracle rather than closing it: a one-character guess still ran
 *     `expected.length` rounds, so runtime stayed proportional to the secret's
 *     length. Worse, it handed the caller the round count — a 1 MB argument,
 *     which `v.string()` permits, bought ~17 ms of backend CPU per request
 *     against an O(1) rejection before it.
 *
 * A fixed round count closes both: the work is identical for every input that
 * gets past the length bounds, and the bounds themselves are O(1) and reveal
 * only what the caller already knows (their own length) or what is already
 * public (`bootstrapStatus.configured` says whether a token is set at all).
 *
 * `charCodeAt` past the end of a string is `NaN`, and `NaN | 0` is `0`, which
 * is what makes reading to a fixed length safe rather than merely undefined.
 *
 * Neither argument may be empty: two empty strings compare equal, which on an
 * unconfigured deployment would wave through a caller who supplied nothing.
 * `claimFirstAdmin` refuses an unset `ADMIN_BOOTSTRAP_TOKEN` before it ever
 * gets here, and this stays fail-closed on its own so the guarantee does not
 * depend on that ordering surviving the next edit.
 */
export function bootstrapTokenMatches(supplied: string, expected: string): boolean {
  if (expected.length === 0 || supplied.length === 0) return false
  if (
    supplied.length > MAX_BOOTSTRAP_TOKEN_LENGTH ||
    expected.length > MAX_BOOTSTRAP_TOKEN_LENGTH
  ) {
    return false
  }

  let diff = supplied.length ^ expected.length
  for (let i = 0; i < MAX_BOOTSTRAP_TOKEN_LENGTH; i++) {
    diff |= (supplied.charCodeAt(i) | 0) ^ (expected.charCodeAt(i) | 0)
  }
  return diff === 0
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
