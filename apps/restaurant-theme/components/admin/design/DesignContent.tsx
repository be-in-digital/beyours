"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { useState } from "react"
import { PaletteIcon, CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"
import { cn } from "@/lib/utils"

const themes = [
  { id: "fast-food", name: "Fast Food", primary: "#FF6B00", secondary: "#FFF3E0", accent: "#FF9800" },
  { id: "pizzeria", name: "Pizzeria", primary: "#D32F2F", secondary: "#FFEBEE", accent: "#FF5722" },
  { id: "chinese", name: "Chinese", primary: "#C62828", secondary: "#FFF8E1", accent: "#FFD600" },
  { id: "fine-dining", name: "Fine Dining", primary: "#1A237E", secondary: "#E8EAF6", accent: "#9FA8DA" },
  { id: "cafe", name: "Cafe", primary: "#4E342E", secondary: "#EFEBE9", accent: "#8D6E63" },
  { id: "sushi", name: "Sushi", primary: "#1B5E20", secondary: "#E8F5E9", accent: "#66BB6A" },
]

interface DesignContentProps {
  /** When true, hides the page header for embedded usage within tabs */
  embedded?: boolean
}

export function DesignContent({ embedded = false }: DesignContentProps) {
  const storeId = useAdminStoreId()
  const store = useQuery(
    api.stores.getById,
    storeId ? { id: storeId } : "skip"
  )
  const updateBranding = useMutation(api.stores.updateBranding)

  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState("#000000")
  const [secondaryColor, setSecondaryColor] = useState("#ffffff")
  const [accentColor, setAccentColor] = useState("#0066cc")
  const [fontHeading, setFontHeading] = useState("Inter")
  const [fontBody, setFontBody] = useState("Inter")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")

  // Initialize state when store loads
  if (store && primaryColor === "#000000" && store.branding) {
    setPrimaryColor(store.branding.primaryColor || "#000000")
    setSecondaryColor(store.branding.secondaryColor || "#ffffff")
    setAccentColor(store.branding.accentColor || "#0066cc")
    setFontHeading(store.branding.fontHeading || "Inter")
    setFontBody(store.branding.fontBody || "Inter")
    setLogoUrl(store.branding.logoUrl || "")
    setFaviconUrl(store.branding.faviconUrl || "")
  }

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
        branding: {
          primaryColor,
          secondaryColor,
          accentColor,
        },
      })
      toast.success("Colors updated successfully")
    } catch (error) {
      toast.error("Failed to update colors")
      console.error(error)
    }
  }

  const handleSaveTypography = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        branding: {
          fontHeading,
          fontBody,
        },
      })
      toast.success("Typography updated successfully")
    } catch (error) {
      toast.error("Failed to update typography")
      console.error(error)
    }
  }

  const handleSaveLogo = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        branding: {
          logoUrl: logoUrl || undefined,
          faviconUrl: faviconUrl || undefined,
        },
      })
      toast.success("Logo updated successfully")
    } catch (error) {
      toast.error("Failed to update logo")
      console.error(error)
    }
  }

  if (!storeId) {
    return (
      <EmptyState
        icon={PaletteIcon}
        title="No store selected"
        description="Please select a store to manage design"
      />
    )
  }

  if (store === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold">Design</h1>
          <p className="text-muted-foreground mt-2">
            Customize your store's look and feel
          </p>
        </div>
      )}

      <Tabs defaultValue="theme" className="space-y-4">
        <TabsList>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className={cn(
                  "border rounded-lg p-6 cursor-pointer hover:shadow-md transition-all",
                  selectedTheme === theme.id && "ring-2 ring-primary"
                )}
                onClick={() => handleApplyTheme(theme)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{theme.name}</h3>
                  {selectedTheme === theme.id && (
                    <CheckIcon className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    className="h-12 rounded border"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div
                    className="h-12 rounded border"
                    style={{ backgroundColor: theme.secondary }}
                  />
                  <div
                    className="h-12 rounded border"
                    style={{ backgroundColor: theme.accent }}
                  />
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>Primary: {theme.primary}</p>
                  <p>Secondary: {theme.secondary}</p>
                  <p>Accent: {theme.accent}</p>
                </div>
              </div>
            ))}
          </div>
          {selectedTheme && (
            <Button onClick={handleSaveColors}>Apply Selected Theme</Button>
          )}
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </div>
                <div
                  className="h-20 rounded border"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                  />
                </div>
                <div
                  className="h-20 rounded border"
                  style={{ backgroundColor: secondaryColor }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="accentColor"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                </div>
                <div
                  className="h-20 rounded border"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </div>
            <Button onClick={handleSaveColors}>Save Colors</Button>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontHeading">Heading Font</Label>
                <Input
                  id="fontHeading"
                  value={fontHeading}
                  onChange={(e) => setFontHeading(e.target.value)}
                  placeholder="Inter, Roboto, Arial..."
                />
                <div
                  className="p-4 border rounded text-2xl font-bold"
                  style={{ fontFamily: fontHeading }}
                >
                  Sample Heading
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontBody">Body Font</Label>
                <Input
                  id="fontBody"
                  value={fontBody}
                  onChange={(e) => setFontBody(e.target.value)}
                  placeholder="Inter, Roboto, Arial..."
                />
                <div
                  className="p-4 border rounded"
                  style={{ fontFamily: fontBody }}
                >
                  This is sample body text that shows how your content will look
                  with the selected font.
                </div>
              </div>
            </div>
            <Button onClick={handleSaveTypography}>Save Typography</Button>
          </div>
        </TabsContent>

        <TabsContent value="logo" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                />
                {logoUrl && (
                  <div className="border rounded p-4 flex items-center justify-center bg-muted">
                    <img src={logoUrl} alt="Logo" className="max-h-20" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Favicon URL</Label>
                <Input
                  id="faviconUrl"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://..."
                />
                {faviconUrl && (
                  <div className="border rounded p-4 flex items-center justify-center bg-muted">
                    <img src={faviconUrl} alt="Favicon" className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleSaveLogo}>Save Logo</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
