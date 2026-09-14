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
import {
  DEFAULT_PRIZE_BUDGET,
  PRIZE_BUDGET_LIMITS,
  resolvePrizeBudget,
} from "@be-in-digital/convex-functions/prizeBudget"
import {
  MAX_COOLDOWN_HOURS,
  resolveCooldownHours,
} from "@be-in-digital/convex-functions/gamePlay"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { convexErrorMessage } from "../../lib/convex-error"

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
    prizeBudget?: { maxPrizes?: number; windowHours?: number }
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
  /* Which product or formule a « Produit offert » / « Menu offert » gives away.
     The two types existed with nothing able to say WHICH, so a prize read
     « Menu offert » on the wheel, on the winning screen and on the QR code the
     diner brought to the counter — and nobody at the counter could tell what had
     been promised. The server refuses one without a target since #432.7; this is
     the field that supplies it. */
  const [prizeProductId, setPrizeProductId] = useState("")
  const [prizeMenuId, setPrizeMenuId] = useState("")

  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as Game[] | undefined
  const prizes = useQuery(api.prizes.list, storeId ? { storeId } : "skip") as Prize[] | undefined
  /* The catalogue, for the two prize types that give something away.
     `products.listAll`, not `products.list`: the owner picking a prize is
     entitled to see a dish that is not currently on sale — a seasonal one they
     are about to publish — and `list` is the storefront's filtered read since
     #443. Only loaded when the dialog can use it. */
  const products = useQuery(
    api.products.listAll,
    storeId && isAddPrizeOpen ? { storeId } : "skip",
  ) as { _id: string; name: string }[] | undefined
  const menus = useQuery(
    api.menus.list,
    storeId && isAddPrizeOpen ? { storeId } : "skip",
  ) as { _id: string; name: string }[] | undefined

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
    /* Asked here as well as refused there. The server is the authority — it has
       to be, the mutation is reachable without this screen — but meeting a
       refusal is a worse way to learn that a field is required than being told
       before submitting. */
    if (prizeType === "free_product" && !prizeProductId) {
      toast.error("Choisissez le produit offert")
      return
    }
    if (prizeType === "free_menu" && !prizeMenuId) {
      toast.error("Choisissez la formule offerte")
      return
    }
    try {
      await createPrize({
        storeId,
        name: prizeName.trim(),
        description: prizeDescription.trim() || undefined,
        type: prizeType,
        value: prizeValue ? parseInt(prizeValue, 10) : undefined,
        // Sent only for the type that takes it: the server refuses a target on
        // a type that has no place for one, which is the same lie in the other
        // direction as a « Menu offert » naming nothing.
        productId: prizeType === "free_product" ? (prizeProductId as never) : undefined,
        menuId: prizeType === "free_menu" ? (prizeMenuId as never) : undefined,
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
      setPrizeProductId("")
      setPrizeMenuId("")
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
      // The refusal names the plays — the establishment's own record of what it
      // ran, consent included — and tells the owner to deactivate instead.
      // « Suppression impossible — réessayez » threw that away and invited the
      // one action the server had just refused.
      toast.error(convexErrorMessage(error, "Suppression impossible — réessayez"))
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
      // Same seam: the refusal says a diner is holding this prize and that
      // deactivating it keeps their code valid. Retrying cannot help.
      toast.error(convexErrorMessage(error, "Suppression impossible — réessayez"))
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
                  <CooldownControl
                    config={game.config}
                    onSave={async (cooldownHours) => {
                      try {
                        await updateGame({
                          id: game._id,
                          config: { ...(game.config ?? {}), cooldownHours },
                        })
                        toast.success("Délai entre deux parties mis à jour")
                      } catch (error) {
                        toast.error("Mise à jour impossible — réessayez")
                        console.error(error)
                      }
                    }}
                  />
                  <PrizeBudgetControl
                    config={game.config}
                    onSave={async (prizeBudget) => {
                      try {
                        await updateGame({
                          id: game._id,
                          config: { ...(game.config ?? {}), prizeBudget },
                        })
                        toast.success("Budget de lots mis à jour")
                      } catch (error) {
                        toast.error("Mise à jour impossible — réessayez")
                        console.error(error)
                      }
                    }}
                  />
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
                {prizeType === "free_product" && (
                  <div className="space-y-2">
                    <Label htmlFor="prizeProduct">Produit offert *</Label>
                    <Select value={prizeProductId} onValueChange={setPrizeProductId}>
                      <SelectTrigger id="prizeProduct">
                        <SelectValue placeholder="Choisissez un produit" />
                      </SelectTrigger>
                      <SelectContent>
                        {(products ?? []).map((product) => (
                          <SelectItem key={product._id} value={product._id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {prizeType === "free_menu" && (
                  <div className="space-y-2">
                    <Label htmlFor="prizeMenu">Formule offerte *</Label>
                    <Select value={prizeMenuId} onValueChange={setPrizeMenuId}>
                      <SelectTrigger id="prizeMenu">
                        <SelectValue placeholder="Choisissez une formule" />
                      </SelectTrigger>
                      <SelectContent>
                        {(menus ?? []).map((menu) => (
                          <SelectItem key={menu._id} value={menu._id}>
                            {menu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                  /*
                   * Tinted, not faded. `opacity-60` multiplied every ratio on
                   * the card, and the "Épuisé" badge — which only ever renders
                   * on a card in this state — measured 3.29:1 through it.
                   */
                  className={`border border-border/50 rounded-lg p-4 space-y-2.5 ${
                    !prize.isActive || outOfStock ? "bg-muted/50" : ""
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
                      className={`text-[10px] ${outOfStock ? "bg-destructive text-destructive-foreground border-destructive" : ""}`}
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

/**
 * The establishment's prize budget: how many lots the game may hand out inside
 * one rolling window.
 *
 * WHY THIS CONTROL EXISTS, in one line for whoever reads it next: the player
 * endpoints are anonymous by design, the rate limiter bounds how OFTEN they can
 * be called, and nothing bounded how MUCH they could give away — a loop over
 * forty table codes issued 200 prizes in an hour. This is the owner's say over
 * that, and the defaults apply whether or not they ever open it.
 *
 * Values are clamped by `resolvePrizeBudget`, which is also what the player
 * path calls, so the form cannot promise a bound the game will not honour.
 */
/**
 * How long one device waits between two plays (#107).
 *
 * `games.config.cooldownHours` was in the schema and read by `cooldownMsForGame`,
 * and **no screen wrote it** — `catalog-page.tsx` declared it in a TypeScript
 * interface and rendered nothing. So every game on every deployment was stuck on
 * the 24-hour default, and the audit's "configurable cooldown" was a field with a
 * reader and no writer.
 *
 * Clamped by `resolveCooldownHours`, which is what the player path calls too, so
 * the number shown here is the number the game will honour. Zero is a real
 * choice and means no wait — the cooldown is fairness between honest devices,
 * not the abuse bound; `consumeRateLimit` bounds the rate and `prizeBudget`
 * bounds the cost.
 */
function CooldownControl({
  config,
  onSave,
}: {
  config?: { cooldownHours?: number }
  onSave: (cooldownHours: number) => Promise<void>
}) {
  const inForce = resolveCooldownHours({ config })
  const [hours, setHours] = useState(String(inForce))

  const commit = async (typed: string) => {
    const next = resolveCooldownHours({ config: { cooldownHours: Number(typed) } })
    // Show what was actually stored, not what was typed: a value outside the
    // bounds is clamped rather than refused, and an owner who typed 5000 must not
    // be left believing the game will honour it. Same rule as the budget below.
    setHours(String(next))
    await onSave(next)
  }

  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <Label className="text-sm">Délai entre deux parties</Label>
        <p className="text-xs text-muted-foreground">
          Le temps qu&apos;un même appareil attend avant de rejouer. Par défaut :
          24 h, {MAX_COOLDOWN_HOURS} h au maximum. À 0, il n&apos;y a pas
          d&apos;attente — le budget de lots reste la limite de ce que la partie
          peut coûter.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_COOLDOWN_HOURS}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          onBlur={() => void commit(hours)}
          className="w-24"
          aria-label="Délai entre deux parties, en heures"
        />
        <span className="text-xs text-muted-foreground">heures</span>
      </div>
    </div>
  )
}

function PrizeBudgetControl({
  config,
  onSave,
}: {
  config?: { prizeBudget?: { maxPrizes?: number; windowHours?: number } }
  onSave: (budget: { maxPrizes: number; windowHours: number }) => Promise<void>
}) {
  const inForce = resolvePrizeBudget({ config })
  const [maxPrizes, setMaxPrizes] = useState(String(inForce.maxPrizes))
  const [windowHours, setWindowHours] = useState(String(inForce.windowHours))

  const commit = async (next: { maxPrizes: string; windowHours: string }) => {
    const budget = resolvePrizeBudget({
      config: {
        prizeBudget: {
          maxPrizes: Number(next.maxPrizes),
          windowHours: Number(next.windowHours),
        },
      },
    })
    // Show what was actually stored, not what was typed: a value outside the
    // bounds is clamped rather than refused, and an owner who typed 5000 must
    // not be left believing the game will honour it.
    setMaxPrizes(String(budget.maxPrizes))
    setWindowHours(String(budget.windowHours))
    await onSave(budget)
  }

  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <Label className="text-sm">Budget de lots</Label>
        <p className="text-xs text-muted-foreground">
          Le nombre maximum de lots distribués sur une période glissante. Au-delà, les
          parties continuent mais ne sont plus gagnantes, le temps que les lots les plus
          anciens sortent de la période. Par défaut : {DEFAULT_PRIZE_BUDGET.maxPrizes}{" "}
          lots par {DEFAULT_PRIZE_BUDGET.windowHours} h. Si plusieurs jeux sont actifs,
          c&apos;est le budget le plus strict qui s&apos;applique à
          l&apos;établissement.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={PRIZE_BUDGET_LIMITS.minPrizes}
          max={PRIZE_BUDGET_LIMITS.maxPrizes}
          value={maxPrizes}
          onChange={(e) => setMaxPrizes(e.target.value)}
          onBlur={() => void commit({ maxPrizes, windowHours })}
          className="w-24"
          aria-label="Nombre maximum de lots"
        />
        <span className="text-xs text-muted-foreground">lots toutes les</span>
        <Input
          type="number"
          inputMode="numeric"
          min={PRIZE_BUDGET_LIMITS.minWindowHours}
          max={PRIZE_BUDGET_LIMITS.maxWindowHours}
          value={windowHours}
          onChange={(e) => setWindowHours(e.target.value)}
          onBlur={() => void commit({ maxPrizes, windowHours })}
          className="w-20"
          aria-label="Durée de la période en heures"
        />
        <span className="text-xs text-muted-foreground">heures</span>
      </div>
    </div>
  )
}
