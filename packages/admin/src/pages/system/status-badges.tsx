import {
  ShieldCheckIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from "lucide-react"
import { Badge } from "@be-in-digital/ui"
import type { MaintenanceStatus, MigrationRequestStatus } from "./types"
import { MIGRATION_STATUS_LABELS } from "./helpers"

export function MigrationStatusBadge({ status }: { status: MigrationRequestStatus }) {
  const styles: Record<MigrationRequestStatus, string> = {
    pending: "bg-amber-500/10 text-amber-500",
    acknowledged: "bg-sky-500/10 text-sky-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    completed: "bg-emerald-500/10 text-emerald-500",
    cancelled: "bg-muted text-muted-foreground",
    declined: "bg-red-500/10 text-red-500",
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
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
        <ShieldCheckIcon className="h-3 w-3 mr-1" />
        Maintenance active
      </Badge>
    )
  }
  if (status === "expiring_soon") {
    return (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
        <AlertTriangleIcon className="h-3 w-3 mr-1" />
        Expire bientot
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-500">
        <XCircleIcon className="h-3 w-3 mr-1" />
        Maintenance expiree
      </Badge>
    )
  }
  return <Badge variant="secondary">Aucun contrat</Badge>
}
