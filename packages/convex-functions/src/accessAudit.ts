/**
 * Audit trail for who may do what.
 *
 * `userProfiles` is the single source of authority in this product — every
 * guard resolves rights from it — and NOTHING recorded a change to it. A
 * manager could be promoted to admin, moved to another restaurant, have their
 * modules narrowed, or be stripped of access entirely, and the log showed
 * nothing. When an owner asks "who gave this person the keys, and when", the
 * honest answer was that we did not know.
 *
 * The design follows `storeAudit.ts` deliberately, for the same reasons stated
 * there: the write lives next to the change rather than in the app wrappers, so
 * both apps and every future caller get the trail for free; and a Convex
 * mutation being atomic, the entry lands in the same transaction as the change
 * it describes — never one without the other.
 *
 * WHAT IS NOT RECORDED: the profile row id, and anything resembling a
 * credential. An access entry answers who, what, when and by whom. A reader
 * needing more can join on `targetUserId`.
 */

import { Role } from "@be-in-digital/core/auth/rbac"

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** The `action` values access entries use. Mirrors the schema union. */
export const ACCESS_AUDIT_ACTIONS = {
  granted: "access_granted",
  changed: "access_changed",
  revoked: "access_revoked",
} as const

export type AccessAuditAction =
  (typeof ACCESS_AUDIT_ACTIONS)[keyof typeof ACCESS_AUDIT_ACTIONS]

/** The path a change arrived by, recorded inside `details`. */
export const ACCESS_AUDIT_OPERATIONS = {
  /** An administrator assigning someone's profile from the admin. */
  assign: "assign",
  /** The first super-admin seat, claimed with the bootstrap token. */
  bootstrap: "bootstrap",
  /** An invitation accepted by its recipient. */
  invitationAccepted: "invitation_accepted",
  /** A membership deactivated or removed from the roster. */
  membershipRevoked: "membership_revoked",
} as const

export type AccessAuditOperation =
  (typeof ACCESS_AUDIT_OPERATIONS)[keyof typeof ACCESS_AUDIT_OPERATIONS]

/** Recorded as the actor when no session is attached to the mutation. */
export const SYSTEM_ACTOR = "system"

/** Cap on the serialized `details`, matching the stores trail. */
const MAX_DETAILS_LENGTH = 8_000

/* ------------------------------------------------------------------ */
/* The diff                                                            */
/* ------------------------------------------------------------------ */

/** A profile as the audit trail cares about it. */
export interface AccessSnapshot {
  role: Role | string
  storeIds: string[]
  permissions?: string[]
}

export interface AccessChange {
  role?: { from: string; to: string }
  storeIds?: { added: string[]; removed: string[] }
  permissions?: { added: string[]; removed: string[] }
}

function setDiff(before: string[], after: string[]) {
  const b = new Set(before)
  const a = new Set(after)
  return {
    added: after.filter((x) => !b.has(x)),
    removed: before.filter((x) => !a.has(x)),
  }
}

/**
 * What actually changed between two states of a profile.
 *
 * Returns `null` when nothing did. That is not an optimisation: re-saving a
 * profile unchanged is a normal thing for the admin to do, and an audit trail
 * that fills with "no change" entries is one nobody reads — which is the same
 * as not having one.
 */
export function diffAccess(
  before: AccessSnapshot | null,
  after: AccessSnapshot
): AccessChange | null {
  const beforeStores = before?.storeIds ?? []
  const beforePerms = before?.permissions ?? []
  const afterStores = after.storeIds ?? []
  const afterPerms = after.permissions ?? []

  const change: AccessChange = {}

  if (before && before.role !== after.role) {
    change.role = { from: String(before.role), to: String(after.role) }
  }
  if (!before) {
    change.role = { from: "none", to: String(after.role) }
  }

  const stores = setDiff(beforeStores, afterStores)
  if (stores.added.length || stores.removed.length) change.storeIds = stores

  const perms = setDiff(beforePerms, afterPerms)
  if (perms.added.length || perms.removed.length) change.permissions = perms

  return Object.keys(change).length > 0 ? change : null
}

/**
 * Which of the three actions a change amounts to.
 *
 * "Revoked" is not only a deletion: dropping to `customer`, or losing the last
 * establishment, IS the loss of access, and reading those as a mere "change"
 * would hide the event an owner most wants to find.
 */
export function classifyAccessChange(
  before: AccessSnapshot | null,
  after: AccessSnapshot
): AccessAuditAction {
  if (!before) return ACCESS_AUDIT_ACTIONS.granted

  const lostEverything =
    String(after.role) === Role.CUSTOMER && String(before.role) !== Role.CUSTOMER
  const lostLastStore =
    (before.storeIds?.length ?? 0) > 0 && (after.storeIds?.length ?? 0) === 0

  if (lostEverything || lostLastStore) return ACCESS_AUDIT_ACTIONS.revoked
  return ACCESS_AUDIT_ACTIONS.changed
}

/* ------------------------------------------------------------------ */
/* Writing the entry                                                   */
/* ------------------------------------------------------------------ */

export function serializeAccessDetails(
  details: {
    operation: AccessAuditOperation
    changes: AccessChange
    resulting: { role: string; storeCount: number; moduleCount: number }
  },
  maxLength: number = MAX_DETAILS_LENGTH
): string {
  const full = JSON.stringify(details)
  if (full.length <= maxLength) return full

  const degraded = JSON.stringify({
    operation: details.operation,
    changedFields: Object.keys(details.changes),
    resulting: details.resulting,
    truncated: true,
  })
  return degraded.length <= maxLength ? degraded : degraded.slice(0, maxLength)
}

async function resolveActor(ctx: {
  auth?: { getUserIdentity?: () => Promise<{ subject?: string } | null> }
}): Promise<string> {
  const identity = await ctx.auth?.getUserIdentity?.()
  return identity?.subject ?? SYSTEM_ACTOR
}

/**
 * Append one access entry to `systemAuditLog`, if anything changed.
 *
 * Call it from inside the mutation that made the change, after the change, so
 * the two share a transaction. Returns whether an entry was written, which is
 * what the tests assert on.
 */
export async function recordAccessAudit(
  // `ctx: any` mirrors the rest of this package: the handlers cannot name an
  // app's generated MutationCtx without importing that app's data model.
  ctx: any,
  entry: {
    targetUserId: string
    operation: AccessAuditOperation
    before: AccessSnapshot | null
    after: AccessSnapshot
  }
): Promise<boolean> {
  const changes = diffAccess(entry.before, entry.after)
  if (!changes) return false

  await ctx.db.insert("systemAuditLog", {
    action: classifyAccessChange(entry.before, entry.after),
    performedBy: await resolveActor(ctx),
    performedAt: Date.now(),
    targetUserId: entry.targetUserId,
    result: "success" as const,
    details: serializeAccessDetails({
      operation: entry.operation,
      changes,
      resulting: {
        role: String(entry.after.role),
        storeCount: entry.after.storeIds?.length ?? 0,
        moduleCount: entry.after.permissions?.length ?? 0,
      },
    }),
  })
  return true
}
