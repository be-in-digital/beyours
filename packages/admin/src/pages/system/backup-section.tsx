"use client"

import { useAction } from "convex/react"
import { toast } from "sonner"
import { useState, useCallback } from "react"
import {
  DownloadIcon,
  UploadIcon,
  Loader2,
  DatabaseIcon,
} from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@be-in-digital/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"

// ─── Section: Backup & Restore ───────────────────────────────────────────────

export function BackupSection() {
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
      toast.success("Backup exporté avec succès")
    } catch {
      toast.error("Échec de l'export")
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
            : "Échec de l'aperçu"
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
            Exportez ou importez vos données. Les images S3 ne sont pas incluses — seules les references/URLs sont sauvegardees.
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
            L'import effectue d'abord un aperçu (dry run) avant toute modification.
          </p>
        </CardContent>
      </Card>

      {/* Import confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!importing) setConfirmDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'import</DialogTitle>
            <DialogDescription>
              Ceci va remplacer toutes les données existantes. Cette action est irréversible.
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
