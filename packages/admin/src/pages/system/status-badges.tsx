import {
  ShieldCheckIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from "lucide-react"
import { Badge } from "@be-yours/ui"
import type { MaintenanceStatus, MigrationRequestStatus } from "./types"
import { MIGRATION_STATUS_LABELS } from "./helpers"

export function MigrationStatusBadge({ status }: { status: MigrationRequestStatus }) {
  const styles: Record<MigrationRequestStatus, string> = {
    pending: "bg-warning/10 text-warning",
    acknowledged: "bg-sky-500/10 text-sky-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    completed: "bg-success/10 text-success",
    cancelled: "bg-muted text-muted-foreground",
    declined: "bg-destructive/10 text-destructive",
  }
  return (
    <Badge variant="secondary" className={styles[status]}>
      {MIGRATION_STATUS_LABELS[status]}
    </Badge>
  )
}

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  if (status === "active") {
    return (
      <Badge variant="secondary" className="bg-success/10 text-success">
        <ShieldCheckIcon className="h-3 w-3 mr-1" />
        Maintenance active
      </Badge>
    )
  }
  if (status === "expiring_soon") {
    return (
      <Badge variant="secondary" className="bg-warning/10 text-warning">
        <AlertTriangleIcon className="h-3 w-3 mr-1" />
        Expire bientôt
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
        <XCircleIcon className="h-3 w-3 mr-1" />
        Maintenance expirée
      </Badge>
    )
  }
  return <Badge variant="secondary">Aucun contrat</Badge>
}
