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

export function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    backup_export: "Export backup",
    backup_import: "Import backup",
    backup_import_dryrun: "Import (aperçu)",
    migration_run: "Migration",
    version_check: "Verification version",
    lock_force_release: "Deverrouillage force",
    maintenance_contract_set: "Contrat maintenance",
    migration_request_created: "Demande de migration",
    migration_request_status_changed: "Migration (statut)",
  }
  return labels[action] ?? action
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
