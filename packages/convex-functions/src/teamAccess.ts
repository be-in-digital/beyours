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
  const invitedRole: Role = teamRoleToProfileRole(member.role)

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
 * The `userProfiles` role a roster role stands for.
 *
 * The roster speaks in four job titles; the profile speaks in `Role`. Both
 * `invitationGrant` and `membershipUpdateEffect` need the same translation, and
 * having it in one place is what keeps an edit from meaning something different
 * than the invitation that preceded it.
 */
export function teamRoleToProfileRole(role: TeamRole): Role {
  switch (role) {
    case "manager":
      return Role.MANAGER
    case "kitchen":
      return Role.KITCHEN
    case "waiter":
      return Role.WAITER
    case "delivery":
      return Role.DELIVERY
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


/* ------------------------------------------------------------------ */
/* Sweeping stale invitations                                          */
/* ------------------------------------------------------------------ */

/**
 * How long an expired invitation is kept before the row is deleted.
 *
 * Not zero: the roster is also a record of who was invited and never came, and
 * an owner should be able to see that for a while. Not forever either — a dead
 * invitation is a name and an email address sitting in a table for no further
 * purpose.
 */
export const INVITATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** What the sweep should do with one roster row. */
export type InvitationSweepVerdict = "expire" | "purge" | "keep"

/**
 * Decide the fate of one invitation.
 *
 * Two separate jobs, deliberately, because they protect different things.
 *
 * EXPIRE closes a security hole. `assertInvitationAcceptable` already refuses a
 * link past its lifetime, so nothing can be accepted with one — but the token
 * stays in the row, and a row that still holds a token is a row a leak can
 * still be about. Marking it expired is what lets the caller clear the token.
 *
 * PURGE is hygiene, and applies only to invitations nobody ever accepted: a row
 * carrying a `userId` is a real member of the team, and the sweep must never
 * remove one however old the original invitation was. That is the mistake this
 * function exists to make impossible.
 */
export function sweepInvitation(
  member: Pick<TeamMemberRecord, "invitationStatus" | "invitedAt"> & {
    userId?: string
  },
  now: number,
  retentionMs: number = INVITATION_RETENTION_MS
): InvitationSweepVerdict {
  // Someone holds this position. Whatever the invitation once said, this is a
  // member now.
  if (member.userId) return "keep"

  const invitedAt = member.invitedAt

  if (member.invitationStatus === "pending") {
    if (invitedAt === undefined) return "keep"
    return now - invitedAt > INVITATION_LIFETIME_MS ? "expire" : "keep"
  }

  if (member.invitationStatus === "expired") {
    // No `invitedAt` to age against: keep it rather than delete a row whose
    // age cannot be established.
    if (invitedAt === undefined) return "keep"
    return now - invitedAt > INVITATION_LIFETIME_MS + retentionMs
      ? "purge"
      : "keep"
  }

  // "accepted" without a userId should not happen; keeping it is the answer
  // that loses nothing if it does.
  return "keep"
}


/* ------------------------------------------------------------------ */
/* Editing a membership after it has been accepted                     */
/* ------------------------------------------------------------------ */

/**
 * One roster row, reduced to what the profile projection depends on.
 */
export interface MembershipProjection {
  role: TeamRole
  /** Absent when `allStores` is true. */
  storeId?: string
  allStores: boolean
  /** The module checkboxes. Empty or absent means unrestricted. */
  permissions?: string[]
  isActive: boolean
}

/** The profile fields a roster edit can move. */
export interface ProfileProjection {
  role: Role
  storeIds: string[]
  permissions?: string[]
}

function coveredStore(
  membership: Pick<MembershipProjection, "storeId" | "allStores">
): string | undefined {
  return !membership.allStores && membership.storeId
    ? membership.storeId
    : undefined
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const seen = new Set(a)
  return b.every((x) => seen.has(x))
}

/**
 * What a profile must become when an existing membership is EDITED.
 *
 * The third side of a bridge that had only two. `acceptInvitation` provisions
 * the profile and `revocationEffect` takes it back, but `update` — the "Modifier
 * le membre" dialog, the one an owner actually uses day to day — patched the
 * roster row and stopped there. Every guard resolves rights from `userProfiles`
 * and none of them reads `teamMembers`, so unticking "Produits" for a waiter,
 * demoting a manager, or moving someone to another restaurant all changed the
 * team screen and nothing else. The owner believed they were restricting; they
 * were restricting nothing.
 *
 * Returns `null` when the profile should be left alone — either because the
 * roster has no authority over it, or because nothing actually moved. A no-op
 * patch would bump `updatedAt` and an audit trail full of empty entries is one
 * nobody reads.
 *
 * WHAT IS DELIBERATE HERE:
 *
 * - **Admins are untouchable from the roster.** Same rule, same reason, as
 *   `revocationEffect`: their authority does not come from the team screen, and
 *   a client admin editing a row on their own store must not be able to demote
 *   the super admin who happens to appear on it.
 *
 * - **Establishments move by delta, not by recompute.** A profile can hold
 *   stores granted outside the roster entirely, and rebuilding the list from
 *   the memberships alone would quietly confiscate those. Only the store THIS
 *   membership used to cover is dropped, and only when no other active
 *   membership still covers it.
 *
 * - **Modules ARE recomputed.** They have to be: the whole defect is that
 *   unticking a box changed nothing, and any rule that merges the new list into
 *   the old one keeps it that way. Unrestricted stays absorbing, exactly as in
 *   `invitationModules` — a member left open in one restaurant is open, because
 *   `userProfiles.permissions` is per ACCOUNT and cannot say otherwise. The
 *   consequence, stated rather than hidden: the roster OWNS the module list, so
 *   modules written straight onto a profile through `userProfiles.upsert` —
 *   which no screen currently calls — are superseded by the next roster edit.
 *
 * - **The role is the highest one still held.** Someone can be a manager in
 *   Lyon and a waiter in Paris; the profile carries a single role, so an edit in
 *   Paris must not cost them Lyon.
 *
 * - **Widening to chain-wide narrows nothing.** `allStores` has no
 *   representation in `userProfiles` — `invitationGrant` says so and refuses to
 *   enumerate stores for it — so a membership that becomes chain-wide keeps the
 *   store list it had. The gap is real and stated; dropping the person to
 *   `customer` because we cannot express their promotion would be worse than
 *   leaving them where they were.
 */
export function membershipUpdateEffect(params: {
  profile: ProfileProjection
  /** The edited membership as it stood before the patch. */
  before: Pick<MembershipProjection, "storeId" | "allStores">
  /** The edited membership as it stands after the patch. */
  after: MembershipProjection
  /** The same person's OTHER roster rows, in their current state. */
  others: readonly MembershipProjection[]
}): { role: Role; storeIds: string[]; permissions: string[] } | null {
  const { profile, before, after, others } = params

  if (profile.role === Role.SUPER_ADMIN || profile.role === Role.CLIENT_ADMIN) {
    return null
  }

  const otherActive = others.filter((m) => m.isActive)
  const active = after.isActive ? [after, ...otherActive] : otherActive

  // --- establishments ------------------------------------------------
  const dropped = coveredStore(before)
  const gained = after.isActive ? coveredStore(after) : undefined
  const heldElsewhere =
    dropped !== undefined &&
    otherActive.some((m) => coveredStore(m) === dropped)
  const widenedToChain = after.isActive && after.allStores

  let storeIds = profile.storeIds
  if (
    dropped !== undefined &&
    dropped !== gained &&
    !heldElsewhere &&
    !widenedToChain
  ) {
    storeIds = storeIds.filter((id) => id !== dropped)
  }
  if (gained !== undefined && !storeIds.includes(gained)) {
    storeIds = [...storeIds, gained]
  }

  // --- role ----------------------------------------------------------
  const rosterRole = active.length
    ? active
        .map((m) => teamRoleToProfileRole(m.role))
        .reduce((best, r) => (ROLE_RANK[best] >= ROLE_RANK[r] ? best : r))
    : null

  // A staff role with nowhere to exercise it is not a role. This is the tail of
  // `revocationEffect`, reached when the last membership is deactivated.
  const hasSomewhere = storeIds.length > 0 || active.some((m) => m.allStores)
  const role: Role = !hasSomewhere
    ? Role.CUSTOMER
    : (rosterRole ?? profile.role)

  // --- modules -------------------------------------------------------
  const lists = active.map((m) => m.permissions ?? [])
  const permissions =
    lists.length === 0 || lists.some((l) => l.length === 0)
      ? []
      : Array.from(new Set(lists.flat()))

  const unchanged =
    role === profile.role &&
    sameSet(storeIds, profile.storeIds) &&
    sameSet(permissions, profile.permissions ?? [])

  return unchanged ? null : { role, storeIds, permissions }
}
