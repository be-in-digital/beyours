"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, useCallback, useRef } from "react"
import {
  ServerIcon,
  DownloadIcon,
  UploadIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  HistoryIcon,
  LockIcon,
  UnlockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2,
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
} from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { APP_VERSION } from "../../lib/constants"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SystemInfo {
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

interface AuditEntry {
  _id: string
  action: string
  performedBy: string
  performedAt: number
  details?: string
  result: "success" | "failure"
  errorMessage?: string
}

interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    backup_export: "Export backup",
    backup_import: "Import backup",
    backup_import_dryrun: "Import (apercu)",
    migration_run: "Migration",
    version_check: "Verification version",
    lock_force_release: "Deverrouillage force",
  }
  return labels[action] ?? action
}

// ─── Section: System Info ────────────────────────────────────────────────────

function SystemInfoSection({ info }: { info: SystemInfo }) {
  const versionMismatch =
    info.deployedAppVersion !== null && info.deployedAppVersion !== APP_VERSION

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <CardDescription>Verrou systeme</CardDescription>
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

// ─── Section: Updates ────────────────────────────────────────────────────────

function UpdatesSection() {
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
      if (result.hasUpdate) {
        toast.success(`Nouvelle version disponible : ${result.latestVersion}`)
      } else {
        toast.success("Vous etes a jour")
      }
    } catch {
      toast.error("Echec de la verification")
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
      toast.error("Echec de la synchronisation")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCwIcon className="h-5 w-5" />
          Mises a jour
        </CardTitle>
        <CardDescription>
          Verifiez si une nouvelle version est disponible sur GitHub Packages
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
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              {updateResult.hasUpdate ? (
                <Badge variant="default" className="bg-amber-500">
                  Mise a jour disponible
                </Badge>
              ) : (
                <Badge variant="secondary">A jour</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Version actuelle : <span className="font-mono">{updateResult.currentVersion}</span>
              {" — "}
              Derniere version : <span className="font-mono">{updateResult.latestVersion}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Backup & Restore ───────────────────────────────────────────────

function BackupSection() {
  const { api } = useAdminApiStore()
  const exportBackup = useAction(api?.system?.exportBackup)
  const importBackup = useAction(api?.system?.importBackup)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<{
    summary: Record<string, number>
    totalRows: number
  } | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    manifest: unknown
    data: unknown
  } | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const handleExport = async () => {
    if (!api?.system || !exportBackup) return
    setExporting(true)
    try {
      const result = await exportBackup({})
      // Download as JSON
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Backup exporte avec succes")
    } catch {
      toast.error("Echec de l'export")
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!api?.system || !importBackup) return
      const file = event.target.files?.[0]
      if (!file) return

      const MAX_BACKUP_SIZE = 50 * 1024 * 1024 // 50MB
      if (file.size > MAX_BACKUP_SIZE) {
        toast.error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum : 50 MB.`)
        return
      }
      if (file.type && file.type !== "application/json") {
        toast.error("Type de fichier invalide. Un fichier JSON est attendu.")
        return
      }

      try {
        const text = await file.text()
        const parsed = JSON.parse(text)

        if (!parsed.manifest || !parsed.data) {
          toast.error("Format de backup invalide")
          return
        }

        // Dry run first
        setImporting(true)
        const result = await importBackup({
          manifest: parsed.manifest,
          data: parsed.data,
          dryRun: true,
        })

        setDryRunResult({
          summary: result.summary,
          totalRows: result.totalRows,
        })
        setPendingImport({ manifest: parsed.manifest, data: parsed.data })
        setConfirmDialogOpen(true)
      } catch (error) {
        toast.error(
          error instanceof SyntaxError
            ? "Fichier JSON invalide"
            : "Echec de l'apercu"
        )
      } finally {
        setImporting(false)
        // Reset file input
        event.target.value = ""
      }
    },
    [api?.system, importBackup]
  )

  const handleConfirmImport = async () => {
    if (!pendingImport || !importBackup) return
    setImporting(true)
    try {
      const result = await importBackup({
        manifest: pendingImport.manifest,
        data: pendingImport.data,
        dryRun: false,
      })
      toast.success(`Import termine : ${result.totalRows} lignes importees`)
      setPendingImport(null)
      setDryRunResult(null)
      setConfirmDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import")
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5" />
            Sauvegarde & Restauration
          </CardTitle>
          <CardDescription>
            Exportez ou importez vos donnees. Les images S3 ne sont pas incluses — seules les references/URLs sont sauvegardees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleExport} disabled={exporting || !api?.system}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DownloadIcon className="h-4 w-4 mr-2" />
              )}
              Exporter un backup
            </Button>

            <Button variant="outline" asChild disabled={importing || !api?.system}>
              <label className="cursor-pointer">
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UploadIcon className="h-4 w-4 mr-2" />
                )}
                Importer un backup
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={importing}
                />
              </label>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            L'import effectue d'abord un apercu (dry run) avant toute modification.
          </p>
        </CardContent>
      </Card>

      {/* Import confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!importing) setConfirmDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'import</DialogTitle>
            <DialogDescription>
              Ceci va remplacer toutes les donnees existantes. Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>

          {dryRunResult && (
            <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              <p className="text-sm font-medium">
                Resume : {dryRunResult.totalRows} lignes au total
              </p>
              <div className="space-y-1">
                {Object.entries(dryRunResult.summary).map(([table, count]) => (
                  <div
                    key={table}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span className="font-mono">{table}</span>
                    <span>{count} lignes</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={importing}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirmImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {importing ? "Import en cours..." : "Confirmer l'import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Section: Migrations ─────────────────────────────────────────────────────

function MigrationsSection({ info }: { info: SystemInfo }) {
  const { api } = useAdminApiStore()
  const runMigrations = useAction(api?.system?.runMigrations)
  const [running, setRunning] = useState(false)

  const handleRun = async () => {
    if (!api?.system || !runMigrations) return
    setRunning(true)
    try {
      const result = await runMigrations({})
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Echec des migrations")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5" />
          Migrations
        </CardTitle>
        <CardDescription>
          Gerez les migrations de donnees de votre application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRun} disabled={running || !api?.system}>
          {running && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Executer les migrations en attente
        </Button>

        {info.appliedMigrations.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Appliquee le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.appliedMigrations.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(m.appliedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune migration appliquee</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Audit Log ──────────────────────────────────────────────────────

function AuditLogSection() {
  const { api } = useAdminApiStore()
  const [filterAction, setFilterAction] = useState<string>("all")
  const [cursor, setCursor] = useState<string | null>(null)
  const PAGE_SIZE = 10

  const auditLog = useQuery(
    api?.system?.getAuditLog ?? "skip",
    api?.system ? {
      paginationOpts: { cursor, numItems: PAGE_SIZE },
      filterAction: filterAction === "all" ? undefined : filterAction,
    } : "skip"
  ) as
    | {
        page: AuditEntry[]
        continueCursor: string | null
        isDone: boolean
      }
    | undefined

  const handlePrev = () => {
    // Simple approach: go back to the beginning
    setCursor(null)
  }

  const handleNext = () => {
    if (auditLog?.continueCursor) {
      setCursor(auditLog.continueCursor)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Journal d'activite
            </CardTitle>
            <CardDescription>
              Historique des operations systeme
            </CardDescription>
          </div>
          <Select
            value={filterAction}
            onValueChange={(val) => {
              setFilterAction(val)
              setCursor(null)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrer par action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              <SelectItem value="backup_export">Export backup</SelectItem>
              <SelectItem value="backup_import">Import backup</SelectItem>
              <SelectItem value="backup_import_dryrun">Import (apercu)</SelectItem>
              <SelectItem value="migration_run">Migration</SelectItem>
              <SelectItem value="version_check">Verification version</SelectItem>
              <SelectItem value="lock_force_release">Deverrouillage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {auditLog === undefined ? (
          <LoadingState variant="table" count={5} />
        ) : auditLog.page.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune entree dans le journal
          </p>
        ) : (
          <>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resultat</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.page.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <span className="text-sm">{formatActionLabel(entry.action)}</span>
                      </TableCell>
                      <TableCell>
                        {entry.result === "success" ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-500"
                          >
                            <CheckCircle2Icon className="h-3 w-3 mr-1" />
                            Succes
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-red-500/10 text-red-500"
                          >
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Echec
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatTimestamp(entry.performedAt)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {entry.errorMessage ?? entry.details ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={!cursor}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Debut
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={auditLog.isDone}
              >
                Suivant
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Force Unlock ───────────────────────────────────────────────────

function ForceUnlockButton({ info }: { info: SystemInfo }) {
  const { api } = useAdminApiStore()
  const forceRelease = useMutation(api?.system?.forceReleaseLock)
  const [releasing, setReleasing] = useState(false)
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false)

  if (!info.systemLock) return null

  const handleRelease = async () => {
    if (!api?.system || !forceRelease) return
    setReleasing(true)
    try {
      await forceRelease({})
      toast.success("Verrou systeme libere")
      setConfirmUnlockOpen(false)
    } catch {
      toast.error("Echec du deverrouillage")
    } finally {
      setReleasing(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirmUnlockOpen(true)}
        disabled={releasing || !api?.system}
      >
        <UnlockIcon className="h-4 w-4 mr-2" />
        Forcer le deverrouillage
      </Button>

      <AlertDialog open={confirmUnlockOpen} onOpenChange={setConfirmUnlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le deverrouillage</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va forcer la liberation du verrou systeme. Si une operation est en cours, elle pourrait etre corrompue. Etes-vous sur de vouloir continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releasing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRelease()
              }}
              disabled={releasing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {releasing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer le deverrouillage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SystemPage() {
  const { api } = useAdminApiStore()

  const systemInfo = useQuery(
    api?.system?.getSystemInfo ?? "skip",
    api?.system ? {} : "skip"
  ) as
    | SystemInfo
    | undefined

  if (systemInfo === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Systeme</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centre de controle systeme
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
            Version, sauvegardes, migrations et journal d'activite
          </p>
        </div>
        <ForceUnlockButton info={systemInfo} />
      </div>

      {/* System Info Cards */}
      <SystemInfoSection info={systemInfo} />

      {/* Tabbed Sections */}
      <Tabs defaultValue="updates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="updates">Mises a jour</TabsTrigger>
          <TabsTrigger value="backup">Sauvegarde</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="updates">
          <UpdatesSection />
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
