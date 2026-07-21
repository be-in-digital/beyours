// ─── Types ───────────────────────────────────────────────────────────────────

export interface SystemInfo {
  deployedAppVersion: string | null
  backupFormatVersion: string
  appliedMigrations: Array<{ id: string; name: string; appliedAt: number }>
  systemLock: {
    operation: string
    lockedBy: string
    lockedAt: number
    expiresAt: number
  } | null
  isLockActive: boolean
  lastBackupAt: number | null
}

export interface AuditEntry {
  _id: string
  action: string
  performedBy: string
  performedAt: number
  details?: string
  result: "success" | "failure"
  errorMessage?: string
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  entitledVersion: string | null
  hasEntitledUpdate: boolean
  lockedVersions: string[]
  maintenanceStatus: MaintenanceStatus
  coveredUntil: number | null
  registryError: string | null
}

export type MaintenanceStatus = "none" | "active" | "expiring_soon" | "expired"

export type MigrationRequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined"

export interface MigrationRequest {
  _id: string
  requestedBy: string
  contactEmail: string
  contactPhone?: string
  targetProvider: string
  targetTeam?: string
  targetTeamEmail?: string
  scope: string[]
  preferredDate?: number
  notes?: string
  status: MigrationRequestStatus
  statusHistory: Array<{
    status: MigrationRequestStatus
    changedAt: number
    changedBy: string
    note?: string
  }>
  createdAt: number
}

export interface MaintenanceOverview {
  contract: {
    startedAt: number
    coveredUntil: number
    autoRenew: boolean
    lastRenewedAt?: number
    notes?: string
  } | null
  status: MaintenanceStatus
  daysRemaining: number
  currentVersion: string
  entitlement: {
    latestVersion: string | null
    entitledVersion: string | null
    hasUpdate: boolean
    hasEntitledUpdate: boolean
    lockedVersions: string[]
    maintenanceStatus: MaintenanceStatus
  }
  releases: Array<{
    _id: string
    version: string
    releasedAt: number
    notes: string | null
    covered: boolean
  }>
  openMigrationRequest: MigrationRequest | null
}
