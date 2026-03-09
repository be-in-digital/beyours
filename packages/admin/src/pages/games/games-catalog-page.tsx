"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import { GamepadIcon, PlusIcon, GiftIcon, MoreVertical, Edit, Trash2, AlertTriangle, QrCodeIcon, ZapIcon } from "lucide-react"
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { GameFormDialog } from "./game-form-dialog"

type PrizeType = "discount_percentage" | "discount_fixed" | "free_product" | "free_menu" | "custom"

interface Game {
  _id: string
  name: string
  type: "wheel" | "scratch_card"
  description?: string
  winRatio: number
  isActive: boolean
  config?: {
    wheelSections?: Array<{
      label: string
      color: string
      probability: number
      isWinning: boolean
      prizeId?: string
    }>
    primaryColor?: string
    secondaryColor?: string
    cooldownHours?: number
  }
}

interface Prize {
  _id: string
  name: string
  description?: string
  type: string
  value?: number
  validityDays: number
  totalAvailable?: number
  isActive: boolean
}

const PRIZE_TYPE_LABELS: Record<string, string> = {
  discount_percentage: "Réduction %",
  discount_fixed: "Réduction fixe",
  free_product: "Produit offert",
  free_menu: "Menu offert",
  custom: "Personnalisé",
}

function PrerequisitesAlert({
  hasPrizes,
  hasQRCodes,
  hasActions,
}: {
  hasPrizes: boolean
  hasQRCodes: boolean
  hasActions: boolean
}) {
  const missing: Array<{ label: string; href: string; icon: React.ReactNode }> = []

  if (!hasPrizes) {
    missing.push({
      label: "Créez au moins un prix",
      href: "#prizes",
      icon: <GiftIcon className="h-3.5 w-3.5" />,
    })
  }
  if (!hasQRCodes) {
    missing.push({
      label: "Créez au moins un QR code",
      href: "/games/qr-codes",
      icon: <QrCodeIcon className="h-3.5 w-3.5" />,
    })
  }
  if (!hasActions) {
    missing.push({
      label: "Créez au moins une action",
      href: "/games/actions",
      icon: <ZapIcon className="h-3.5 w-3.5" />,
    })
  }

  if (missing.length === 0) return null

  return (
    <div className="border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 rounded-lg p-4">
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            Avant de créer un jeu, configurez ces éléments :
          </p>
          <ul className="space-y-1.5">
            {missing.map((item) => (
              <li key={item.href} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400/80">
                {item.icon}
                <a href={item.href} className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function GamesCatalogPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isGameFormOpen, setIsGameFormOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | undefined>(undefined)

  const [isAddPrizeOpen, setIsAddPrizeOpen] = useState(false)
  const [prizeName, setPrizeName] = useState("")
  const [prizeDescription, setPrizeDescription] = useState("")
  const [prizeType, setPrizeType] = useState<PrizeType>("discount_percentage")
  const [prizeValue, setPrizeValue] = useState("")
  const [validityDays, setValidityDays] = useState("7")
  const [totalAvailable, setTotalAvailable] = useState("")

  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)
  const [deletingPrizeId, setDeletingPrizeId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Games, prizes, actions are global (restaurant-level). QR codes are per-store.
  const games = useQuery(api.games.list, {}) as Game[] | undefined
  const prizes = useQuery(api.prizes.list, {}) as Prize[] | undefined
  const qrCodes = useQuery(api.gameQRCodes.list, storeId ? { storeId } : "skip") as Array<{ _id: string }> | undefined
  const actions = useQuery(api.requiredActions.list, {}) as Array<{ _id: string }> | undefined

  const removeGame = useMutation(api.games.remove)
  const createPrize = useMutation(api.prizes.create)
  const removePrize = useMutation(api.prizes.remove)

  const hasPrizes = (prizes?.length ?? 0) > 0
  const hasQRCodes = (qrCodes?.length ?? 0) > 0
  const hasActions = (actions?.length ?? 0) > 0
  const canCreateGame = hasPrizes && hasQRCodes && hasActions

  const handleDeleteGame = async (id: string) => {
    setIsDeleting(true)
    try {
      await removeGame({ id })
      toast.success("Jeu supprimé")
    } catch (error: unknown) {
      toast.error("Échec de la suppression du jeu")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingGameId(null)
    }
  }

  const handleDeletePrize = async (id: string) => {
    setIsDeleting(true)
    try {
      await removePrize({ id })
      toast.success("Prix supprimé")
    } catch (error: unknown) {
      toast.error("Échec de la suppression du prix")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingPrizeId(null)
    }
  }

  const handleAddPrize = async () => {
    if (!prizeName) {
      toast.error("Veuillez remplir tous les champs requis")
      return
    }

    const parsedValidityDays = parseInt(validityDays, 10)
    if (isNaN(parsedValidityDays) || parsedValidityDays <= 0) {
      toast.error("Veuillez saisir un nombre de jours de validité valide")
      return
    }

    const parsedValue = prizeValue ? parseInt(prizeValue, 10) : undefined
    if (prizeValue && (parsedValue === undefined || isNaN(parsedValue))) {
      toast.error("Veuillez saisir une valeur valide")
      return
    }

    const parsedTotal = totalAvailable ? parseInt(totalAvailable, 10) : undefined
    if (totalAvailable && (parsedTotal === undefined || isNaN(parsedTotal))) {
      toast.error("Veuillez saisir une quantité valide")
      return
    }

    try {
      await createPrize({
        name: prizeName,
        description: prizeDescription || undefined,
        type: prizeType,
        value: parsedValue,
        validityDays: parsedValidityDays,
        totalAvailable: parsedTotal,
        isActive: true,
      })
      toast.success("Prix créé avec succès")
      setIsAddPrizeOpen(false)
      setPrizeName("")
      setPrizeDescription("")
      setPrizeValue("")
      setValidityDays("7")
      setTotalAvailable("")
    } catch (error: unknown) {
      toast.error("Échec de la création du prix")
      console.error(error)
    }
  }

  const openEditGame = (game: Game) => {
    setEditingGame(game)
    setIsGameFormOpen(true)
  }

  const openNewGame = () => {
    setEditingGame(undefined)
    setIsGameFormOpen(true)
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GamepadIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour gérer les jeux</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (games === undefined || prizes === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jeux & Prix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos jeux et les prix associés
          </p>
        </div>
      </div>

      <Tabs defaultValue="games" className="space-y-4">
        <TabsList>
          <TabsTrigger value="games">Jeux</TabsTrigger>
          <TabsTrigger value="prizes">Prix</TabsTrigger>
        </TabsList>

        {/* Tab Jeux */}
        <TabsContent value="games" className="space-y-4">
          {!canCreateGame && <PrerequisitesAlert hasPrizes={hasPrizes} hasQRCodes={hasQRCodes} hasActions={hasActions} />}

          <div className="flex justify-end">
            <Button size="sm" onClick={openNewGame} disabled={!canCreateGame}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Créer un jeu
            </Button>
          </div>

          {games.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GamepadIcon />
                </EmptyMedia>
                <EmptyTitle>Aucun jeu</EmptyTitle>
                <EmptyDescription>Créez votre premier jeu pour commencer</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="border border-border/50 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Win ratio</TableHead>
                    <TableHead>Segments</TableHead>
                    <TableHead className="text-right w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => (
                    <TableRow key={game._id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">{game.name}</div>
                          {game.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{game.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {game.type === "wheel" ? "Roue" : "Carte à gratter"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={game.isActive ? "default" : "secondary"} className="text-xs">
                          {game.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm tabular-nums">{game.winRatio}%</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {game.config?.wheelSections?.length ?? "\u2014"}
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
                            <DropdownMenuItem onClick={() => openEditGame(game)} className="text-xs">
                              <Edit className="mr-2 h-3.5 w-3.5" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeletingGameId(game._id)} className="text-destructive text-xs">
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
        </TabsContent>

        {/* Tab Prix */}
        <TabsContent value="prizes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddPrizeOpen} onOpenChange={setIsAddPrizeOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Créer un prix
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer un prix</DialogTitle>
                  <DialogDescription>
                    Ajoutez un nouveau prix que les clients peuvent gagner
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prizeName">Nom du prix *</Label>
                    <Input
                      id="prizeName"
                      placeholder="10% de réduction"
                      value={prizeName}
                      onChange={(e) => setPrizeName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizeType">Type *</Label>
                    <Select value={prizeType} onValueChange={(v) => setPrizeType(v as PrizeType)}>
                      <SelectTrigger id="prizeType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount_percentage">Réduction %</SelectItem>
                        <SelectItem value="discount_fixed">Réduction fixe</SelectItem>
                        <SelectItem value="free_product">Produit offert</SelectItem>
                        <SelectItem value="free_menu">Menu offert</SelectItem>
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizeValue">Valeur (optionnelle)</Label>
                    <Input
                      id="prizeValue"
                      type="number"
                      placeholder="10"
                      value={prizeValue}
                      onChange={(e) => setPrizeValue(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="validityDays">Validité (jours) *</Label>
                      <Input
                        id="validityDays"
                        type="number"
                        value={validityDays}
                        onChange={(e) => setValidityDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalAvailable">Quantité disponible</Label>
                      <Input
                        id="totalAvailable"
                        type="number"
                        placeholder="Illimité"
                        value={totalAvailable}
                        onChange={(e) => setTotalAvailable(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizeDescription">Description</Label>
                    <Input
                      id="prizeDescription"
                      placeholder="Description optionnelle"
                      value={prizeDescription}
                      onChange={(e) => setPrizeDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <ButtonGroup>
                    <Button variant="outline" onClick={() => setIsAddPrizeOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleAddPrize}>Créer un prix</Button>
                  </ButtonGroup>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {prizes.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GiftIcon />
                </EmptyMedia>
                <EmptyTitle>Aucun prix</EmptyTitle>
                <EmptyDescription>Créez des prix que les clients peuvent gagner</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="border border-border/50 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prizes.map((prize) => (
                    <TableRow key={prize._id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">{prize.name}</div>
                          {prize.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{prize.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PRIZE_TYPE_LABELS[prize.type] ?? prize.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm tabular-nums">{prize.value ?? "\u2014"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{prize.validityDays}j</TableCell>
                      <TableCell className="text-sm tabular-nums">{prize.totalAvailable ?? "Illimité"}</TableCell>
                      <TableCell>
                        <Badge variant={prize.isActive ? "default" : "secondary"} className="text-xs">
                          {prize.isActive ? "Actif" : "Inactif"}
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
                            <DropdownMenuItem onClick={() => setDeletingPrizeId(prize._id)} className="text-destructive text-xs">
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
        </TabsContent>
      </Tabs>

      <GameFormDialog
        open={isGameFormOpen}
        onOpenChange={setIsGameFormOpen}
        game={editingGame}
        prizes={prizes}
      />

      <DeleteConfirmDialog
        open={!!deletingGameId}
        onOpenChange={(open) => !open && setDeletingGameId(null)}
        onConfirm={() => deletingGameId && handleDeleteGame(deletingGameId)}
        title="Supprimer ce jeu ?"
        description="Cette action est irréversible. Le jeu et toutes ses données seront définitivement supprimés."
        isDeleting={isDeleting}
      />

      <DeleteConfirmDialog
        open={!!deletingPrizeId}
        onOpenChange={(open) => !open && setDeletingPrizeId(null)}
        onConfirm={() => deletingPrizeId && handleDeletePrize(deletingPrizeId)}
        title="Supprimer ce prix ?"
        description="Cette action est irréversible. Le prix ne pourra plus être gagné par les clients."
        isDeleting={isDeleting}
      />
    </div>
  )
}
