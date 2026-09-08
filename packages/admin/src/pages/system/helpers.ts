import type { MigrationRequestStatus } from "./types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Every action the journal can hold, in the order the filter offers them.
 *
 * One list, not two. The dropdown used to hard-code its own copy of these
 * labels next to `formatActionLabel`'s, and the two had already drifted. Now
 * both read from here, and a test checks the list against the schema — so an
 * action added to `systemAuditLog` without a label fails a build instead of
 * reaching an operator as a raw `store_updated`.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  backup_export: "Export backup",
  backup_import: "Import backup",
  backup_import_dryrun: "Import (aperçu)",
  migration_run: "Migration",
  version_check: "Verification version",
  lock_force_release: "Deverrouillage force",
  maintenance_contract_set: "Contrat maintenance",
  migration_request_created: "Demande de migration",
  migration_request_status_changed: "Migration (statut)",
  store_created: "Établissement créé",
  store_updated: "Établissement modifié",
  store_deleted: "Établissement supprimé",
  access_granted: "Accès accordé",
  access_changed: "Accès modifié",
  access_revoked: "Accès retiré",
  privacy_export: "Export RGPD",
  privacy_erasure: "Effacement RGPD",
  privacy_retention_sweep: "Purge automatique",
  payment_collection_refused: "Encaissement refusé",
}

export function formatActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

/**
 * Render the `details` column.
 *
 * Establishment entries carry a JSON payload — the operation, the
 * establishment, and the fields the edit moved. Printed raw it is a wall of
 * braces in a truncated cell, so it is unpacked into one line here. Anything
 * else keeps the old behaviour: the string as stored.
 */
export function formatAuditDetails(entry: {
  details?: string
  errorMessage?: string
}): string {
  if (entry.errorMessage) return entry.errorMessage
  if (!entry.details) return "—"

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(entry.details) as Record<string, unknown>
  } catch {
    return entry.details
  }
  if (!payload || typeof payload.operation !== "string") return entry.details

  const parts: string[] = []
  if (typeof payload.storeName === "string" && payload.storeName) {
    parts.push(payload.storeName)
  }
  parts.push(payload.operation)

  // `changedFields` is the degraded form written when a payload outgrew the
  // size cap; `changes` is the normal one.
  const fields = Array.isArray(payload.changedFields)
    ? (payload.changedFields as string[])
    : payload.changes && typeof payload.changes === "object"
      ? Object.keys(payload.changes as Record<string, unknown>)
      : null

  if (fields) {
    parts.push(fields.length > 0 ? fields.join(", ") : "aucun changement")
  }

  return parts.join(" · ")
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export const MIGRATION_SCOPE_LABELS: Record<string, string> = {
  code: "Code du site",
  database: "Base de données",
  assets: "Medias & fichiers (S3)",
  domain: "Nom de domaine",
  emails: "Emails & templates",
}

export const MIGRATION_STATUS_LABELS: Record<MigrationRequestStatus, string> = {
  pending: "En attente",
  acknowledged: "Prise en compte",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulee",
  declined: "Refusee",
}
