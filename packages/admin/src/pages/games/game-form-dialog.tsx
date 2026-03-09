"use client"

import { useState, useEffect, useCallback } from "react"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { ChevronLeftIcon, ChevronRightIcon, MessageCircleQuestionIcon, ChevronDownIcon } from "lucide-react"
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "@beindigital-engine/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { SegmentEditor, type WheelSection } from "./segment-editor"

interface Prize {
  _id: string
  name: string
}

interface Game {
  _id: string
  name: string
  type: "wheel" | "scratch_card"
  description?: string
  winRatio: number
  isActive: boolean
  config?: {
    wheelSections?: WheelSection[]
    primaryColor?: string
    secondaryColor?: string
    cooldownHours?: number
  }
}

interface GameFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  game?: Game
  prizes: Prize[]
}

const DEFAULT_SECTIONS: WheelSection[] = [
  { label: "Gagné !", color: "#4ECDC4", probability: 3, isWinning: true },
  { label: "Perdu", color: "#FF6B6B", probability: 7, isWinning: false },
  { label: "Gagné !", color: "#FFE66D", probability: 2, isWinning: true },
  { label: "Perdu", color: "#95E1D3", probability: 5, isWinning: false },
  { label: "Perdu", color: "#F38181", probability: 4, isWinning: false },
  { label: "Gagné !", color: "#AA96DA", probability: 1, isWinning: true },
]

