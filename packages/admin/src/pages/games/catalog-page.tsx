"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { GamepadIcon, GiftIcon, PlusIcon, TrashIcon } from "lucide-react"
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
  Slider,
  Switch,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"

/**
 * Games & prizes configuration — what customers can play and win.
 * The win ratio and the prize stock live here, side by side, because
 * one without the other makes no sense to a restaurateur.
 */

type PrizeType = "discount_percentage" | "discount_fixed" | "free_product" | "free_menu" | "custom"

interface Game {
  _id: string
  name: string
  type: "wheel" | "scratch_card"
  description?: string
  winRatio: number
  isActive: boolean
  config?: {
    actionMode?: "all" | "sequential"
    referral?: { enabled?: boolean; friendRewardLabel?: string }
    cooldownHours?: number
    [key: string]: unknown
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
  remainingCount?: number
  isActive: boolean
}

const PRIZE_TYPE_LABELS: Record<string, string> = {
  discount_percentage: "Réduction %",
  discount_fixed: "Réduction fixe",
  free_product: "Produit offert",
  free_menu: "Menu offert",
  custom: "Personnalisé",
}

export function GameCatalogPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isAddGameOpen, setIsAddGameOpen] = useState(false)
  const [isAddPrizeOpen, setIsAddPrizeOpen] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)
  const [deletingPrizeId, setDeletingPrizeId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Game form
  const [gameName, setGameName] = useState("")
  const [gameType, setGameType] = useState<"wheel" | "scratch_card">("wheel")
  const [gameDescription, setGameDescription] = useState("")
  const [winRatio, setWinRatio] = useState(30)

  // Prize form
  const [prizeName, setPrizeName] = useState("")
  const [prizeType, setPrizeType] = useState<PrizeType>("discount_percentage")
  const [prizeDescription, setPrizeDescription] = useState("")
  const [prizeValue, setPrizeValue] = useState("")
  const [validityDays, setValidityDays] = useState("7")
  const [totalAvailable, setTotalAvailable] = useState("")

  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as Game[] | undefined
  const prizes = useQuery(api.prizes.list, storeId ? { storeId } : "skip") as Prize[] | undefined

  const createGame = useMutation(api.games.create)
  const updateGame = useMutation(api.games.update)
  const updateWinRatio = useMutation(api.games.updateWinRatio)
  const removeGame = useMutation(api.games.remove)
  const createPrize = useMutation(api.prizes.create)
  const updatePrize = useMutation(api.prizes.update)
  const removePrize = useMutation(api.prizes.remove)

  const handleAddGame = async () => {
    if (!storeId || !gameName.trim()) {
      toast.error("Donnez un nom au jeu")
      return
    }
    try {
      await createGame({
        storeId,
        type: gameType,
        name: gameName.trim(),
        description: gameDescription.trim() || undefined,
        winRatio,
        isActive: true,
      })
      toast.success("Jeu créé — il est actif immédiatement")
      setIsAddGameOpen(false)
      setGameName("")
      setGameDescription("")
      setWinRatio(30)
    } catch (error) {
      toast.error("Création du jeu impossible — vérifiez votre connexion et réessayez")
      console.error(error)
    }
  }

  const handleAddPrize = async () => {
    if (!storeId || !prizeName.trim()) {
      toast.error("Donnez un nom au lot")
      return
    }
    const parsedValidity = parseInt(validityDays, 10)
    if (isNaN(parsedValidity) || parsedValidity <= 0) {
      toast.error("La validité doit être un nombre de jours positif")
      return
    }
    try {
      await createPrize({
        storeId,
        name: prizeName.trim(),
        description: prizeDescription.trim() || undefined,
        type: prizeType,
        value: prizeValue ? parseInt(prizeValue, 10) : undefined,
        validityDays: parsedValidity,
        totalAvailable: totalAvailable ? parseInt(totalAvailable, 10) : undefined,
        isActive: true,
      })
      toast.success("Lot créé — il peut être gagné dès maintenant")
      setIsAddPrizeOpen(false)
      setPrizeName("")
      setPrizeDescription("")
      setPrizeValue("")
      setValidityDays("7")
      setTotalAvailable("")
    } catch (error) {
      toast.error("Création du lot impossible — vérifiez votre connexion et réessayez")
      console.error(error)
    }
  }

  const handleDeleteGame = async (id: string) => {
    setIsDeleting(true)
    try {
      await removeGame({ id })
      toast.success("Jeu supprimé")
    } catch (error) {
      toast.error("Suppression impossible — réessayez")
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
      toast.success("Lot supprimé")
    } catch (error) {
      toast.error("Suppression impossible — réessayez")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingPrizeId(null)
    }
  }

  if (!storeId) {
    return (
      <Empty className="min-h-[400px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GamepadIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour configurer les jeux</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (games === undefined || prizes === undefined) {
    return <LoadingState />
  }

  const activePrizesInStock = prizes.filter(
    (p) => p.isActive && (p.remainingCount === undefined || p.remainingCount > 0)
  ).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Jeux &amp; Lots</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Le jeu que vos clients lancent, et ce qu&apos;ils peuvent gagner
        </p>
      </div>

      {/* Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Jeux</h2>
          <Dialog open={isAddGameOpen} onOpenChange={setIsAddGameOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Créer un jeu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau jeu</DialogTitle>
                <DialogDescription>Roue de la fortune ou carte à gratter</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gameName">Nom du jeu *</Label>
                  <Input
                    id="gameName"
                    placeholder="Tournez et gagnez"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gameType">Type *</Label>
                  <Select
                    value={gameType}
                    onValueChange={(v) => setGameType(v as "wheel" | "scratch_card")}
                  >
                    <SelectTrigger id="gameType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wheel">Roue de la fortune</SelectItem>
                      <SelectItem value="scratch_card">Carte à gratter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gameDescription">Description</Label>
                  <Input
                    id="gameDescription"
                    placeholder="Optionnelle"
                    value={gameDescription}
                    onChange={(e) => setGameDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="winRatio">Ratio de victoire : {winRatio}%</Label>
                  <Slider
                    id="winRatio"
                    min={0}
                    max={100}
                    step={5}
                    value={[winRatio]}
                    onValueChange={(v) => setWinRatio(v[0] ?? 30)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {winRatio}% des parties seront gagnantes (si des lots sont en stock)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <ButtonGroup>
                  <Button variant="outline" onClick={() => setIsAddGameOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={() => void handleAddGame()}>Créer le jeu</Button>
                </ButtonGroup>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {games.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GamepadIcon />
              </EmptyMedia>
              <EmptyTitle>Aucun jeu</EmptyTitle>
              <EmptyDescription>Créez votre premier jeu pour lancer la gamification</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {games.map((game) => (
              <div key={game._id} className="border border-border/50 rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{game.name}</h3>
                    <Badge variant="outline" className="mt-1.5">
                      {game.type === "wheel" ? "Roue de la fortune" : "Carte à gratter"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={game.isActive}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateGame({ id: game._id, isActive: checked })
                          toast.success(checked ? "Jeu activé" : "Jeu désactivé")
                        } catch (error) {
                          toast.error("Mise à jour impossible — réessayez")
                          console.error(error)
                        }
                      }}
                      aria-label={game.isActive ? "Désactiver le jeu" : "Activer le jeu"}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer le jeu"
                      onClick={() => setDeletingGameId(game._id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {game.description && (
                  <p className="text-sm text-muted-foreground">{game.description}</p>
                )}
                <div className="space-y-2">
                  <Label>Ratio de victoire : {game.winRatio}%</Label>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[game.winRatio]}
                    onValueChange={async (v) => {
                      try {
                        await updateWinRatio({ id: game._id, winRatio: v[0] ?? 0 })
                      } catch (error) {
                        toast.error("Mise à jour du ratio impossible — réessayez")
                        console.error(error)
                      }
                    }}
                  />
                </div>

                <div className="space-y-3 rounded-md border border-border/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="text-sm">Actions progressives</Label>
                      <p className="text-xs text-muted-foreground">
                        Une action par visite (recommandé), au lieu de toutes en même temps.
                      </p>
                    </div>
                    <Switch
                      checked={(game.config?.actionMode ?? "sequential") === "sequential"}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateGame({
                            id: game._id,
                            config: { ...(game.config ?? {}), actionMode: checked ? "sequential" : "all" },
                          })
                          toast.success("Parcours des actions mis à jour")
                        } catch (error) {
                          toast.error("Mise à jour impossible — réessayez")
                          console.error(error)
                        }
                      }}
                      aria-label="Basculer les actions progressives"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="text-sm">Parrainage</Label>
                      <p className="text-xs text-muted-foreground">
                        Une fois les actions faites, le client parraine un ami pour rejouer.
                      </p>
                    </div>
                    <Switch
                      checked={game.config?.referral?.enabled ?? false}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateGame({
                            id: game._id,
                            config: {
                              ...(game.config ?? {}),
                              referral: { ...(game.config?.referral ?? {}), enabled: checked },
                            },
                          })
                          toast.success(checked ? "Parrainage activé" : "Parrainage désactivé")
                        } catch (error) {
                          toast.error("Mise à jour impossible — réessayez")
                          console.error(error)
                        }
                      }}
                      aria-label="Activer le parrainage"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prizes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Lots à gagner</h2>
            {activePrizesInStock === 0 && prizes.length > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                Aucun lot en stock — personne ne peut gagner
              </Badge>
            )}
          </div>
          <Dialog open={isAddPrizeOpen} onOpenChange={setIsAddPrizeOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Créer un lot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau lot</DialogTitle>
                <DialogDescription>Ce que vos clients peuvent gagner</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prizeName">Nom du lot *</Label>
                  <Input
                    id="prizeName"
                    placeholder="Dessert offert"
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
                      {Object.entries(PRIZE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
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
                      min={1}
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalAvailable">Quantité</Label>
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
                    placeholder="Optionnelle"
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
                  <Button onClick={() => void handleAddPrize()}>Créer le lot</Button>
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
              <EmptyTitle>Aucun lot</EmptyTitle>
              <EmptyDescription>
                Sans lot en stock, aucune partie ne peut être gagnante.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prizes.map((prize) => {
              const stock = prize.remainingCount ?? prize.totalAvailable
              const outOfStock = stock !== undefined && stock <= 0
              return (
                <div
                  key={prize._id}
                  className={`border border-border/50 rounded-lg p-4 space-y-2.5 ${
                    !prize.isActive || outOfStock ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm min-w-0 truncate">{prize.name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={prize.isActive}
                        onCheckedChange={async (checked) => {
                          try {
                            await updatePrize({ id: prize._id, isActive: checked })
                          } catch (error) {
                            toast.error("Mise à jour impossible — réessayez")
                            console.error(error)
                          }
                        }}
                        aria-label={prize.isActive ? "Désactiver le lot" : "Activer le lot"}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Supprimer le lot"
                        onClick={() => setDeletingPrizeId(prize._id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {PRIZE_TYPE_LABELS[prize.type] ?? prize.type}
                    </Badge>
                    <Badge
                      variant={outOfStock ? "outline" : "secondary"}
                      className={`text-[10px] ${outOfStock ? "bg-red-50 text-red-700 border-red-200" : ""}`}
                    >
                      {stock === undefined ? "Illimité" : outOfStock ? "Épuisé" : `${stock} restant${stock > 1 ? "s" : ""}`}
                    </Badge>
                  </div>
                  {prize.description && (
                    <p className="text-xs text-muted-foreground">{prize.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Valable {prize.validityDays} jours après le gain
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <DeleteConfirmDialog
        open={!!deletingGameId}
        onOpenChange={(open) => !open && setDeletingGameId(null)}
        onConfirm={() => deletingGameId && void handleDeleteGame(deletingGameId)}
        title="Supprimer ce jeu ?"
        description="Cette action est irréversible. Les QR codes pointant sur ce jeu basculeront sur le jeu actif suivant."
        isDeleting={isDeleting}
      />
      <DeleteConfirmDialog
        open={!!deletingPrizeId}
        onOpenChange={(open) => !open && setDeletingPrizeId(null)}
        onConfirm={() => deletingPrizeId && void handleDeletePrize(deletingPrizeId)}
        title="Supprimer ce lot ?"
        description="Cette action est irréversible. Les tickets déjà gagnés restent valables."
        isDeleting={isDeleting}
      />
    </div>
  )
}
