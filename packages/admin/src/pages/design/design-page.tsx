"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect, useRef } from "react"
import { PaletteIcon, CheckIcon } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { cn } from "../../lib/utils"
import { ResolvingStore } from "../../components/resolving-store"
import { brandingControlState } from "../../lib/branding-eligibility"
import { BrandingControl } from "./branding-control"
import { BrandingPreview } from "./branding-preview"

/**
 * Font families a diner's browser will actually have.
 *
 * Nothing here fetches a webfont: the engine bundles Inter and Poppins through
 * `next/font` and a stored family renders only if the visitor's device already
 * has it. Offering these as suggestions rather than a closed list keeps an
 * establishment free to name a font it installs itself, while making the safe
 * answers the easy ones. The warning under the fields says the rest.
 */
const SAFE_FONTS = [
  "Inter",
  "Poppins",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Courier New",
]

const themes = [
  { id: "fast-food", name: "Fast Food", primary: "#FF6B00", secondary: "#FFF3E0", accent: "#FF9800" },
  { id: "pizzeria", name: "Pizzeria", primary: "#D32F2F", secondary: "#FFEBEE", accent: "#FF5722" },
  { id: "chinese", name: "Chinois", primary: "#C62828", secondary: "#FFF8E1", accent: "#FFD600" },
  { id: "fine-dining", name: "Gastronomie", primary: "#1A237E", secondary: "#E8EAF6", accent: "#9FA8DA" },
  { id: "cafe", name: "Café", primary: "#4E342E", secondary: "#EFEBE9", accent: "#8D6E63" },
  { id: "sushi", name: "Sushi", primary: "#1B5E20", secondary: "#E8F5E9", accent: "#66BB6A" },
]

interface DesignPageProps {
  embedded?: boolean
}

