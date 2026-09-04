/**
 * Audit trail for establishment changes.
 *
 * `systemAuditLog` existed but only system operations ever wrote to it, so a
 * restaurant could be renamed, moved, reconfigured or deleted and the log would
 * show nothing at all. These helpers close that gap for the stores module.
 *
 * WHY THE WRITE LIVES IN THE ENGINE DEFINITIONS, NOT IN THE APP WRAPPERS:
 * `apps/reference` and `apps/themes` wrap the same definitions, and
 * `apps/themes` is the template cloned once per client. An audit call added to
 * a wrapper would have to be added twice and kept in step forever; a new
 * wrapper would silently ship without one. Writing the entry next to the change
 * itself means every app, and every future caller, gets the trail for free.
 *
 * TRANSACTIONALITY: a Convex mutation is atomic, so the entry lands in the same
 * transaction as the change it describes — never one without the other. That
 * also means a failed store mutation cannot leave a `result: "failure"` entry
 * behind: the rollback takes the entry with it. Establishment entries are
 * therefore always `"success"`, and the field is kept only because the table is
 * shared with the system operations, which run inside actions and *can* record
 * their own failures.
 */

/* ------------------------------------------------------------------ */
/* Actions & operations                                                */
/* ------------------------------------------------------------------ */

/** The `action` values establishment entries use. Mirrors the schema union. */
export const STORE_AUDIT_ACTIONS = {
  created: "store_created",
  updated: "store_updated",
  deleted: "store_deleted",
} as const

export type StoreAuditAction =
  (typeof STORE_AUDIT_ACTIONS)[keyof typeof STORE_AUDIT_ACTIONS]

/**
 * The specific mutation behind an entry, recorded inside `details`.
 *
 * Three actions rather than one per mutation: the reader filters on "what
 * happened to an establishment", and the twelve-way distinction belongs in the
 * detail, not in an index-backed enum that every UI would have to enumerate.
 */
export const STORE_AUDIT_OPERATIONS = {
  create: "create",
  update: "update",
  updateHours: "updateHours",
  updateOverrides: "updateOverrides",
  updateAddress: "updateAddress",
  updateBranding: "updateBranding",
  updatePrintConfig: "updatePrintConfig",
  updateStationMapping: "updateStationMapping",
  updateSoundConfig: "updateSoundConfig",
  updateOrderConfirmation: "updateOrderConfirmation",
  updateOrderMode: "updateOrderMode",
  updateTrendingMode: "updateTrendingMode",
  remove: "remove",
} as const

export type StoreAuditOperation =
  (typeof STORE_AUDIT_OPERATIONS)[keyof typeof STORE_AUDIT_OPERATIONS]

/* ------------------------------------------------------------------ */
/* Redaction                                                           */
/* ------------------------------------------------------------------ */

/** Written in place of a secret. */
export const REDACTED = "[redacted]"

/** Recorded as the actor when no session is attached to the mutation. */
export const SYSTEM_ACTOR = "system"

/**
 * Strip the printer API key out of a `printConfig` value.
 *
 * `stores.updatePrintConfig` carries a cloud-printer credential, and the app
 * wrappers already strip it from public reads. Copying it into a before/after
 * pair would smuggle it straight back out through the audit log, which is
 * readable by anyone holding `system:read`.
 */
function redactPrintConfig(value: unknown): unknown {
  if (!value || typeof value !== "object") return value
  const config = value as Record<string, unknown>
  if (config.apiKey === undefined) return value
  return { ...config, apiKey: REDACTED }
}

/**
 * Per-field redactors, keyed by store field name.
 *
 * A denylist is only safe because the fields reaching this module are the
 * declared arguments of the stores mutations — an enumerable, reviewed set —
 * and never a whole store document. Snapshots go through
 * `STORE_SNAPSHOT_FIELDS`, which is an allowlist for the same reason.
 */
const FIELD_REDACTORS: Record<string, (value: unknown) => unknown> = {
  printConfig: redactPrintConfig,
}

/** Redact one store field value for the audit log. */
export function redactAuditValue(field: string, value: unknown): unknown {
  const redactor = FIELD_REDACTORS[field]
  return redactor ? redactor(value) : value
}

/* ------------------------------------------------------------------ */
/* Snapshots & diffs                                                   */
/* ------------------------------------------------------------------ */

/**
 * The fields worth keeping when an establishment is created or deleted.
 *
 * An allowlist, not the whole document: `stores` still carries the legacy
 * `branding` / `integrations` / `settings` blobs typed `v.any()`, and an
 * integration blob is exactly where a third-party token would sit.
 */
export const STORE_SNAPSHOT_FIELDS = [
  "name",
  "slug",
  "status",
  "address",
  "phone",
  "email",
] as const

/** Take the allowlisted, redacted snapshot of a store document. */
export function snapshotStore(
  store: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {}
  if (!store) return snapshot
  for (const field of STORE_SNAPSHOT_FIELDS) {
    if (store[field] === undefined) continue
    snapshot[field] = redactAuditValue(field, store[field])
  }
  return snapshot
}

