"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import QRCodeLib from "qrcode"
import {
  QrCodeIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  DownloadIcon,
  ScanIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react"
import {
  Badge,
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-yours/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { convexErrorMessage } from "../../lib/convex-error"

/**
 * QR codes to print and place on tables. Each card shows the real QR
 * (encoding the public game URL), the scan counter, and copy/download
 * actions — the piece that connects the admin to the customer game.
 */

interface QRCode {
  _id: string
  code: string
  tableNumber?: string
  location?: string
  gameType?: "wheel" | "scratch_card"
  isActive: boolean
  scannedCount?: number
}

function gameUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/game/${code}`
}

/** Renders the QR image for one code (data URL, 512px). */
function useQrDataUrl(code: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCodeLib.toDataURL(gameUrl(code), {
      width: 512,
      margin: 1,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [code])
  return dataUrl
}

function QRCodeCard({
  qr,
  onDelete,
  onSetActive,
}: {
  qr: QRCode
  onDelete: (id: string) => void
  onSetActive: (id: string, isActive: boolean) => void
}) {
  const dataUrl = useQrDataUrl(qr.code)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl(qr.code))
      toast.success("Lien du jeu copié")
    } catch {
      toast.error("Copie impossible — copiez le lien manuellement")
    }
  }

  const handleDownload = () => {
    if (!dataUrl) return
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `qr-jeu-${qr.tableNumber ? `table-${qr.tableNumber}` : qr.code}.png`
    link.click()
    toast.success("QR téléchargé — imprimez-le pour vos tables")
  }

  return (
    <div className="border border-border/50 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {qr.tableNumber ? `Table ${qr.tableNumber}` : "Sans table"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {qr.location ?? "Emplacement non précisé"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Supprimer le code QR"
          onClick={() => onDelete(qr._id)}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>

      {/*
        * The white plate exists so a scanner can read the QR; it is not a
        * surface for anything else. `--muted-foreground` inverts with the
        * theme, so the placeholder icon measured 2.54:1 on that fixed white in
        * dark mode. The placeholder gets a themed ground instead.
        */}
      <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-md border border-border/50 bg-muted p-1.5">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code ${qr.code}`} className="h-full w-full bg-white" />
        ) : (
          <QrCodeIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-semibold">{qr.code}</p>
        <div className="flex items-center gap-1.5">
          {qr.gameType && (
            <Badge variant="outline" className="text-[10px]">
              {qr.gameType === "wheel" ? "Roue" : "Grattage"}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] gap-1">
            <ScanIcon className="h-3 w-3" />
            {qr.scannedCount ?? 0} scan{(qr.scannedCount ?? 0) > 1 ? "s" : ""}
          </Badge>
          {!qr.isActive && (
            <Badge variant="outline" className="text-[10px]">
              Désactivé
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => void handleCopyLink()}>
          <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
          Lien
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={!dataUrl}>
          <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
          PNG
        </Button>
      </div>

      {/* A code that has been played cannot be deleted — the plays are the
          establishment's record of where consent was given. This is what the
          refusal tells the owner to do instead, so it has to be here. */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSetActive(qr._id, !qr.isActive)}
      >
        {qr.isActive ? (
          <>
            <PowerOffIcon className="mr-1.5 h-3.5 w-3.5" />
            Désactiver
          </>
        ) : (
          <>
            <PowerIcon className="mr-1.5 h-3.5 w-3.5" />
            Réactiver
          </>
        )}
      </Button>
    </div>
  )
}

export function GameQrCodesPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [code, setCode] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [location, setLocation] = useState("")

  const qrCodes = useQuery(api.gameQRCodes.list, storeId ? { storeId } : "skip") as
    | QRCode[]
    | undefined

  const createQRCode = useMutation(api.gameQRCodes.create)
  const removeQRCode = useMutation(api.gameQRCodes.remove)
  const setQRCodeActive = useMutation(api.gameQRCodes.setActive)

  const generateCode = () => {
    setCode(crypto.randomUUID().slice(0, 12).toUpperCase())
  }

  const handleAdd = async () => {
    if (!storeId) return
    const finalCode = code || crypto.randomUUID().slice(0, 12).toUpperCase()
    try {
      await createQRCode({
        storeId,
        code: finalCode,
        tableNumber: tableNumber.trim() || undefined,
        location: location.trim() || undefined,
        isActive: true,
      })
      toast.success("Code QR créé — téléchargez-le et posez-le sur la table")
      setIsAddOpen(false)
      setCode("")
      setTableNumber("")
      setLocation("")
    } catch (error) {
      toast.error("Échec de la création du code QR")
      console.error(error)
    }
  }

  const handleSetActive = async (id: string, isActive: boolean) => {
    try {
      await setQRCodeActive({ id, isActive })
      toast.success(
        isActive
          ? "Code QR réactivé"
          : "Code QR désactivé — le QR imprimé ne fonctionne plus, les parties déjà jouées restent"
      )
    } catch (error) {
      toast.error(convexErrorMessage(error, "Échec de la mise à jour du code QR"))
      console.error(error)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await removeQRCode({ id })
      toast.success("Code QR supprimé")
    } catch (error) {
      // The refusal says the code has been played and that deactivating it
      // retires it without touching those plays. Retrying cannot help.
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  if (!storeId) {
    return (
      <Empty className="min-h-[400px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <QrCodeIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer les codes QR</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (qrCodes === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Codes QR</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Un QR par table : vos clients le scannent pour jouer. Téléchargez, imprimez, posez.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Créer un code QR
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau code QR</DialogTitle>
              <DialogDescription>
                Le code est généré automatiquement ; précisez la table pour vous y retrouver.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qrTable">Numéro de table</Label>
                  <Input
                    id="qrTable"
                    placeholder="12"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qrLocation">Emplacement</Label>
                  <Input
                    id="qrLocation"
                    placeholder="Terrasse"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qrCode">Code (optionnel)</Label>
                <div className="flex gap-2">
                  <Input
                    id="qrCode"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Auto-généré si vide"
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={generateCode}>
                    Générer
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={() => void handleAdd()}>Créer le code QR</Button>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {qrCodes.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <QrCodeIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun code QR</EmptyTitle>
            <EmptyDescription>
              Créez un code par table : c&apos;est la porte d&apos;entrée du jeu pour vos clients.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {qrCodes.map((qr) => (
            <QRCodeCard
              key={qr._id}
              qr={qr}
              onDelete={setDeletingId}
              onSetActive={(id, isActive) => void handleSetActive(id, isActive)}
            />
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        title="Supprimer ce code QR ?"
        description="Le QR imprimé ne fonctionnera plus. Cette action est irréversible. Si des parties ont déjà été jouées avec ce code, désactivez-le plutôt : elles restent, et le QR cesse aussitôt de fonctionner."
        isDeleting={isDeleting}
      />
    </div>
  )
}
