"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { SettingsIcon } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { ImageUpload } from "../../components/image-upload"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"

interface Game {
  _id: string
  name: string
  config?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundImage?: string
    cooldownHours?: number
  }
}

export function GamesSettingsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  // Games are global (restaurant-level)
  const games = useQuery(api.games.list, {}) as Game[] | undefined
  const updateGame = useMutation(api.games.update)

  // Use the first game's config as the global settings source
  const activeGame = games?.[0]

  const [cooldownHours, setCooldownHours] = useState("24")
  const [primaryColor, setPrimaryColor] = useState("#4ECDC4")
  const [secondaryColor, setSecondaryColor] = useState("#FF6B6B")
  const [backgroundImage, setBackgroundImage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (activeGame?.config) {
      setCooldownHours(String(activeGame.config.cooldownHours ?? 24))
      setPrimaryColor(activeGame.config.primaryColor ?? "#4ECDC4")
      setSecondaryColor(activeGame.config.secondaryColor ?? "#FF6B6B")
      setBackgroundImage(activeGame.config.backgroundImage ?? "")
    }
  }, [activeGame])

  const handleSave = async () => {
    if (!activeGame) {
      toast.error("Aucun jeu configuré. Créez d'abord un jeu dans la page Jeux.")
      return
    }

    setIsSaving(true)
    try {
      // Update all games with the global settings
      const promises = (games ?? []).map((game) =>
        updateGame({
          id: game._id,
          config: {
            cooldownHours: parseInt(cooldownHours, 10) || 24,
            primaryColor,
            secondaryColor,
            backgroundImage: backgroundImage || undefined,
          },
        })
      )
      await Promise.all(promises)
      toast.success("Paramètres enregistrés")
    } catch (error: unknown) {
      toast.error("Échec de l'enregistrement")
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SettingsIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour les paramètres</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (games === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration globale du module gamification
        </p>
      </div>

      <div className="max-w-lg space-y-6">
        <div className="border border-border/50 rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Cooldown</h2>
          <div className="space-y-2">
            <Label htmlFor="cooldownHours">Délai entre deux parties (heures)</Label>
            <Input
              id="cooldownHours"
              type="number"
              min={1}
              max={720}
              value={cooldownHours}
              onChange={(e) => setCooldownHours(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Un même joueur ne pourra pas rejouer avant ce délai
            </p>
          </div>
        </div>

        <div className="border border-border/50 rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Thème visuel</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Couleur primaire</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-9 rounded border border-input cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Couleur secondaire</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="secondaryColor"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-9 w-9 rounded border border-input cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Color preview */}
          <div className="flex gap-3">
            <div className="h-12 w-24 rounded-lg" style={{ backgroundColor: primaryColor }} />
            <div className="h-12 w-24 rounded-lg" style={{ backgroundColor: secondaryColor }} />
          </div>
        </div>

        <div className="border border-border/50 rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Arrière-plan du jeu</h2>
          <ImageUpload
            value={backgroundImage}
            onChange={setBackgroundImage}
            folder="games"
            placeholder="Glissez une image ou cliquez pour sélectionner"
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Enregistrement..." : "Enregistrer les paramètres"}
        </Button>

        {games.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Les paramètres seront appliqués lorsque vous créerez un jeu.
          </p>
        )}
      </div>
    </div>
  )
}
