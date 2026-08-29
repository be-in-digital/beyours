"use client"

import { useQuery } from "convex/react"
import { toast } from "sonner"
import { useEffect } from "react"
import { ServerIcon } from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { APP_VERSION } from "../../lib/constants"
import type { SystemInfo, MaintenanceOverview } from "./types"
import { SystemInfoSection } from "./system-info-section"
import { MaintenanceSection } from "./maintenance-section"
import { UpdatesSection } from "./updates-section"
import { BackupSection } from "./backup-section"
import { MigrationsSection } from "./db-migrations-section"
import { AuditLogSection } from "./audit-log-section"
import { ForceUnlockButton } from "./force-unlock-button"

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SystemPage() {
  const { api } = useAdminApiStore()

  const systemInfo = useQuery(
    api?.system?.getSystemInfo ?? "skip",
    api?.system ? {} : "skip"
  ) as
    | SystemInfo
    | undefined

  const maintenanceOverview = useQuery(
    api?.maintenance?.getOverview ?? "skip",
    api?.maintenance ? { currentVersion: APP_VERSION } : "skip"
  ) as MaintenanceOverview | undefined

  // Back from Stripe Checkout (?maintenance=success) — the contract itself
  // is updated by the webhook and refreshes live via the reactive query
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("maintenance") === "success") {
      toast.success(
        "Renouvellement de la maintenance active. La couverture se met a jour d'ici quelques instants."
      )
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  if (systemInfo === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Système</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centre de contrôle système
          </p>
        </div>
        <LoadingState variant="form" count={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ServerIcon className="h-6 w-6" />
            Systeme
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maintenance, mises a jour, sauvegardes et journal d'activite
          </p>
        </div>
        <ForceUnlockButton info={systemInfo} />
      </div>

      {/* System Info Cards */}
      <SystemInfoSection info={systemInfo} overview={maintenanceOverview} />

      {/* Tabbed Sections */}
      <Tabs defaultValue="maintenance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="updates">Mises a jour</TabsTrigger>
          <TabsTrigger value="backup">Sauvegarde</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance">
          <MaintenanceSection overview={maintenanceOverview} />
        </TabsContent>

        <TabsContent value="updates">
          <UpdatesSection overview={maintenanceOverview} />
        </TabsContent>

        <TabsContent value="backup">
          <BackupSection />
        </TabsContent>

        <TabsContent value="migrations">
          <MigrationsSection info={systemInfo} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
