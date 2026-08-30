"use client"

import { useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import {
  RefreshCwIcon,
  LockIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Loader2,
} from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-in-digital/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { APP_VERSION } from "../../lib/constants"
import type { MaintenanceOverview, UpdateCheckResult } from "./types"
import { formatDate } from "./helpers"
import { RenewalCta } from "./maintenance-section"

// ─── Section: Updates ────────────────────────────────────────────────────────

export function UpdatesSection({
  overview,
}: {
  overview: MaintenanceOverview | undefined
}) {
  const { api } = useAdminApiStore()
  const checkForUpdates = useAction(api?.system?.checkForUpdates)
  const syncVersion = useMutation(api?.system?.syncVersion)
  const [checking, setChecking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)

  const handleCheck = async () => {
    if (!api?.system || !checkForUpdates) return
    setChecking(true)
    try {
      const result = await checkForUpdates({ currentVersion: APP_VERSION })
      setUpdateResult(result)
      if (result.hasEntitledUpdate) {
        toast.success(
          `Nouvelle version disponible : ${result.entitledVersion}`
        )
      } else if (result.hasUpdate) {
        toast.warning(
          "Une version plus recente existe mais n'est pas couverte par votre maintenance"
        )
      } else {
        toast.success("Vous êtes à jour")
      }
    } catch {
      toast.error("Échec de la vérification")
    } finally {
      setChecking(false)
    }
  }

  const handleSync = async () => {
    if (!api?.system || !syncVersion) return
    setSyncing(true)
    try {
      await syncVersion({ version: APP_VERSION })
      toast.success("Version synchronisee en base")
    } catch {
      toast.error("Échec de la synchronisation")
    } finally {
      setSyncing(false)
    }
  }

  const releases = overview?.releases ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCwIcon className="h-5 w-5" />
          Mises a jour
        </CardTitle>
        <CardDescription>
          Les mises à jour publiées pendant votre période de maintenance sont
          incluses. Celles publiées après la fin de couverture restent
          verrouillees jusqu'au renouvellement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCheck} disabled={checking || !api?.system}>
            {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Verifier les mises a jour
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing || !api?.system}>
            {syncing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Synchroniser la version en base
          </Button>
        </div>

        {updateResult && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {updateResult.hasEntitledUpdate ? (
                <Badge variant="default" className="bg-emerald-500">
                  Mise a jour disponible
                </Badge>
              ) : updateResult.hasUpdate ? (
                <Badge variant="default" className="bg-amber-500">
                  <LockIcon className="h-3 w-3 mr-1" />
                  Mise a jour verrouillee
                </Badge>
              ) : (
                <Badge variant="secondary">A jour</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Version actuelle : <span className="font-mono">{updateResult.currentVersion}</span>
              {" — "}
              Derniere version publiee : <span className="font-mono">{updateResult.latestVersion}</span>
              {updateResult.entitledVersion && (
                <>
                  {" — "}
                  Derniere version couverte :{" "}
                  <span className="font-mono">{updateResult.entitledVersion}</span>
                </>
              )}
            </p>
            {updateResult.hasUpdate && !updateResult.hasEntitledUpdate && (
              <div className="space-y-2">
                <p className="text-sm text-amber-500 flex items-center gap-1">
                  <AlertTriangleIcon className="h-3 w-3" />
                  {updateResult.coveredUntil
                    ? `Version publiée après la fin de votre maintenance (${formatDate(updateResult.coveredUntil)}).`
                    : "Aucun contrat de maintenance actif : les mises à jour ne sont pas accessibles."}
                </p>
                <RenewalCta />
              </div>
            )}
            {updateResult.registryError ? (
              <p className="text-xs text-muted-foreground">
                Registre indisponible ({updateResult.registryError}) —
                résultat basé sur le catalogue local.
              </p>
            ) : updateResult.registryConfigured === false ? (
              // Not an error: nothing was asked. Saying "registre inaccessible"
              // here blamed a registry no deployment had ever pointed at.
              <p className="text-xs text-muted-foreground">
                Aucun canal de mise à jour configuré — résultat basé sur le
                catalogue local.
              </p>
            ) : null}
          </div>
        )}

        {releases.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Publiee le</TableHead>
                  <TableHead>Acces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.slice(0, 8).map((release) => (
                  <TableRow key={release._id}>
                    <TableCell className="font-mono text-xs">
                      {release.version}
                      {release.version === APP_VERSION && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          installee
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(release.releasedAt)}
                    </TableCell>
                    <TableCell>
                      {release.covered ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-500"
                        >
                          <CheckCircle2Icon className="h-3 w-3 mr-1" />
                          Couverte
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-500"
                        >
                          <LockIcon className="h-3 w-3 mr-1" />
                          Verrouillee
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
