"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useCallback, useRef } from "react"
import { QrCodeIcon, PlusIcon, MoreVertical, Edit, Trash2, Download, Eye, Gamepad2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Switch,
  Badge,
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
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"

interface QRCode {
  _id: string
  code: string
  gameType?: "wheel" | "scratch_card"
  tableNumber?: string
  location?: string
  isActive: boolean
}

interface Game {
  _id: string
  type: "wheel" | "scratch_card"
  name: string
  isActive: boolean
}

const GAME_TYPE_LABELS: Record<string, string> = {
  wheel: "Roue de la fortune",
  scratch_card: "Ticket à gratter",
}

function getGameUrl(storeSlug: string, gameType?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const base = `${origin}/game/${storeSlug}`
  return gameType ? `${base}?game=${gameType}` : base
}

function downloadQRCode(svgElement: SVGSVGElement, filename: string) {
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  const img = new Image()
  img.onload = () => {
    canvas.width = img.width
    canvas.height = img.height
    ctx?.drawImage(img, 0, 0)
    const link = document.createElement("a")
    link.download = `${filename}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }
  img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
}

export function QRCodesPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQR, setEditingQR] = useState<QRCode | null>(null)
  const [deletingQRId, setDeletingQRId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewQR, setPreviewQR] = useState<QRCode | null>(null)
  const previewSvgRef = useRef<SVGSVGElement>(null)

  const [qrCode, setQrCode] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [location, setLocation] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [gameType, setGameType] = useState<"wheel" | "scratch_card" | "">("")

  const qrCodes = useQuery(api.gameQRCodes.list, storeId ? { storeId } : "skip") as QRCode[] | undefined
  const store = useQuery(api.stores.getById, storeId ? { id: storeId } : "skip") as { slug?: string } | undefined
  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as Game[] | undefined
  const activeGames = games?.filter((g) => g.isActive) ?? []

  const storeSlug = store?.slug ?? ""

  const createQRCode = useMutation(api.gameQRCodes.create)
  const updateQRCode = useMutation(api.gameQRCodes.update)
  const removeQRCode = useMutation(api.gameQRCodes.remove)

  const handleDownload = useCallback((qr: QRCode) => {
    const svg = document.querySelector(`[data-qr-id="${qr._id}"]`) as SVGSVGElement | null
    if (svg) {
      downloadQRCode(svg, `qr-${qr.tableNumber || qr.code}`)
    }
  }, [])

  const generateCode = () => {
    setQrCode(crypto.randomUUID().slice(0, 12).toUpperCase())
  }

  const resetForm = () => {
    setQrCode("")
    setTableNumber("")
    setLocation("")
    setIsActive(true)
    setGameType("")
    setEditingQR(null)
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (qr: QRCode) => {
    setEditingQR(qr)
    setQrCode(qr.code)
    setGameType(qr.gameType ?? "")
    setTableNumber(qr.tableNumber ?? "")
    setLocation(qr.location ?? "")
    setIsActive(qr.isActive)
    setIsFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!storeId) return

    if (editingQR) {
      try {
        await updateQRCode({
          id: editingQR._id,
          gameType: gameType || undefined,
          tableNumber: tableNumber || undefined,
          location: location || undefined,
          isActive,
        })
        toast.success("Code QR mis à jour")
        setIsFormOpen(false)
        resetForm()
      } catch (error: unknown) {
        toast.error("Échec de la mise à jour")
        console.error(error)
      }
    } else {
      if (!qrCode) {
        toast.error("Veuillez générer un code QR")
        return
      }
      try {
        await createQRCode({
          storeId,
          code: qrCode,
          gameType: gameType || undefined,
          tableNumber: tableNumber || undefined,
          location: location || undefined,
          isActive: true,
        })
        toast.success("Code QR créé avec succès")
        setIsFormOpen(false)
        resetForm()
      } catch (error: unknown) {
        toast.error("Échec de la création du code QR")
        console.error(error)
      }
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await removeQRCode({ id })
      toast.success("Code QR supprimé")
    } catch (error: unknown) {
      toast.error("Échec de la suppression du code QR")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingQRId(null)
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <QrCodeIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour gérer les codes QR</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (qrCodes === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Codes QR</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les codes QR pour vos tables
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Créer un code QR
        </Button>
      </div>

      {qrCodes.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <QrCodeIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun code QR</EmptyTitle>
            <EmptyDescription>Créez des codes QR pour vos tables</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border border-border/50 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">QR</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Emplacement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qrCodes.map((qr) => (
                <TableRow key={qr._id}>
                  <TableCell>
                    {storeSlug ? (
                      <button type="button" onClick={() => setPreviewQR(qr)} className="cursor-pointer hover:opacity-80">
                        <QRCodeSVG
                          data-qr-id={qr._id}
                          value={getGameUrl(storeSlug, qr.gameType)}
                          size={40}
                          level="M"
                        />
                      </button>
                    ) : (
                      <QrCodeIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold">{qr.code}</span>
                  </TableCell>
                  <TableCell>
                    {qr.gameType ? (
                      <Badge variant="outline" className="text-xs">
                        <Gamepad2 className="mr-1 h-3 w-3" />
                        {GAME_TYPE_LABELS[qr.gameType] ?? qr.gameType}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Tous</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{qr.tableNumber ?? "—"}</TableCell>
                  <TableCell className="text-sm">{qr.location ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={qr.isActive ? "default" : "secondary"} className="text-xs">
                      {qr.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPreviewQR(qr)} className="text-xs">
                          <Eye className="mr-2 h-3.5 w-3.5" />
                          Voir le QR code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(qr)} className="text-xs">
                          <Download className="mr-2 h-3.5 w-3.5" />
                          Télécharger
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(qr)} className="text-xs">
                          <Edit className="mr-2 h-3.5 w-3.5" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeletingQRId(qr._id)} className="text-destructive text-xs">
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) resetForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingQR ? "Modifier le code QR" : "Créer un code QR"}</DialogTitle>
            <DialogDescription>
              {editingQR ? "Modifiez les informations du code QR" : "Générez un code QR pour une table ou un emplacement"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingQR && (
              <div className="space-y-2">
                <Label htmlFor="qrCode">Code QR *</Label>
                <div className="flex gap-2">
                  <Input id="qrCode" value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="Auto-généré" />
                  <Button type="button" onClick={generateCode}>Générer</Button>
                </div>
              </div>
            )}
            {activeGames.length > 1 && (
              <div className="space-y-2">
                <Label>Type de jeu</Label>
                <Select value={gameType || "all"} onValueChange={(val) => setGameType(val === "all" ? "" : val as "wheel" | "scratch_card")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les jeux (auto)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les jeux (auto)</SelectItem>
                    {activeGames.map((g) => (
                      <SelectItem key={g._id} value={g.type}>
                        {GAME_TYPE_LABELS[g.type] ?? g.type} — {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choisissez quel jeu s&apos;ouvre quand le client scanne ce QR code
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tableNumber">Numéro de table</Label>
              <Input id="tableNumber" placeholder="12" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Emplacement</Label>
              <Input id="location" placeholder="Salle principale" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            {editingQR && (
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Actif</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button variant="outline" onClick={() => { setIsFormOpen(false); resetForm() }}>Annuler</Button>
              <Button onClick={handleSubmit}>{editingQR ? "Mettre à jour" : "Créer"}</Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewQR && storeSlug && (
        <Dialog open={!!previewQR} onOpenChange={(open) => !open && setPreviewQR(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>QR Code — {previewQR.tableNumber ? `Table ${previewQR.tableNumber}` : previewQR.code}</DialogTitle>
              <DialogDescription>
                Scannez ce code pour accéder au jeu
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG
                ref={previewSvgRef}
                value={getGameUrl(storeSlug, previewQR.gameType)}
                size={256}
                level="H"
                includeMargin
              />
              {previewQR.gameType && (
                <Badge variant="outline" className="text-xs">
                  <Gamepad2 className="mr-1 h-3 w-3" />
                  {GAME_TYPE_LABELS[previewQR.gameType]}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground text-center break-all">
                {getGameUrl(storeSlug, previewQR.gameType)}
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (previewSvgRef.current) {
                    downloadQRCode(previewSvgRef.current, `qr-${previewQR.tableNumber || previewQR.code}`)
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger PNG
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={!!deletingQRId}
        onOpenChange={(open) => !open && setDeletingQRId(null)}
        onConfirm={() => deletingQRId && handleDelete(deletingQRId)}
        title="Supprimer ce code QR ?"
        description="Cette action est irréversible. Le code QR ne sera plus fonctionnel."
        isDeleting={isDeleting}
      />
    </div>
  )
}
