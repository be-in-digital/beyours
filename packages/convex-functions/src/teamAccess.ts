/**
 * Team membership policy
 *
 * Who may manage a team member, and what an accepted invitation actually grants.
 *
 * WHY THIS EXISTS — two separate defects the audit found:
 *
 * 1. The team screen was decorative. `acceptInvitation` set `teamMembers.userId`
 *    and stopped there, while `getAuthUser` resolves rights exclusively from
 *    `userProfiles` and never reads `teamMembers`. A manager invited with a full
 *    permission set accepted, and received nothing at all.
 *
 * 2. Every team mutation was an `authedMutation` — "are you logged in" and
 *    nothing more — and `acceptInvitation` had no auth whatsoever, taking the
 *    `userId` to bind as a plain argument. A captured invitation token could
 *    therefore attach *any* account to the position.
 *
 * The fix keeps ONE source of authority: `userProfiles`. `teamMembers` is the
 * roster and the invitation record; accepting an invitation provisions the
 * profile, which is what the authorisation chain already reads.
 */

import { Role } from "@be-in-digital/core/auth/rbac"

/** Roles the team screen can hand out. Deliberately excludes admin roles. */
export type TeamRole = "manager" | "kitchen" | "waiter" | "delivery"

export interface TeamMemberRecord {
  /** Absent when `allStores` is true. */
  storeId?: string
  allStores: boolean
  role: TeamRole
  invitationStatus: "pending" | "accepted" | "expired"
  invitedAt?: number
}

/** The person performing the change. */
export interface TeamActor {
  userId: string
  role: Role
  storeIds: string[]
}

export type TeamRejectionReason =
  | "not_permitted"
  | "chain_wide_requires_super_admin"
  | "store_not_administered"
  | "invitation_not_pending"
  | "invitation_expired"

export class TeamAccessError extends Error {
  readonly reason: TeamRejectionReason

  constructor(reason: TeamRejectionReason, message: string) {
    super(message)
    this.name = "TeamAccessError"
    this.reason = reason
  }
}

/** Roles allowed to manage a team roster at all. */
const MANAGING_ROLES: ReadonlySet<Role> = new Set([
  Role.SUPER_ADMIN,
  Role.CLIENT_ADMIN,
])

/**
 * Throw unless `actor` may create, modify or remove `member`.
 *
 * A chain-wide membership (`allStores`) spans every restaurant, so only a super
 * admin can grant or revoke one — a client admin who administers one store must
 * not be able to hand out access to all of them.
 */
export function assertCanManageMember(params: {
  actor: TeamActor
  member: Pick<TeamMemberRecord, "storeId" | "allStores">
}): void {
  const { actor, member } = params

  if (actor.role === Role.SUPER_ADMIN) return

  if (!MANAGING_ROLES.has(actor.role)) {
    throw new TeamAccessError(
      "not_permitted",
      "Vous n'avez pas le droit de gérer l'équipe."
    )
  }

  if (member.allStores) {
    throw new TeamAccessError(
      "chain_wide_requires_super_admin",
      "Seul un super administrateur peut accorder un accès à tous les établissements."
    )
  }

  if (!member.storeId || !actor.storeIds.includes(member.storeId)) {
    throw new TeamAccessError(
      "store_not_administered",
      "Vous ne pouvez gérer l'équipe que de vos propres établissements."
    )
  }
}

/** Invitations stop being acceptable after this long. */
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Throw unless this invitation can still be accepted.
 *
 * Separated from the acceptance itself so the expiry rule is testable without a
 * database, and so the caller can mark the record expired before refusing.
 */
export function assertInvitationAcceptable(params: {
  member: Pick<TeamMemberRecord, "invitationStatus" | "invitedAt">
  now: number
}): void {
  const { member, now } = params

  if (member.invitationStatus === "expired") {
    throw new TeamAccessError("invitation_expired", "Cette invitation a expiré.")
  }

  if (member.invitationStatus === "accepted") {
    throw new TeamAccessError(
      "invitation_not_pending",
      "Cette invitation a déjà été acceptée."
    )
  }

  if (
    member.invitedAt !== undefined &&
    now - member.invitedAt > INVITATION_LIFETIME_MS
  ) {
    throw new TeamAccessError("invitation_expired", "Cette invitation a expiré.")
  }
}

