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


/* ------------------------------------------------------------------ */
/* Module permissions                                                  */
/* ------------------------------------------------------------------ */

/**
 * The eight checkboxes the invite dialog shows.
 *
 * They were stored on `teamMembers.permissions` and read by NOTHING:
 * `invitationGrant` did not carry them across, acceptance wrote
 * `existingProfile?.permissions ?? []`, and `hasPermission` is role-only. An
 * owner who unticked "Paramètres" for a waiter restricted nothing — the waiter
 * had settings access or not entirely according to their role, exactly as
 * before. The dialog was a promise the backend never heard.
 */
export type ModuleId =
  | "dashboard"
  | "orders"
  | "products"
  | "kitchen"
  | "team"
  | "settings"
  | "integrations"
  | "marketing"

/**
 * Which modules cover a resource.
 *
 * A resource may belong to several modules — `stores` is reachable from both
 * the dashboard and the settings screen — and holding ANY covering module is
 * enough, because that is what the owner sees when they tick a box.
 */
const RESOURCE_MODULES: Record<string, ModuleId[]> = {
  analytics: ["dashboard"],
  stores: ["dashboard", "settings"],
  orders: ["orders"],
  customers: ["orders"],
  deliveries: ["orders"],
  tables: ["orders"],
  products: ["products"],
  menus: ["products"],
  translations: ["products"],
  kitchen: ["kitchen"],
  team: ["team"],
  settings: ["settings"],
  system: ["settings"],
  payments: ["integrations"],
  games: ["marketing"],
  marketing: ["marketing"],
  content: ["marketing"],
}

/** Roles whose authority does not come from the roster, so modules never bind them. */
const MODULE_EXEMPT_ROLES: ReadonlySet<Role> = new Set([
  Role.SUPER_ADMIN,
  Role.CLIENT_ADMIN,
])

/**
 * Does this profile's module selection allow `permission`?
 *
 * Runs AFTER the role check, never instead of it: modules can only narrow what
 * a role already grants. Three rules, each deliberate:
 *
 * - An EMPTY list means unrestricted. Every profile in every existing
 *   deployment has `permissions: []`, and reading that as "nothing allowed"
 *   would lock out every member the day this shipped.
 * - An admin is exempt. Their authority is not the roster's to narrow, and a
 *   stray list on an owner's profile must not be able to shut them out of
 *   their own restaurant.
 * - A resource NO module covers is allowed. The owner was never shown a
 *   checkbox for it, so they cannot have meant to deny it — refusing here
 *   would invent a restriction nobody asked for.
 */
export function profileAllowsPermission(
  profile: { role: Role; permissions?: string[] },
  permission: string
): boolean {
  const modules = profile.permissions ?? []
  if (modules.length === 0) return true
  if (MODULE_EXEMPT_ROLES.has(profile.role)) return true

  // `noUncheckedIndexedAccess` is on in the apps that consume this: both the
  // split and the lookup can be undefined, and neither is a reason to refuse.
  const resource = permission.split(":")[0] ?? ""
  const covering: ModuleId[] = RESOURCE_MODULES[resource] ?? []
  if (covering.length === 0) return true

  return covering.some((module: ModuleId) => modules.includes(module))
}

/**
 * The module set an accepted invitation should write.
 *
 * Union with what the profile already holds, for the same reason
 * `invitationGrant` never lowers a role: a second restaurant must not shrink
 * the access someone has in the first. The consequence is worth stating —
 * `userProfiles.permissions` is per ACCOUNT, not per store, so a member
 * restricted in one restaurant and unrestricted in another ends up
 * unrestricted. Narrowing that means moving the column onto the membership,
 * which is a schema change and separate work.
 *
 * Either side being unrestricted keeps the result unrestricted: intersecting
 * "everything" with a narrower set would silently demote a manager the first
 * time they were invited somewhere as a waiter.
 */
export function invitationModules(
  invited: string[] | undefined,
  existing: string[] | undefined
): string[] {
  const invitedModules = invited ?? []
  const existingModules = existing ?? []

  if (invitedModules.length === 0) return []
  if (existing === undefined) return Array.from(new Set(invitedModules))
  if (existingModules.length === 0) return []

  return Array.from(new Set([...existingModules, ...invitedModules]))
}
