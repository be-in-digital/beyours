import {
  AlertTriangleIcon,
  Loader2,
  LockIcon,
  UnlockIcon,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@be-in-digital/ui"
import { APP_VERSION } from "../../lib/constants"
import type { SystemInfo, MaintenanceOverview } from "./types"
import { formatDate, formatTimestamp } from "./helpers"
import { MaintenanceStatusBadge } from "./status-badges"

// ─── Section: System Info ────────────────────────────────────────────────────

export function SystemInfoSection({
  info,
  overview,
}: {
  info: SystemInfo
  overview: MaintenanceOverview | undefined
}) {
  const versionMismatch =
    info.deployedAppVersion !== null && info.deployedAppVersion !== APP_VERSION

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Version runtime</CardDescription>
          <CardTitle className="text-2xl font-mono">{APP_VERSION}</CardTitle>
        </CardHeader>
        <CardContent>
          {versionMismatch ? (
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <AlertTriangleIcon className="h-3 w-3" />
              Snapshot DB : {info.deployedAppVersion}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Synchronise avec la base</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Maintenance</CardDescription>
          <CardTitle className="text-2xl">
            {overview === undefined ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MaintenanceStatusBadge status={overview.status} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview?.contract ? (
            <p className="text-xs text-muted-foreground">
              {overview.status === "expired"
                ? `Terminee le ${formatDate(overview.contract.coveredUntil)}`
                : `Couverte jusqu'au ${formatDate(overview.contract.coveredUntil)}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucun contrat enregistre
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Format de backup</CardDescription>
          <CardTitle className="text-2xl font-mono">{info.backupFormatVersion}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Dernier backup : {info.lastBackupAt ? formatTimestamp(info.lastBackupAt) : "Aucun"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Verrou système</CardDescription>
          <CardTitle className="text-2xl">
            {info.isLockActive ? (
              <span className="flex items-center gap-2 text-amber-500">
                <LockIcon className="h-5 w-5" /> Verrouille
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-500">
                <UnlockIcon className="h-5 w-5" /> Libre
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {info.systemLock ? (
            <p className="text-xs text-muted-foreground">
              {info.systemLock.operation} par {info.systemLock.lockedBy}
              {!info.isLockActive && " (expire)"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune operation en cours</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