function HelpBox({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <MessageCircleQuestionIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 font-medium">{title}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  )
}

function getWinRatioDescription(winRatio: number): { label: string; color: string; detail: string } {
  if (winRatio === 0) return { label: "Personne ne gagne", color: "text-red-600", detail: "Aucun client ne remportera de prix. Utile si vous voulez temporairement desactiver les gains." }
  if (winRatio <= 10) return { label: "Tres rare", color: "text-red-500", detail: `Sur 100 clients qui jouent, environ ${winRatio} gagneront un prix. Ideal pour des prix de grande valeur.` }
  if (winRatio <= 25) return { label: "Peu frequent", color: "text-orange-500", detail: `Sur 100 clients qui jouent, environ ${winRatio} gagneront un prix. Bon equilibre pour des prix de valeur moyenne.` }
  if (winRatio <= 50) return { label: "Equilibre", color: "text-yellow-600", detail: `Sur 100 clients qui jouent, environ ${winRatio} gagneront un prix. Choix recommande pour la plupart des restaurants.` }
  if (winRatio <= 75) return { label: "Frequent", color: "text-green-500", detail: `Sur 100 clients qui jouent, environ ${winRatio} gagneront un prix. Beaucoup de gagnants, pensez a utiliser des petits prix.` }
  if (winRatio < 100) return { label: "Tres genereux", color: "text-green-600", detail: `Sur 100 clients qui jouent, environ ${winRatio} gagneront un prix. Quasi tout le monde gagne, prevoyez du stock !` }
  return { label: "Tout le monde gagne", color: "text-green-700", detail: "Chaque client qui joue remportera un prix. Assurez-vous d'avoir suffisamment de stock." }
}

export function GameFormDialog({ open, onOpenChange, game, prizes }: GameFormDialogProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const isEditing = !!game

  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1
  const [name, setName] = useState("")
  const [type, setType] = useState<"wheel" | "scratch_card">("wheel")
  const [description, setDescription] = useState("")

  // Step 2
  const [sections, setSections] = useState<WheelSection[]>(DEFAULT_SECTIONS)

  // Step 3
  const [winRatio, setWinRatio] = useState(30)

  const createGame = useMutation(api.games.create)
  const updateGame = useMutation(api.games.update)

  // Pre-fill for edit mode
  useEffect(() => {
    if (game && open) {
      setName(game.name)
      setType(game.type)
      setDescription(game.description ?? "")
      setWinRatio(game.winRatio)
      setSections(game.config?.wheelSections ?? DEFAULT_SECTIONS)
      setStep(1)
    } else if (!open) {
      setName("")
      setType("wheel")
      setDescription("")
      setWinRatio(30)
      setSections(DEFAULT_SECTIONS)
      setStep(1)
    }
  }, [game, open])

  const canProceedStep1 = name.trim().length > 0
  const canProceedStep2 = sections.length >= 2 && sections.every((s) => s.label.trim().length > 0)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const config = type === "wheel" ? { wheelSections: sections } : undefined

      if (isEditing) {
        await updateGame({
          id: game._id,
          type,
          name,
          description: description || undefined,
          winRatio,
          config,
        })
        toast.success("Jeu mis a jour")
      } else {
        await createGame({
          type,
          name,
          description: description || undefined,
          winRatio,
          isActive: true,
          config,
        })
        toast.success("Jeu cree avec succes")
      }
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(isEditing ? "Echec de la mise a jour" : "Echec de la creation")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepDescriptions: Record<number, string> = {
    1: "Donnez un nom a votre jeu et choisissez son type",
    2: "Personnalisez les differentes cases de la roue que vos clients verront",
    3: "Decidez combien de clients gagneront un prix en jouant",
  }

  const winInfo = getWinRatioDescription(winRatio)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le jeu" : "Creer un nouveau jeu"} — Etape {step}/3
          </DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <HelpBox title="C'est quoi un jeu ?">
              C'est une animation interactive (comme une roue de la fortune) que vos clients voient
              sur leur telephone apres avoir scanne un QR code sur la table. Ils tournent la roue et
              peuvent gagner un prix (reduction, dessert gratuit, etc.).
            </HelpBox>

            <div className="space-y-1.5">
              <Label htmlFor="gameName">Nom du jeu *</Label>
              <Input
                id="gameName"
                placeholder="Ex : La Roue Gourmande, Tentez votre chance..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Visible par vos clients sur leur telephone.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gameType">Type de jeu *</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "wheel" | "scratch_card")}
              >
                <SelectTrigger id="gameType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wheel">Roue de la fortune</SelectItem>
                  <SelectItem value="scratch_card">Carte a gratter</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {type === "wheel"
                  ? "La roue tourne et s'arrete sur une case au hasard."
                  : "Le client gratte une carte pour decouvrir s'il a gagne."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gameDescription">Description (optionnelle)</Label>
              <Input
                id="gameDescription"
                placeholder="Ex : Tournez la roue et tentez de gagner un dessert !"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Affiche sous le jeu pour donner envie de jouer.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            {type === "wheel" ? (
              <>
                <HelpBox title="C'est quoi un segment ?">
                  Un segment = une <strong>case de la roue</strong>. Chaque case a :
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    <li><strong>Un texte</strong> — ce que le client voit ("Bravo !", "-10%"...)</li>
                    <li><strong>Une couleur</strong> — pour rendre la roue attractive</li>
                    <li><strong>Une taille</strong> — plus le chiffre est grand, plus la case est grande sur la roue</li>
                    <li><strong>Gagnant/Perdant</strong> — si la case fait gagner un prix ou non</li>
                  </ul>
                </HelpBox>
                <SegmentEditor sections={sections} onChange={setSections} prizes={prizes} />
              </>
            ) : (
              <div className="space-y-4">
                <HelpBox title="Pas de segments pour la carte a gratter">
                  Le systeme decide automatiquement si le client gagne ou perd selon le{" "}
                  <strong>ratio de victoire</strong> que vous definirez a l'etape suivante.
                </HelpBox>
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Passez a l'etape suivante pour configurer le pourcentage de gagnants.
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <HelpBox title="C'est quoi le ratio de victoire ?">
              C'est le pourcentage de clients qui gagneront un prix. Exemple : 30% = environ 3
              clients sur 10 gagnent quelque chose. Les autres verront un message les invitant a
              revenir demain.
              <br />
              <br />
              <strong>Conseil :</strong> Commencez avec 20-30% et ajustez plus tard si besoin.
            </HelpBox>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Ratio de victoire</Label>
                <span className="text-2xl font-bold tabular-nums">{winRatio}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[winRatio]}
                onValueChange={(v) => setWinRatio(v[0] ?? 30)}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0% — Aucun gagnant</span>
                <span>100% — Tout le monde gagne</span>
              </div>
            </div>

            {/* Visual explanation of win ratio */}
            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${winInfo.color}`}>{winInfo.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{winInfo.detail}</p>

              {/* Visual dots representation */}
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Simulation sur 20 joueurs :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 20 }, (_, i) => {
                    const isWinner = i < Math.round(20 * (winRatio / 100))
                    return (
                      <div
                        key={i}
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                          isWinner
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : "bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-500"
                        }`}
                        title={isWinner ? "Gagnant" : "Perdant"}
                      >
                        {isWinner ? "G" : "P"}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-200 dark:bg-green-800" />
                    G = Gagnant ({Math.round(20 * (winRatio / 100))}/20)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-100 dark:bg-red-900/30" />
                    P = Perdant ({20 - Math.round(20 * (winRatio / 100))}/20)
                  </span>
                </div>
              </div>
            </div>

            {type === "wheel" && sections.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Recap de la roue</Label>
                <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                  {sections.map((s, i) => {
                    const totalProb = sections.reduce((sum, sec) => sum + sec.probability, 0)
                    const pct =
                      totalProb > 0 ? Math.round((s.probability / totalProb) * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="flex-1 truncate">
                          {s.label || `Segment ${i + 1}`}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                        <span
                          className={`text-xs font-medium ${
                            s.isWinning ? "text-green-600" : "text-muted-foreground"
                          }`}
                        >
                          {s.isWinning ? "Gagnant" : "Perdant"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <ButtonGroup>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeftIcon className="mr-2 h-4 w-4" />
                Precedent
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              >
                Suivant
                <ChevronRightIcon className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "En cours..." : isEditing ? "Mettre a jour" : "Creer le jeu"}
              </Button>
            )}
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
