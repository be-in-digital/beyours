"use client"

import { useState, useRef } from "react"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  Button,
  ButtonGroup,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@be-in-digital/ui"
import { parseSubscriberCsv } from "@be-in-digital/marketing"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"

type ImportStep = "upload" | "preview" | "importing" | "done"

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const importMutation = useMutation(api?.emailSubscribers?.importBatch)

  const [step, setStep] = useState<ImportStep>("upload")
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseSubscriberCsv> | null>(null)
  const [fileName, setFileName] = useState("")
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("upload")
      setParseResult(null)
      setFileName("")
      setImportResult(null)
    }
    onOpenChange(open)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== "string") return
      const result = parseSubscriberCsv(text)
      setParseResult(result)
      setStep("preview")
    }
    reader.readAsText(file, "utf-8")
  }

  const handleImport = async () => {
    if (!storeId || !parseResult) return
    setStep("importing")

    try {
      const subscribers = parseResult.subscribers.map((s) => ({
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        tags: s.tags ?? [],
        source: "import" as const,
        storeId,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await importMutation({ storeId, subscribers }) as any
      setImportResult({
        imported: result?.imported ?? parseResult.validRows,
        skipped: result?.skipped ?? 0,
      })
      setStep("done")
      toast.success(`${result?.imported ?? parseResult.validRows} abonnés importés`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de l'import : ${message}`)
      setStep("preview")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer des abonnés (CSV)</DialogTitle>
          <DialogDescription>
            Colonnes supportées : email, prénom, nom, tags (séparés par virgule ou point-virgule)
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Cliquez pour sélectionner un fichier CSV</p>
                <p className="text-xs text-muted-foreground mt-1">ou glissez-déposez ici</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground text-center">
              La première ligne doit contenir les en-têtes de colonnes
            </p>
          </div>
        )}

        {step === "preview" && parseResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xl font-bold">{parseResult.totalRows}</p>
                <p className="text-xs text-muted-foreground">Total lignes</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 text-center">
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{parseResult.validRows}</p>
                <p className="text-xs text-muted-foreground">Valides</p>
              </div>
              <div className="rounded-lg bg-orange-50 dark:bg-orange-950 p-3 text-center">
                <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{parseResult.skippedRows}</p>
                <p className="text-xs text-muted-foreground">Ignorées</p>
              </div>
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {parseResult.errors.length} erreur(s)
                  </span>
                </div>
                <ul className="space-y-1">
                  {parseResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i} className="text-xs text-orange-700 dark:text-orange-300">
                      Ligne {err.row} : {err.message}
                    </li>
                  ))}
                  {parseResult.errors.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      ... et {parseResult.errors.length - 5} autres erreurs
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview of first 3 rows */}
            {parseResult.subscribers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Aperçu ({Math.min(3, parseResult.subscribers.length)} premières lignes)</p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Email</th>
                        <th className="px-3 py-2 text-left font-medium">Prénom</th>
                        <th className="px-3 py-2 text-left font-medium">Nom</th>
                        <th className="px-3 py-2 text-left font-medium">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.subscribers.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{row.email}</td>
                          <td className="px-3 py-2">{row.firstName ?? "-"}</td>
                          <td className="px-3 py-2">{row.lastName ?? "-"}</td>
                          <td className="px-3 py-2">{row.tags?.join(", ") ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <ButtonGroup>
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Retour
                </Button>
                <Button onClick={handleImport} disabled={parseResult.validRows === 0}>
                  Importer {parseResult.validRows} abonné{parseResult.validRows > 1 ? "s" : ""}
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Import en cours...</p>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <p className="font-semibold">{importResult.imported} abonné{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}</p>
                {importResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.skipped} ignoré{importResult.skipped > 1 ? "s" : ""} (déjà existants ou invalides)
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <Badge variant="default">{importResult.imported} importés</Badge>
                {importResult.skipped > 0 && (
                  <Badge variant="secondary">{importResult.skipped} ignorés</Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Les emails de confirmation (double opt-in) seront envoyés automatiquement
            </p>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