export interface FieldChange {
  before: unknown
  after: unknown
}

/** Structural equality for the JSON-shaped values a store document holds. */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== "object" || typeof b !== "object") return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((item, index) => isDeepEqual(item, b[index]))
  }

  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  // `{ a: 1, b: undefined }` and `{ a: 1 }` describe the same store, so compare
  // on defined keys only — otherwise clearing an already-absent optional field
  // would read as a change.
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (left[key] === undefined && right[key] === undefined) continue
    if (!isDeepEqual(left[key], right[key])) return false
  }
  return true
}

/**
 * The before/after pairs for the fields an update actually moved.
 *
 * Only the keys present in `after` are considered — those are the mutation's
 * own arguments — and a key whose value is unchanged is dropped, so the entry
 * says what the edit did rather than what the form submitted.
 */
export function diffStoreFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {}
  for (const [field, nextValue] of Object.entries(after)) {
    const previousValue = before?.[field]
    if (isDeepEqual(previousValue, nextValue)) continue
    changes[field] = {
      before: redactAuditValue(field, previousValue),
      after: redactAuditValue(field, nextValue),
    }
  }
  return changes
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

/** Longest `details` payload one entry may carry. */
export const MAX_DETAILS_LENGTH = 4000

export interface StoreAuditDetails {
  operation: StoreAuditOperation
  storeName?: string | undefined
  changes?: Record<string, FieldChange> | undefined
  snapshot?: Record<string, unknown> | undefined
}

/**
 * Serialise `details`, degrading rather than growing without bound.
 *
 * A store document is small today, but `hours` is an array and `overrides` a
 * nested object, and an audit row that can grow with its payload is an audit
 * row that can one day refuse to be written. Past the cap the values are
 * dropped and the field names kept, so the entry still answers "what was
 * touched" even when it can no longer answer "to what".
 */
export function serializeAuditDetails(
  details: StoreAuditDetails,
  maxLength: number = MAX_DETAILS_LENGTH,
): string {
  const full = JSON.stringify(details)
  if (full.length <= maxLength) return full

  const degraded = JSON.stringify({
    operation: details.operation,
    storeName: details.storeName,
    changedFields: Object.keys(details.changes ?? {}),
    snapshotFields: Object.keys(details.snapshot ?? {}),
    truncated: true,
  })
  return degraded.length <= maxLength ? degraded : degraded.slice(0, maxLength)
}

/* ------------------------------------------------------------------ */
/* Writing the entry                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resolve the actor behind the change.
 *
 * Every stores mutation is reached through the authorisation seam, so a real
 * caller always has an identity by the time a handler runs. The fallback covers
 * the internal paths — seeds, imports, scheduled jobs — that legitimately have
 * no session: those get `"system"` rather than an exception, because refusing
 * to write the change is worse than recording it without a name.
 */
async function resolveActor(ctx: {
  auth?: { getUserIdentity?: () => Promise<{ subject?: string } | null> }
}): Promise<string> {
  const identity = await ctx.auth?.getUserIdentity?.()
  return identity?.subject ?? SYSTEM_ACTOR
}

export interface StoreAuditEntry {
  action: StoreAuditAction
  operation: StoreAuditOperation
  /** `Id<"stores">`, typed loosely because this package has no data model. */
  storeId: unknown
  storeName?: string | undefined
  changes?: Record<string, FieldChange> | undefined
  snapshot?: Record<string, unknown> | undefined
}

/**
 * Append one establishment entry to `systemAuditLog`.
 *
 * Call it from inside the mutation that made the change, after the change, so
 * the two share a transaction.
 */
export async function recordStoreAudit(
  // `ctx: any` mirrors the rest of this package: the handlers cannot name an
  // app's generated MutationCtx without importing that app's data model.
  ctx: any,
  entry: StoreAuditEntry,
): Promise<void> {
  await ctx.db.insert("systemAuditLog", {
    action: entry.action,
    performedBy: await resolveActor(ctx),
    performedAt: Date.now(),
    targetStoreId: entry.storeId,
    result: "success" as const,
    details: serializeAuditDetails({
      operation: entry.operation,
      storeName: entry.storeName,
      changes: entry.changes,
      snapshot: entry.snapshot,
    }),
  })
}

/**
 * Build the entry for an `updateX` mutation from the document as it stands
 * *before* the patch.
 *
 * Deliberately pure, and deliberately separate from the write: the "before"
 * side has to be read off the pre-patch document, so the diff is computed while
 * that document is still the truth and only appended once the patch has gone
 * through. Handing `recordStoreAudit` a live document to diff after the fact is
 * how an audit trail ends up reporting that nothing changed.
 */
export function prepareStoreFieldUpdate(
  before: Record<string, unknown>,
  operation: StoreAuditOperation,
  after: Record<string, unknown>,
): StoreAuditEntry {
  return {
    action: STORE_AUDIT_ACTIONS.updated,
    operation,
    storeId: before._id,
    storeName: before.name as string | undefined,
    changes: diffStoreFields(before, after),
  }
}