export function DesignPage({ embedded = false }: DesignPageProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  // `stores:read` gets a role onto this screen; `stores:write` is what
  // `stores.updateBranding` checks on the click. `manager` holds the first and
  // not the second, so the two sets are not the same people.
  const role = useAdminAuthStore((s) => s.role)
  const branding = brandingControlState(role)
  const store = useQuery(
    api?.stores?.getById,
    storeId ? { id: storeId } : "skip"
  )
  const updateBranding = useMutation(api?.stores?.updateBranding)

  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState("#000000")
  const [secondaryColor, setSecondaryColor] = useState("#ffffff")
  const [accentColor, setAccentColor] = useState("#0066cc")
  const [fontHeading, setFontHeading] = useState("Inter")
  const [fontBody, setFontBody] = useState("Inter")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")

  const initialized = useRef(false)
  useEffect(() => {
    if (store?.branding && !initialized.current) {
      setPrimaryColor(store.branding.primaryColor || "#000000")
      setSecondaryColor(store.branding.secondaryColor || "#ffffff")
      setAccentColor(store.branding.accentColor || "#0066cc")
      setFontHeading(store.branding.fontHeading || "Inter")
      setFontBody(store.branding.fontBody || "Inter")
      setLogoUrl(store.branding.logoUrl || "")
      setFaviconUrl(store.branding.faviconUrl || "")
      initialized.current = true
    }
  }, [store])

  const handleApplyTheme = (theme: typeof themes[0]) => {
    setSelectedTheme(theme.id)
    setPrimaryColor(theme.primary)
    setSecondaryColor(theme.secondary)
    setAccentColor(theme.accent)
  }

  const handleSaveColors = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        branding: { primaryColor, secondaryColor, accentColor },
      })
      toast.success("Couleurs mises à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour des couleurs")
      console.error(error)
    }
  }

  const handleSaveTypography = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        branding: { fontHeading, fontBody },
      })
      toast.success("Typographie mise à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour de la typographie")
      console.error(error)
    }
  }

  const handleSaveLogo = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        // Sent as written, empty string included. `stores.updateBranding`
        // merges, so an absent field means "untouched" and would make clearing
        // a logo impossible; `""` is what tells it to remove the field.
        branding: { logoUrl, faviconUrl },
      })
      toast.success("Logo mis à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour du logo")
      console.error(error)
    }
  }

  if (!storeId) return <ResolvingStore />

  if (store === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Design</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalisez l'apparence de votre établissement
          </p>
        </div>
      )}

      <Tabs defaultValue="theme" className="space-y-4">
        <TabsList>
          <TabsTrigger value="theme">Thème</TabsTrigger>
          <TabsTrigger value="colors">Couleurs</TabsTrigger>
          <TabsTrigger value="typography">Typographie</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className={cn(
                  "border border-border/50 rounded-xl p-5 cursor-pointer hover:shadow-sm transition-all",
                  selectedTheme === theme.id && "ring-2 ring-primary"
                )}
                onClick={() => handleApplyTheme(theme)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">{theme.name}</h3>
                  {selectedTheme === theme.id && (
                    <CheckIcon className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-10 rounded-lg border" style={{ backgroundColor: theme.primary }} />
                  <div className="h-10 rounded-lg border" style={{ backgroundColor: theme.secondary }} />
                  <div className="h-10 rounded-lg border" style={{ backgroundColor: theme.accent }} />
                </div>
                <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                  <p>Primaire : {theme.primary}</p>
                  <p>Secondaire : {theme.secondary}</p>
                  <p>Accent : {theme.accent}</p>
                </div>
              </div>
            ))}
          </div>
          {selectedTheme && (
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveColors}>
                Appliquer le thème sélectionné
              </Button>
            </BrandingControl>
          )}
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Couleur primaire</Label>
                <div className="flex gap-2">
                  <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 h-9" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
                <div className="h-16 rounded-lg border" style={{ backgroundColor: primaryColor }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Couleur secondaire</Label>
                <div className="flex gap-2">
                  <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-16 h-9" />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                </div>
                <div className="h-16 rounded-lg border" style={{ backgroundColor: secondaryColor }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Couleur d'accent</Label>
                <div className="flex gap-2">
                  <Input id="accentColor" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-16 h-9" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                </div>
                <div className="h-16 rounded-lg border" style={{ backgroundColor: accentColor }} />
              </div>
            </div>
            <BrandingPreview
              branding={{ primaryColor, secondaryColor, accentColor, fontHeading, fontBody }}
            />
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveColors}>
                Enregistrer les couleurs
              </Button>
            </BrandingControl>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <datalist id="beid-safe-fonts">
              {SAFE_FONTS.map((font) => (
                <option key={font} value={font} />
              ))}
            </datalist>
            <p className="text-sm text-muted-foreground">
              Une police ne s&apos;affiche que si l&apos;appareil du client la
              possède déjà — le site ne télécharge aucune police. Inter et
              Poppins sont fournies avec le site et fonctionnent partout ; les
              autres suggestions sont installées sur presque tous les appareils.
              Une police introuvable revient à la police par défaut.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontHeading">Police des titres</Label>
                <Input id="fontHeading" list="beid-safe-fonts" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} placeholder="Inter, Poppins, Georgia..." />
                <div className="p-4 border rounded-lg text-2xl font-bold" style={{ fontFamily: fontHeading }}>
                  Exemple de titre
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontBody">Police du texte</Label>
                <Input id="fontBody" list="beid-safe-fonts" value={fontBody} onChange={(e) => setFontBody(e.target.value)} placeholder="Inter, Poppins, Georgia..." />
                <div className="p-4 border rounded-lg text-sm" style={{ fontFamily: fontBody }}>
                  Ceci est un exemple de texte qui montre comment votre contenu
                  apparaîtra avec la police sélectionnée.
                </div>
              </div>
            </div>
            <BrandingPreview
              branding={{ primaryColor, secondaryColor, accentColor, fontHeading, fontBody }}
            />
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveTypography}>
                Enregistrer la typographie
              </Button>
            </BrandingControl>
          </div>
        </TabsContent>

        <TabsContent value="logo" className="space-y-4">
          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Ces adresses servent de repli : si vous avez déposé un logo ou un
              favicon dans le CMS (Contenu → Layout du storefront), c&apos;est
              celui-là qui s&apos;affiche.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL du logo</Label>
                <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                {logoUrl && (
                  <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/50">
                    <img src={logoUrl} alt="Logo" className="max-h-20" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">URL du favicon</Label>
                <Input id="faviconUrl" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://..." />
                {faviconUrl && (
                  <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/50">
                    <img src={faviconUrl} alt="Favicon" className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveLogo}>
                Enregistrer le logo
              </Button>
            </BrandingControl>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
