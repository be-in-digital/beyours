"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, use, useEffect } from "react"
import { RefreshCw, Loader2, HelpCircle, ExternalLink, Download, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@beindigital-engine/ui"
import { Input } from "@beindigital-engine/ui"
import { Label } from "@beindigital-engine/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@beindigital-engine/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@beindigital-engine/ui"
import { Switch } from "@beindigital-engine/ui"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@beindigital-engine/ui"
import { Badge } from "@beindigital-engine/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@beindigital-engine/ui"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@beindigital-engine/ui"
import { AddressAutocomplete, type AddressValue } from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { centsToEuros, eurosToCents } from "../../lib/formatters"

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// Day mapping: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

// Display order: Monday to Sunday
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type DayHours = {
  day: number
  open: string
  close: string
  isClosed: boolean
}

type StoreOverrides = {
  services?: {
    dineIn?: boolean
    takeaway?: boolean
    delivery?: boolean
    clickAndCollect?: boolean
  }
  minimumOrderAmount?: number
  deliveryRadius?: number
  deliveryFee?: number
  deliveryFreeAbove?: number
}

type StoreIntegration = {
  _id: string
  storeId: string
  platform: "uberEats" | "deliveroo"
  platformStoreId: string
  syncMenu: boolean
  autoAccept: boolean
  enabled: boolean
  storeStatus?: "ONLINE" | "PAUSED" | "OFFLINE"
  prepTime?: number
  brandId?: string
  menuSyncStatus?: "idle" | "syncing" | "success" | "error"
  menuSyncError?: string
  lastMenuSyncAt?: number
}

export function StoreDetailPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params)
  const { api } = useAdminApiStore()
  const store = useQuery(api.stores.getById, { id: storeId as string })
  const globalSettings = useQuery(api.globalSettings.get)
  const storeIntegrations = useQuery(api.storeIntegrations.listByStore, { storeId: storeId as string })

  const updateStore = useMutation(api.stores.update)
  const updateAddressMutation = useMutation(api.stores.updateAddress)
  const updateHours = useMutation(api.stores.updateHours)
  const updateOverrides = useMutation(api.stores.updateOverrides)
  const upsertIntegration = useMutation(api.storeIntegrations.upsert)
  const removeIntegration = useMutation(api.storeIntegrations.remove)

  // General tab state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"draft" | "open" | "closed" | "temporarily_unavailable">("draft")
  const [address, setAddress] = useState<AddressValue>({
    street: "",
    city: "",
    postalCode: "",
    country: "France",
  })

  // Hours tab state
  const [useGlobalHours, setUseGlobalHours] = useState(true)
  const [hours, setHours] = useState<DayHours[]>([])

  // Settings tab state - override toggles
  const [customizeServices, setCustomizeServices] = useState(false)
  const [customizeMinOrder, setCustomizeMinOrder] = useState(false)
  const [customizeDeliveryRadius, setCustomizeDeliveryRadius] = useState(false)
  const [customizeDeliveryFee, setCustomizeDeliveryFee] = useState(false)
  const [customizeDeliveryFree, setCustomizeDeliveryFree] = useState(false)

  // Settings tab state - values
  const [dineIn, setDineIn] = useState(true)
  const [takeaway, setTakeaway] = useState(true)
  const [delivery, setDelivery] = useState(true)
  const [clickAndCollect, setClickAndCollect] = useState(true)
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("")
  const [deliveryRadius, setDeliveryRadius] = useState("")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [deliveryFreeAbove, setDeliveryFreeAbove] = useState("")

  // Integrations tab state
  const [uberEatsStoreId, setUberEatsStoreId] = useState("")
  const [uberEatsSyncMenu, setUberEatsSyncMenu] = useState(true)
  const [uberEatsAutoAccept, setUberEatsAutoAccept] = useState(true)
  const [uberEatsEnabled, setUberEatsEnabled] = useState(true)
  const [uberEatsStoreStatus, setUberEatsStoreStatus] = useState<"ONLINE" | "PAUSED" | "OFFLINE">("OFFLINE")
  const [uberEatsPrepTime, setUberEatsPrepTime] = useState("")

  const [deliverooStoreId, setDeliverooStoreId] = useState("")
  const [deliverooBrandId, setDeliverooBrandId] = useState("")
  const [deliverooSyncMenu, setDeliverooSyncMenu] = useState(true)
  const [deliverooAutoAccept, setDeliverooAutoAccept] = useState(true)
  const [deliverooEnabled, setDeliverooEnabled] = useState(true)
  const [deliverooStoreStatus, setDeliverooStoreStatus] = useState<"ONLINE" | "PAUSED" | "OFFLINE">("OFFLINE")
  const [deliverooPrepTime, setDeliverooPrepTime] = useState("")

  // Validation state (separate per platform)
  const [isValidatingUberEats, setIsValidatingUberEats] = useState(false)
  const [isValidatingDeliveroo, setIsValidatingDeliveroo] = useState(false)
  const validateIntegration = useAction(api.validateIntegration.validate)

  // Initialize state when store loads
  useEffect(() => {
    if (!store) return

    setName(store.name)
    setSlug(store.slug)
    setDescription(store.description || "")
    setPhone(store.phone || "")
    setEmail(store.email || "")
    setStatus(store.status as "draft" | "open" | "closed" | "temporarily_unavailable")

    if (store.address) {
      setAddress({
        street: store.address.street || "",
        city: store.address.city || "",
        postalCode: store.address.postalCode || "",
        country: store.address.country || "France",
        latitude: store.address.latitude,
        longitude: store.address.longitude,
      })
    }

    setUseGlobalHours(store.useGlobalHours ?? true)

    // Initialize hours
    if (store.hours && Array.isArray(store.hours)) {
      setHours(store.hours as DayHours[])
    } else {
      // Default hours: 9:00-22:00 for all days
      setHours(
        [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        }))
      )
    }

    // Initialize overrides
    const overrides = store.overrides as StoreOverrides | undefined
    if (overrides) {
      if (overrides.services) {
        setCustomizeServices(true)
        setDineIn(overrides.services.dineIn ?? true)
        setTakeaway(overrides.services.takeaway ?? true)
        setDelivery(overrides.services.delivery ?? true)
        setClickAndCollect(overrides.services.clickAndCollect ?? true)
      }
      if (overrides.minimumOrderAmount !== undefined) {
        setCustomizeMinOrder(true)
        setMinimumOrderAmount(centsToEuros(overrides.minimumOrderAmount).toString())
      }
      if (overrides.deliveryRadius !== undefined) {
        setCustomizeDeliveryRadius(true)
        setDeliveryRadius((overrides.deliveryRadius / 1000).toString())
      }
      if (overrides.deliveryFee !== undefined) {
        setCustomizeDeliveryFee(true)
        setDeliveryFee(centsToEuros(overrides.deliveryFee).toString())
      }
      if (overrides.deliveryFreeAbove !== undefined) {
        setCustomizeDeliveryFree(true)
        setDeliveryFreeAbove(centsToEuros(overrides.deliveryFreeAbove).toString())
      }
    }
  }, [store])

  // Initialize integrations when loaded
  useEffect(() => {
    if (!storeIntegrations) return

    const uberEats = storeIntegrations.find((i: StoreIntegration) => i.platform === "uberEats")
    if (uberEats) {
      setUberEatsStoreId(uberEats.platformStoreId)
      setUberEatsSyncMenu(uberEats.syncMenu)
      setUberEatsAutoAccept(uberEats.autoAccept)
      setUberEatsEnabled(uberEats.enabled)
      setUberEatsStoreStatus(uberEats.storeStatus ?? "OFFLINE")
      setUberEatsPrepTime(uberEats.prepTime?.toString() ?? "")
    }

    const deliveroo = storeIntegrations.find((i: StoreIntegration) => i.platform === "deliveroo")
    if (deliveroo) {
      setDeliverooStoreId(deliveroo.platformStoreId)
      setDeliverooBrandId(deliveroo.brandId ?? "")
      setDeliverooSyncMenu(deliveroo.syncMenu)
      setDeliverooAutoAccept(deliveroo.autoAccept)
      setDeliverooEnabled(deliveroo.enabled)
      setDeliverooStoreStatus(deliveroo.storeStatus ?? "OFFLINE")
      setDeliverooPrepTime(deliveroo.prepTime?.toString() ?? "")
    }
  }, [storeIntegrations])

  const handleUpdateGeneral = async () => {
    try {
      await updateStore({
        id: storeId as string,
        name,
        slug,
        description: description || undefined,
        phone: phone || undefined,
        email: email || undefined,
        status,
        useGlobalHours,
      })

      await updateAddressMutation({
        id: storeId as string,
        address: {
          street: address.street,
          city: address.city,
          postalCode: address.postalCode,
          country: address.country,
          latitude: address.latitude,
          longitude: address.longitude,
        },
      })

      toast.success("Informations générales mises à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour")
      console.error(error)
    }
  }

  const handleUpdateHours = async () => {
    try {
      await updateStore({
        id: storeId as string,
        useGlobalHours,
      })

      if (!useGlobalHours) {
        await updateHours({
          id: storeId as string,
          hours,
        })
      }

      toast.success("Horaires mis à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour des horaires")
      console.error(error)
    }
  }

  const handleSetAllWeekdays = () => {
    const mondayHours = hours.find((h) => h.day === 1)
    if (!mondayHours) return

    const newHours = hours.map((h) => {
      if (h.day >= 1 && h.day <= 5) {
        return { ...h, open: mondayHours.open, close: mondayHours.close, isClosed: mondayHours.isClosed }
      }
      return h
    })
    setHours(newHours)
  }

  const handleSetAllDays = () => {
    const mondayHours = hours.find((h) => h.day === 1)
    if (!mondayHours) return

    const newHours = hours.map((h) => ({
      ...h,
      open: mondayHours.open,
      close: mondayHours.close,
      isClosed: mondayHours.isClosed,
    }))
    setHours(newHours)
  }

  const handleUpdateSettings = async () => {
    try {
      const overrides: StoreOverrides = {}

      if (customizeServices) {
        overrides.services = {
          dineIn,
          takeaway,
          delivery,
          clickAndCollect,
        }
      }

      if (customizeMinOrder && minimumOrderAmount) {
        overrides.minimumOrderAmount = eurosToCents(parseFloat(minimumOrderAmount))
      }

      if (customizeDeliveryRadius && deliveryRadius) {
        overrides.deliveryRadius = Math.round(parseFloat(deliveryRadius) * 1000)
      }

      if (customizeDeliveryFee && deliveryFee) {
        overrides.deliveryFee = eurosToCents(parseFloat(deliveryFee))
      }

      if (customizeDeliveryFree && deliveryFreeAbove) {
        overrides.deliveryFreeAbove = eurosToCents(parseFloat(deliveryFreeAbove))
      }

      await updateOverrides({
        id: storeId as string,
        overrides,
      })

      toast.success("Paramètres mis à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour des paramètres")
      console.error(error)
    }
  }

  const handleSaveUberEats = async () => {
    if (!uberEatsStoreId.trim()) {
      toast.error("Veuillez saisir l'ID du restaurant Uber Eats")
      return
    }

    setIsValidatingUberEats(true)
    try {
      const validation = await validateIntegration({
        platform: "uberEats",
        platformStoreId: uberEatsStoreId,
      }) as { valid: boolean; error?: string }

      if (!validation.valid) {
        toast.error(`Connexion Uber Eats echouee : ${validation.error}`)
        return
      }

      await upsertIntegration({
        storeId: storeId as string,
        platform: "uberEats",
        platformStoreId: uberEatsStoreId,
        syncMenu: uberEatsSyncMenu,
        autoAccept: uberEatsAutoAccept,
        enabled: uberEatsEnabled,
        storeStatus: uberEatsStoreStatus,
        prepTime: uberEatsPrepTime ? parseInt(uberEatsPrepTime, 10) : undefined,
      })

      toast.success("Integration Uber Eats verifiee et enregistree")
    } catch (error) {
      toast.error("Echec de la validation Uber Eats")
      console.error(error)
    } finally {
      setIsValidatingUberEats(false)
    }
  }

  const handleSaveDeliveroo = async () => {
    if (!deliverooStoreId.trim()) {
      toast.error("Veuillez saisir l'ID du restaurant Deliveroo")
      return
    }

    if (!deliverooBrandId.trim()) {
      toast.error("Veuillez saisir le Brand ID Deliveroo")
      return
    }

    setIsValidatingDeliveroo(true)
    try {
      const validation = await validateIntegration({
        platform: "deliveroo",
        platformStoreId: deliverooStoreId,
        brandId: deliverooBrandId,
      }) as { valid: boolean; error?: string }

      if (!validation.valid) {
        toast.error(`Connexion Deliveroo echouee : ${validation.error}`)
        return
      }

      await upsertIntegration({
        storeId: storeId as string,
        platform: "deliveroo",
        platformStoreId: deliverooStoreId,
        syncMenu: deliverooSyncMenu,
        autoAccept: deliverooAutoAccept,
        enabled: deliverooEnabled,
        storeStatus: deliverooStoreStatus,
        prepTime: deliverooPrepTime ? parseInt(deliverooPrepTime, 10) : undefined,
        brandId: deliverooBrandId || undefined,
      })

      toast.success("Integration Deliveroo verifiee et enregistree")
    } catch (error) {
      toast.error("Echec de la validation Deliveroo")
      console.error(error)
    } finally {
      setIsValidatingDeliveroo(false)
    }
  }

  const handleRemoveUberEats = async () => {
    try {
      const integration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "uberEats")
      if (!integration) return

      await removeIntegration({ id: integration._id })
      setUberEatsStoreId("")
      setUberEatsSyncMenu(false)
      setUberEatsAutoAccept(false)
      setUberEatsEnabled(false)
      setUberEatsStoreStatus("OFFLINE")
      setUberEatsPrepTime("")
      toast.success("Intégration Uber Eats supprimée")
    } catch (error) {
      toast.error("Échec de la suppression")
      console.error(error)
    }
  }

  // Menu sync loading states
  const [isSyncingUberEats, setIsSyncingUberEats] = useState(false)
  const [isSyncingDeliveroo, setIsSyncingDeliveroo] = useState(false)

  // Import loading states
  const [isImportingUberEats, setIsImportingUberEats] = useState(false)
  const [isImportingDeliveroo, setIsImportingDeliveroo] = useState(false)

  const syncUberEatsStore = useAction(api.uberEatsMenuSync.syncStore)
  const syncDeliverooStore = useAction(api.deliverooMenuSync.syncStore)
  const importFromUberEats = useAction(api.uberEatsImport.importFromStore)
  const importFromDeliveroo = useAction(api.deliverooImport.importFromStore)

  const handleSyncUberEatsMenu = async () => {
    setIsSyncingUberEats(true)
    try {
      await syncUberEatsStore({ storeId })
      toast.success("Menu Uber Eats synchronisé avec succès")
    } catch (error) {
      toast.error("Erreur lors de la synchronisation du menu Uber Eats")
      console.error(error)
    } finally {
      setIsSyncingUberEats(false)
    }
  }

  const handleSyncDeliverooMenu = async () => {
    setIsSyncingDeliveroo(true)
    try {
      await syncDeliverooStore({ storeId })
      toast.success("Menu Deliveroo synchronise avec succes")
    } catch (error) {
      toast.error("Erreur lors de la synchronisation du menu Deliveroo")
      console.error(error)
    } finally {
      setIsSyncingDeliveroo(false)
    }
  }

  const handleImportUberEats = async () => {
    setIsImportingUberEats(true)
    try {
      const result = await importFromUberEats({ storeId }) as {
        success: boolean
        error?: string
        imported: number
        skipped: number
        categoriesCreated: number
      }
      if (result.success) {
        toast.success(
          `Import Uber Eats : ${result.imported} produit(s) importé(s), ${result.skipped} ignoré(s), ${result.categoriesCreated} catégorie(s) créée(s)`
        )
      } else {
        toast.error(`Erreur import Uber Eats : ${result.error}`)
      }
    } catch (error) {
      toast.error("Erreur lors de l'import des produits Uber Eats")
      console.error(error)
    } finally {
      setIsImportingUberEats(false)
    }
  }

  const handleImportDeliveroo = async () => {
    setIsImportingDeliveroo(true)
    try {
      const result = await importFromDeliveroo({ storeId }) as {
        success: boolean
        error?: string
        imported: number
        skipped: number
        categoriesCreated: number
      }
      if (result.success) {
        toast.success(
          `Import Deliveroo : ${result.imported} produit(s) importé(s), ${result.skipped} ignoré(s), ${result.categoriesCreated} catégorie(s) créée(s)`
        )
      } else {
        toast.error(`Erreur import Deliveroo : ${result.error}`)
      }
    } catch (error) {
      toast.error("Erreur lors de l'import des produits Deliveroo")
      console.error(error)
    } finally {
      setIsImportingDeliveroo(false)
    }
  }

  const handleRemoveDeliveroo = async () => {
    try {
      const integration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "deliveroo")
      if (!integration) return

      await removeIntegration({ id: integration._id })
      setDeliverooStoreId("")
      setDeliverooBrandId("")
      setDeliverooSyncMenu(false)
      setDeliverooAutoAccept(false)
      setDeliverooEnabled(false)
      setDeliverooStoreStatus("OFFLINE")
      setDeliverooPrepTime("")
      toast.success("Intégration Deliveroo supprimée")
    } catch (error) {
      toast.error("Échec de la suppression")
      console.error(error)
    }
  }

  if (!store) {
    return <LoadingState />
  }

  // Check if global integrations are configured
  const hasUberEatsGlobal = globalSettings?.integrations?.uberEats?.enabled
  const hasDeliverooGlobal = globalSettings?.integrations?.deliveroo?.enabled

  // Get global settings values for hints
  const globalServices = globalSettings?.services || {
    dineIn: true,
    takeaway: true,
    delivery: true,
    clickAndCollect: true,
  }
  const globalMinOrder = globalSettings?.minimumOrderAmount
    ? centsToEuros(globalSettings.minimumOrderAmount)
    : 10
  const globalDeliveryRadius = globalSettings?.delivery?.radius
    ? globalSettings.delivery.radius / 1000
    : 5
  const globalDeliveryFee = globalSettings?.delivery?.fee ? centsToEuros(globalSettings.delivery.fee) : 3
  const globalDeliveryFree = globalSettings?.delivery?.freeAbove
    ? centsToEuros(globalSettings.delivery.freeAbove)
    : 30

  // Get global hours for display
  const globalHours = globalSettings?.hours || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez les détails et paramètres de l'établissement</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="hours">Horaires</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l'établissement</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="closed">Fermé</SelectItem>
                      <SelectItem value="temporarily_unavailable">Temporairement indisponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Adresse</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressAutocomplete
                label="Adresse de l'établissement"
                value={address}
                onChange={setAddress}
                apiKey={GOOGLE_MAPS_API_KEY}
              />
            </CardContent>
          </Card>

          <Button onClick={handleUpdateGeneral} size="sm">
            Enregistrer
          </Button>
        </TabsContent>

        {/* HOURS TAB */}
        <TabsContent value="hours" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Horaires d'ouverture</CardTitle>
                  <CardDescription className="mt-1">
                    {useGlobalHours
                      ? "Cet établissement utilise les horaires globaux"
                      : "Horaires personnalisés pour cet établissement"
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Label
                    htmlFor="useGlobalHours"
                    className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap"
                  >
                    Horaires globaux
                  </Label>
                  <Switch
                    id="useGlobalHours"
                    checked={useGlobalHours}
                    onCheckedChange={setUseGlobalHours}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Global hours (read-only) */}
              {useGlobalHours && globalHours.length > 0 && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="space-y-2">
                    {DISPLAY_ORDER.map((dayNum) => {
                      const dayH = globalHours.find((h: DayHours) => h.day === dayNum)
                      if (!dayH) return null
                      return (
                        <div key={dayNum} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="font-medium w-24">{DAY_NAMES[dayNum]}</span>
                          <span className="text-muted-foreground">
                            {dayH.isClosed ? "Fermé" : `${dayH.open} – ${dayH.close}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Custom hours editor */}
              {!useGlobalHours && (
                <>
                  <div className="flex flex-wrap gap-2 pb-2">
                    <Button variant="outline" size="sm" onClick={handleSetAllWeekdays}>
                      Appliquer Lundi à Vendredi
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSetAllDays}>
                      Appliquer à tous les jours
                    </Button>
                  </div>

                  <div className="divide-y">
                    {DISPLAY_ORDER.map((dayNum) => {
                      const dayHours = hours.find((h) => h.day === dayNum)
                      if (!dayHours) return null
                      const index = hours.indexOf(dayHours)

                      return (
                        <div
                          key={dayNum}
                          className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${dayHours.isClosed ? "opacity-50" : ""}`}
                        >
                          <span className="w-24 text-sm font-medium shrink-0">
                            {DAY_NAMES[dayNum]}
                          </span>

                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <Input
                              id={`open-${dayNum}`}
                              type="time"
                              value={dayHours.open}
                              onChange={(e) => {
                                const newHours = [...hours]
                                newHours[index] = { ...dayHours, open: e.target.value }
                                setHours(newHours)
                              }}
                              disabled={dayHours.isClosed}
                              className="w-[120px]"
                            />
                            <span className="text-muted-foreground text-sm">–</span>
                            <Input
                              id={`close-${dayNum}`}
                              type="time"
                              value={dayHours.close}
                              onChange={(e) => {
                                const newHours = [...hours]
                                newHours[index] = { ...dayHours, close: e.target.value }
                                setHours(newHours)
                              }}
                              disabled={dayHours.isClosed}
                              className="w-[120px]"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <Switch
                              id={`closed-${dayNum}`}
                              checked={dayHours.isClosed}
                              onCheckedChange={(checked) => {
                                const newHours = [...hours]
                                newHours[index] = { ...dayHours, isClosed: checked }
                                setHours(newHours)
                              }}
                            />
                            <Label htmlFor={`closed-${dayNum}`} className="text-sm text-muted-foreground cursor-pointer">
                              Fermé
                            </Label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleUpdateHours} size="sm">
            Enregistrer les horaires
          </Button>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Paramètres de l'établissement</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Par défaut, les paramètres globaux s'appliquent. Activez un switch pour personnaliser.
            </p>
          </div>

          {/* Services */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <CardTitle className="text-base">Services disponibles</CardTitle>
                  {customizeServices && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                      Personnalisé
                    </Badge>
                  )}
                </div>
                <Switch
                  checked={customizeServices}
                  onCheckedChange={setCustomizeServices}
                />
              </div>
              {!customizeServices && (
                <CardDescription>
                  Global : Sur place ({globalServices.dineIn ? "Oui" : "Non"}), À emporter ({globalServices.takeaway ? "Oui" : "Non"}), Livraison ({globalServices.delivery ? "Oui" : "Non"}), Click & Collect ({globalServices.clickAndCollect ? "Oui" : "Non"})
                </CardDescription>
              )}
            </CardHeader>
            {customizeServices && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <Label htmlFor="dineIn" className="text-sm cursor-pointer">Sur place</Label>
                    <Switch id="dineIn" checked={dineIn} onCheckedChange={setDineIn} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <Label htmlFor="takeaway" className="text-sm cursor-pointer">À emporter</Label>
                    <Switch id="takeaway" checked={takeaway} onCheckedChange={setTakeaway} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <Label htmlFor="delivery" className="text-sm cursor-pointer">Livraison</Label>
                    <Switch id="delivery" checked={delivery} onCheckedChange={setDelivery} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <Label htmlFor="clickAndCollect" className="text-sm cursor-pointer">Click & Collect</Label>
                    <Switch id="clickAndCollect" checked={clickAndCollect} onCheckedChange={setClickAndCollect} />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Delivery Settings - grouped */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Paramètres de livraison</CardTitle>
              <CardDescription>
                Montant minimum, rayon, frais et seuil de gratuité
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {/* Minimum Order */}
              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Commande minimum</p>
                    {!customizeMinOrder && (
                      <p className="text-xs text-muted-foreground mt-0.5">Global : {globalMinOrder} €</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {customizeMinOrder && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                    )}
                    <Switch checked={customizeMinOrder} onCheckedChange={setCustomizeMinOrder} />
                  </div>
                </div>
                {customizeMinOrder && (
                  <div className="mt-3 max-w-xs">
                    <Label htmlFor="minimumOrderAmount" className="text-xs text-muted-foreground">Montant minimum (€)</Label>
                    <Input
                      id="minimumOrderAmount"
                      type="number"
                      step="0.01"
                      value={minimumOrderAmount}
                      onChange={(e) => setMinimumOrderAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Delivery Radius */}
              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Rayon de livraison</p>
                    {!customizeDeliveryRadius && (
                      <p className="text-xs text-muted-foreground mt-0.5">Global : {globalDeliveryRadius} km</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {customizeDeliveryRadius && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                    )}
                    <Switch checked={customizeDeliveryRadius} onCheckedChange={setCustomizeDeliveryRadius} />
                  </div>
                </div>
                {customizeDeliveryRadius && (
                  <div className="mt-3 max-w-xs">
                    <Label htmlFor="deliveryRadius" className="text-xs text-muted-foreground">Rayon (km)</Label>
                    <Input
                      id="deliveryRadius"
                      type="number"
                      step="0.1"
                      value={deliveryRadius}
                      onChange={(e) => setDeliveryRadius(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Delivery Fee */}
              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Frais de livraison</p>
                    {!customizeDeliveryFee && (
                      <p className="text-xs text-muted-foreground mt-0.5">Global : {globalDeliveryFee} €</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {customizeDeliveryFee && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                    )}
                    <Switch checked={customizeDeliveryFee} onCheckedChange={setCustomizeDeliveryFee} />
                  </div>
                </div>
                {customizeDeliveryFee && (
                  <div className="mt-3 max-w-xs">
                    <Label htmlFor="deliveryFee" className="text-xs text-muted-foreground">Montant (€)</Label>
                    <Input
                      id="deliveryFee"
                      type="number"
                      step="0.01"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Free Delivery Threshold */}
              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Livraison gratuite à partir de</p>
                    {!customizeDeliveryFree && (
                      <p className="text-xs text-muted-foreground mt-0.5">Global : {globalDeliveryFree} €</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {customizeDeliveryFree && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">Personnalisé</Badge>
                    )}
                    <Switch checked={customizeDeliveryFree} onCheckedChange={setCustomizeDeliveryFree} />
                  </div>
                </div>
                {customizeDeliveryFree && (
                  <div className="mt-3 max-w-xs">
                    <Label htmlFor="deliveryFreeAbove" className="text-xs text-muted-foreground">Montant (€)</Label>
                    <Input
                      id="deliveryFreeAbove"
                      type="number"
                      step="0.01"
                      value={deliveryFreeAbove}
                      onChange={(e) => setDeliveryFreeAbove(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleUpdateSettings} size="sm">
            Enregistrer les paramètres
          </Button>
        </TabsContent>

        {/* INTEGRATIONS TAB */}
        <TabsContent value="integrations" className="space-y-4">
          {/* Uber Eats */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Uber Eats</CardTitle>
                  <CardDescription>Configuration de l&apos;intégration Uber Eats pour cet établissement</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const ueIntegration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "uberEats")
                    if (!ueIntegration?.menuSyncStatus || ueIntegration.menuSyncStatus === "idle") return null
                    const statusColors: Record<string, string> = {
                      syncing: "bg-blue-100 text-blue-700",
                      success: "bg-green-100 text-green-700",
                      error: "bg-red-100 text-red-700",
                    }
                    const statusLabels: Record<string, string> = {
                      syncing: "Synchronisation...",
                      success: "Synchronisé",
                      error: "Erreur de sync",
                    }
                    return (
                      <Badge className={statusColors[ueIntegration.menuSyncStatus] ?? ""}>
                        {statusLabels[ueIntegration.menuSyncStatus] ?? ueIntegration.menuSyncStatus}
                      </Badge>
                    )
                  })()}
                  {storeIntegrations?.some((i: StoreIntegration) => i.platform === "uberEats") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {(isSyncingUberEats || isImportingUberEats) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {uberEatsEnabled && uberEatsSyncMenu && (
                          <DropdownMenuItem
                            onClick={handleSyncUberEatsMenu}
                            disabled={isSyncingUberEats}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Synchroniser le menu
                          </DropdownMenuItem>
                        )}
                        {uberEatsEnabled && (
                          <DropdownMenuItem
                            onClick={handleImportUberEats}
                            disabled={isImportingUberEats}
                          >
                            <Download className="h-4 w-4" />
                            Importer les produits
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={handleRemoveUberEats}
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer l&apos;intégration
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasUberEatsGlobal ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Activez d'abord Uber Eats dans les Paramètres Globaux &gt; Intégrations
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="uberEatsStoreId">ID du restaurant Uber Eats</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Comment trouver votre Store ID Uber Eats"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 text-sm" side="right" align="start">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-base">Comment trouver votre Store ID ?</h4>

                            <div className="space-y-2">
                              <p className="font-medium">Méthode 1 : Via Uber Eats Manager</p>
                              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                <li>
                                  Connectez-vous à{" "}
                                  <a
                                    href="https://merchants.ubereats.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-medium text-foreground inline-flex items-center gap-0.5"
                                  >
                                    Uber Eats Manager
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </li>
                                <li>Sélectionnez votre restaurant</li>
                                <li>Regardez l&apos;URL dans la barre d&apos;adresse de votre navigateur</li>
                                <li>Copiez l&apos;identifiant UUID qui apparaît après <code className="bg-muted px-1 py-0.5 rounded text-xs">/home/</code></li>
                              </ol>
                              <div className="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                                merchants.ubereats.com/manager/home/<span className="text-primary font-bold">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="font-medium">Méthode 2 : Via le support Uber Eats</p>
                              <p className="text-muted-foreground">
                                Contactez le support Uber Eats et demandez le <strong>Store ID (UUID)</strong> associé à votre restaurant.
                              </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                              <p className="text-blue-800 text-xs">
                                <strong>Format attendu :</strong> un identifiant de type UUID, par exemple{" "}
                                <code className="bg-blue-100 px-1 rounded">a1b2c3d4-e5f6-7890-abcd-ef1234567890</code>
                              </p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      id="uberEatsStoreId"
                      value={uberEatsStoreId}
                      onChange={(e) => setUberEatsStoreId(e.target.value)}
                      placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="uberEatsStoreStatus">Statut sur la plateforme</Label>
                      <Select value={uberEatsStoreStatus} onValueChange={(v) => setUberEatsStoreStatus(v as "ONLINE" | "PAUSED" | "OFFLINE")}>
                        <SelectTrigger id="uberEatsStoreStatus">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ONLINE">En ligne</SelectItem>
                          <SelectItem value="PAUSED">En pause</SelectItem>
                          <SelectItem value="OFFLINE">Hors ligne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uberEatsPrepTime">Temps de préparation (min)</Label>
                      <Input
                        id="uberEatsPrepTime"
                        type="number"
                        min="1"
                        max="120"
                        value={uberEatsPrepTime}
                        onChange={(e) => setUberEatsPrepTime(e.target.value)}
                        placeholder="15"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="uberEatsSyncMenu">Synchroniser le menu</Label>
                    <Switch
                      id="uberEatsSyncMenu"
                      checked={uberEatsSyncMenu}
                      onCheckedChange={setUberEatsSyncMenu}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="uberEatsAutoAccept">Acceptation automatique des commandes</Label>
                    <Switch
                      id="uberEatsAutoAccept"
                      checked={uberEatsAutoAccept}
                      onCheckedChange={setUberEatsAutoAccept}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="uberEatsEnabled">Intégration activée</Label>
                    <Switch
                      id="uberEatsEnabled"
                      checked={uberEatsEnabled}
                      onCheckedChange={setUberEatsEnabled}
                    />
                  </div>

                  <Button onClick={handleSaveUberEats} size="sm" disabled={isValidatingUberEats}>
                    {isValidatingUberEats ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verification...
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Deliveroo */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deliveroo</CardTitle>
                  <CardDescription>Configuration de l&apos;intégration Deliveroo pour cet établissement</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const dlIntegration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "deliveroo")
                    if (!dlIntegration?.menuSyncStatus || dlIntegration.menuSyncStatus === "idle") return null
                    const statusColors: Record<string, string> = {
                      syncing: "bg-blue-100 text-blue-700",
                      success: "bg-green-100 text-green-700",
                      error: "bg-red-100 text-red-700",
                    }
                    const statusLabels: Record<string, string> = {
                      syncing: "Synchronisation...",
                      success: "Synchronisé",
                      error: "Erreur de sync",
                    }
                    return (
                      <Badge className={statusColors[dlIntegration.menuSyncStatus] ?? ""}>
                        {statusLabels[dlIntegration.menuSyncStatus] ?? dlIntegration.menuSyncStatus}
                      </Badge>
                    )
                  })()}
                  {storeIntegrations?.some((i: StoreIntegration) => i.platform === "deliveroo") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {(isSyncingDeliveroo || isImportingDeliveroo) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {deliverooEnabled && deliverooSyncMenu && (
                          <DropdownMenuItem
                            onClick={handleSyncDeliverooMenu}
                            disabled={isSyncingDeliveroo}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Synchroniser le menu
                          </DropdownMenuItem>
                        )}
                        {deliverooEnabled && (
                          <DropdownMenuItem
                            onClick={handleImportDeliveroo}
                            disabled={isImportingDeliveroo}
                          >
                            <Download className="h-4 w-4" />
                            Importer les produits
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={handleRemoveDeliveroo}
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer l&apos;intégration
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasDeliverooGlobal ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Activez d'abord Deliveroo dans les Paramètres Globaux &gt; Intégrations
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="deliverooStoreId">ID du restaurant Deliveroo</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Comment trouver votre Store ID Deliveroo"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 text-sm" side="right" align="start">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-base">Comment trouver votre Store ID ?</h4>

                            <div className="space-y-2">
                              <p className="font-medium">Méthode 1 : Via le Restaurant Hub</p>
                              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                <li>
                                  Connectez-vous à{" "}
                                  <a
                                    href="https://restaurant-hub.deliveroo.net"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-medium text-foreground inline-flex items-center gap-0.5"
                                  >
                                    Deliveroo Restaurant Hub
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </li>
                                <li>Accédez à <strong>Paramètres</strong> &gt; <strong>Informations du restaurant</strong></li>
                                <li>L&apos;identifiant est affiché dans la section informations ou visible dans l&apos;URL</li>
                              </ol>
                              <div className="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                                restaurant-hub.deliveroo.net/restaurants/<span className="text-primary font-bold">123456</span>/...
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="font-medium">Méthode 2 : Via votre tablette Deliveroo</p>
                              <p className="text-muted-foreground">
                                Sur la tablette fournie par Deliveroo, accédez aux <strong>Paramètres</strong>. L&apos;identifiant du restaurant est affiché dans les informations du compte.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <p className="font-medium">Méthode 3 : Via le support Deliveroo</p>
                              <p className="text-muted-foreground">
                                Contactez le support Deliveroo et demandez le <strong>Restaurant ID</strong> associé à votre établissement.
                              </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                              <p className="text-blue-800 text-xs">
                                <strong>Format attendu :</strong> un identifiant numérique, par exemple{" "}
                                <code className="bg-blue-100 px-1 rounded">123456</code>
                              </p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      id="deliverooStoreId"
                      value={deliverooStoreId}
                      onChange={(e) => setDeliverooStoreId(e.target.value)}
                      placeholder="123456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliverooBrandId">Brand ID Deliveroo</Label>
                    <Input
                      id="deliverooBrandId"
                      value={deliverooBrandId}
                      onChange={(e) => setDeliverooBrandId(e.target.value)}
                      placeholder="brand-uuid-xxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Identifiant de marque fourni par Deliveroo, requis pour l'import des produits
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="deliverooStoreStatus">Statut sur la plateforme</Label>
                      <Select value={deliverooStoreStatus} onValueChange={(v) => setDeliverooStoreStatus(v as "ONLINE" | "PAUSED" | "OFFLINE")}>
                        <SelectTrigger id="deliverooStoreStatus">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ONLINE">En ligne</SelectItem>
                          <SelectItem value="PAUSED">En pause</SelectItem>
                          <SelectItem value="OFFLINE">Hors ligne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliverooPrepTime">Temps de préparation (min)</Label>
                      <Input
                        id="deliverooPrepTime"
                        type="number"
                        min="1"
                        max="120"
                        value={deliverooPrepTime}
                        onChange={(e) => setDeliverooPrepTime(e.target.value)}
                        placeholder="15"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="deliverooSyncMenu">Synchroniser le menu</Label>
                    <Switch
                      id="deliverooSyncMenu"
                      checked={deliverooSyncMenu}
                      onCheckedChange={setDeliverooSyncMenu}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="deliverooAutoAccept">Acceptation automatique des commandes</Label>
                    <Switch
                      id="deliverooAutoAccept"
                      checked={deliverooAutoAccept}
                      onCheckedChange={setDeliverooAutoAccept}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="deliverooEnabled">Intégration activée</Label>
                    <Switch
                      id="deliverooEnabled"
                      checked={deliverooEnabled}
                      onCheckedChange={setDeliverooEnabled}
                    />
                  </div>

                  <Button onClick={handleSaveDeliveroo} size="sm" disabled={isValidatingDeliveroo}>
                    {isValidatingDeliveroo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verification...
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