/** What a `userProfiles` record must say once an invitation is accepted. */
export interface InvitationGrant {
  role: Role
  storeIds: string[]
}

/**
 * Translate an accepted invitation into the profile it should provision.
 *
 * This is the bridge that was missing: without it, `teamMembers` and
 * `userProfiles` describe two different realities and only the second one is
 * ever consulted.
 *
 * A chain-wide member gets no store list here — `allStores` has no equivalent in
 * `userProfiles`, and inventing one by enumerating every store would silently
 * widen access as new restaurants are created. Those memberships stay a super
 * admin's business, which is also who is allowed to create them.
 */
export function invitationGrant(
  member: Pick<TeamMemberRecord, "role" | "storeId" | "allStores">,
  /**
   * The invitee's profile as it stands, when they already have one.
   *
   * Acceptance used to REPLACE role and storeIds outright. Three consequences,
   * all real: a client admin could invite the super admin as `kitchen` on their
   * own store and demote them the moment they clicked the link; a manager
   * invited to a second restaurant lost the first; and a chain-wide invitation
   * produced an empty store list, so the member ended up with nothing at all
   * while losing what they had.
   */
  existing?: { role: Role; storeIds: string[] } | null
): InvitationGrant {
  const invitedRole: Role =
    member.role === "manager"
      ? Role.MANAGER
      : member.role === "kitchen"
        ? Role.KITCHEN
        : member.role === "waiter"
          ? Role.WAITER
          : Role.DELIVERY

  const invitedStoreIds =
    !member.allStores && member.storeId ? [member.storeId] : []

  if (!existing) {
    return { role: invitedRole, storeIds: invitedStoreIds }
  }

  // Never lower an existing role, and never drop stores already granted:
  // an invitation ADDS a workplace, it does not redefine the person.
  const keepsHigherRole = ROLE_RANK[existing.role] >= ROLE_RANK[invitedRole]

  return {
    role: keepsHigherRole ? existing.role : invitedRole,
    storeIds: Array.from(new Set([...existing.storeIds, ...invitedStoreIds])),
  }
}

/**
 * Ordering used to decide whether an invitation would demote someone.
 *
 * Only relative order matters, not the numbers.
 */
const ROLE_RANK: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 60,
  [Role.CLIENT_ADMIN]: 50,
  [Role.MANAGER]: 40,
  [Role.KITCHEN]: 30,
  [Role.WAITER]: 30,
  [Role.DELIVERY]: 30,
  [Role.CUSTOMER]: 10,
}

/**
 * What a profile must become when a membership is revoked or deactivated.
 *
 * The grant half of this bridge was built and the revoke half was not: removing
 * someone from the roster deleted the `teamMembers` row and left their
 * `userProfiles` record untouched, so a dismissed employee kept `manager` — and
 * with it products, orders and customer access — on a restaurant whose team
 * screen no longer listed them.
 *
 * An admin is never downgraded by a roster change: their authority does not
 * come from the roster in the first place.
 */
export function revocationEffect(params: {
  profile: { role: Role; storeIds: string[] }
  /** Store the membership covered, if any. */
  storeId?: string
  allStores: boolean
}): { role: Role; storeIds: string[] } {
  const { profile, storeId, allStores } = params

  if (profile.role === Role.SUPER_ADMIN || profile.role === Role.CLIENT_ADMIN) {
    return profile
  }

  const remaining = allStores
    ? []
    : profile.storeIds.filter((id) => id !== storeId)

  // No workplace left means no reason to keep staff rights.
  return {
    role: remaining.length > 0 ? profile.role : Role.CUSTOMER,
    storeIds: remaining,
  }
}
