"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, use, useEffect } from "react"
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
import { Checkbox } from "@beindigital-engine/ui"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@beindigital-engine/ui"
import { Badge } from "@beindigital-engine/ui"
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
  const [uberEatsSyncMenu, setUberEatsSyncMenu] = useState(false)
  const [uberEatsAutoAccept, setUberEatsAutoAccept] = useState(false)
  const [uberEatsEnabled, setUberEatsEnabled] = useState(false)

  const [deliverooStoreId, setDeliverooStoreId] = useState("")
  const [deliverooSyncMenu, setDeliverooSyncMenu] = useState(false)
  const [deliverooAutoAccept, setDeliverooAutoAccept] = useState(false)
  const [deliverooEnabled, setDeliverooEnabled] = useState(false)

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
    }

    const deliveroo = storeIntegrations.find((i: StoreIntegration) => i.platform === "deliveroo")
    if (deliveroo) {
      setDeliverooStoreId(deliveroo.platformStoreId)
      setDeliverooSyncMenu(deliveroo.syncMenu)
      setDeliverooAutoAccept(deliveroo.autoAccept)
      setDeliverooEnabled(deliveroo.enabled)
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
    try {
      if (!uberEatsStoreId.trim()) {
        toast.error("Veuillez saisir l'ID du restaurant Uber Eats")
        return
      }

      await upsertIntegration({
        storeId: storeId as string,
        platform: "uberEats",
        platformStoreId: uberEatsStoreId,
        syncMenu: uberEatsSyncMenu,
        autoAccept: uberEatsAutoAccept,
        enabled: uberEatsEnabled,
      })

      toast.success("Intégration Uber Eats enregistrée")
    } catch (error) {
      toast.error("Échec de l'enregistrement Uber Eats")
      console.error(error)
    }
  }

  const handleSaveDeliveroo = async () => {
    try {
      if (!deliverooStoreId.trim()) {
        toast.error("Veuillez saisir l'ID du restaurant Deliveroo")
        return
      }

      await upsertIntegration({
        storeId: storeId as string,
        platform: "deliveroo",
        platformStoreId: deliverooStoreId,
        syncMenu: deliverooSyncMenu,
        autoAccept: deliverooAutoAccept,
        enabled: deliverooEnabled,
      })

      toast.success("Intégration Deliveroo enregistrée")
    } catch (error) {
      toast.error("Échec de l'enregistrement Deliveroo")
      console.error(error)
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
      toast.success("Intégration Uber Eats supprimée")
    } catch (error) {
      toast.error("Échec de la suppression")
      console.error(error)
    }
  }

  const handleRemoveDeliveroo = async () => {
    try {
      const integration = storeIntegrations?.find((i: StoreIntegration) => i.platform === "deliveroo")
      if (!integration) return

      await removeIntegration({ id: integration._id })
      setDeliverooStoreId("")
      setDeliverooSyncMenu(false)
      setDeliverooAutoAccept(false)
      setDeliverooEnabled(false)
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
  const hasUberEatsGlobal = globalSettings?.integrations?.uberEats?.apiKey
  const hasDeliverooGlobal = globalSettings?.integrations?.deliveroo?.apiKey

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
        <TabsContent value="general" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
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

            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-4">Adresse</h3>
              <AddressAutocomplete
                label="Adresse de l'établissement"
                value={address}
                onChange={setAddress}
                apiKey={GOOGLE_MAPS_API_KEY}
              />
            </div>

            <Button onClick={handleUpdateGeneral} size="sm">
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        {/* HOURS TAB */}
        <TabsContent value="hours" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-4">
            <div className="flex items-center space-x-2 pb-4 border-b">
              <Checkbox
                id="useGlobalHours"
                checked={useGlobalHours}
                onCheckedChange={(checked) => setUseGlobalHours(checked === true)}
              />
              <Label htmlFor="useGlobalHours" className="cursor-pointer">
                Utiliser les horaires globaux
              </Label>
            </div>

            {useGlobalHours && globalHours.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-3">Horaires globaux (lecture seule)</p>
                {DISPLAY_ORDER.map((dayNum) => {
                  const dayHours = globalHours.find((h: DayHours) => h.day === dayNum)
                  if (!dayHours) return null
                  return (
                    <div key={dayNum} className="grid grid-cols-4 gap-4 text-sm">
                      <div className="font-medium">{DAY_NAMES[dayNum]}</div>
                      <div className="text-muted-foreground">
                        {dayHours.isClosed ? "Fermé" : dayHours.open}
                      </div>
                      <div className="text-muted-foreground">
                        {dayHours.isClosed ? "" : dayHours.close}
                      </div>
                      <div></div>
                    </div>
                  )
                })}
              </div>
            )}

            {!useGlobalHours && (
              <>
                <div className="flex gap-2 pb-4">
                  <Button variant="outline" size="sm" onClick={handleSetAllWeekdays}>
                    Lun-Ven même horaire
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSetAllDays}>
                    Tous les jours
                  </Button>
                </div>

                <div className="space-y-3">
                  {DISPLAY_ORDER.map((dayNum) => {
                    const dayHours = hours.find((h) => h.day === dayNum)
                    if (!dayHours) return null
                    const index = hours.indexOf(dayHours)

                    return (
                      <div key={dayNum} className="grid grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                          <Label className="font-medium">{DAY_NAMES[dayNum]}</Label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`open-${dayNum}`}>Ouverture</Label>
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
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`close-${dayNum}`}>Fermeture</Label>
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
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`closed-${dayNum}`}
                            checked={dayHours.isClosed}
                            onCheckedChange={(checked) => {
                              const newHours = [...hours]
                              newHours[index] = { ...dayHours, isClosed: checked }
                              setHours(newHours)
                            }}
                          />
                          <Label htmlFor={`closed-${dayNum}`}>Fermé</Label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <Button onClick={handleUpdateHours} size="sm">
              Enregistrer les horaires
            </Button>
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-6">
            {/* Services */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customizeServices"
                  checked={customizeServices}
                  onCheckedChange={(checked) => setCustomizeServices(checked === true)}
                />
                <Label htmlFor="customizeServices" className="cursor-pointer font-medium">
                  Personnaliser les services
                </Label>
              </div>
              {!customizeServices && (
                <p className="text-sm text-muted-foreground">
                  Global: Sur place ({globalServices.dineIn ? "Oui" : "Non"}), À emporter (
                  {globalServices.takeaway ? "Oui" : "Non"}), Livraison ({globalServices.delivery ? "Oui" : "Non"}),
                  Click & Collect ({globalServices.clickAndCollect ? "Oui" : "Non"})
                </p>
              )}
              {customizeServices && (
                <div className="pl-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dineIn">Sur place</Label>
                    <Switch id="dineIn" checked={dineIn} onCheckedChange={setDineIn} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="takeaway">À emporter</Label>
                    <Switch id="takeaway" checked={takeaway} onCheckedChange={setTakeaway} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="delivery">Livraison</Label>
                    <Switch id="delivery" checked={delivery} onCheckedChange={setDelivery} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="clickAndCollect">Click & Collect</Label>
                    <Switch id="clickAndCollect" checked={clickAndCollect} onCheckedChange={setClickAndCollect} />
                  </div>
                </div>
              )}
            </div>

            {/* Minimum Order */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customizeMinOrder"
                  checked={customizeMinOrder}
                  onCheckedChange={(checked) => setCustomizeMinOrder(checked === true)}
                />
                <Label htmlFor="customizeMinOrder" className="cursor-pointer font-medium">
                  Personnaliser la commande minimum
                </Label>
              </div>
              {!customizeMinOrder && (
                <p className="text-sm text-muted-foreground">Global: {globalMinOrder} €</p>
              )}
              {customizeMinOrder && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="minimumOrderAmount">Commande minimum (€)</Label>
                  <Input
                    id="minimumOrderAmount"
                    type="number"
                    step="0.01"
                    value={minimumOrderAmount}
                    onChange={(e) => setMinimumOrderAmount(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Delivery Radius */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customizeDeliveryRadius"
                  checked={customizeDeliveryRadius}
                  onCheckedChange={(checked) => setCustomizeDeliveryRadius(checked === true)}
                />
                <Label htmlFor="customizeDeliveryRadius" className="cursor-pointer font-medium">
                  Personnaliser le rayon de livraison
                </Label>
              </div>
              {!customizeDeliveryRadius && (
                <p className="text-sm text-muted-foreground">Global: {globalDeliveryRadius} km</p>
              )}
              {customizeDeliveryRadius && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="deliveryRadius">Rayon de livraison (km)</Label>
                  <Input
                    id="deliveryRadius"
                    type="number"
                    step="0.1"
                    value={deliveryRadius}
                    onChange={(e) => setDeliveryRadius(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Delivery Fee */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customizeDeliveryFee"
                  checked={customizeDeliveryFee}
                  onCheckedChange={(checked) => setCustomizeDeliveryFee(checked === true)}
                />
                <Label htmlFor="customizeDeliveryFee" className="cursor-pointer font-medium">
                  Personnaliser les frais de livraison
                </Label>
              </div>
              {!customizeDeliveryFee && (
                <p className="text-sm text-muted-foreground">Global: {globalDeliveryFee} €</p>
              )}
              {customizeDeliveryFee && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="deliveryFee">Frais de livraison (€)</Label>
                  <Input
                    id="deliveryFee"
                    type="number"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Delivery Free Above */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customizeDeliveryFree"
                  checked={customizeDeliveryFree}
                  onCheckedChange={(checked) => setCustomizeDeliveryFree(checked === true)}
                />
                <Label htmlFor="customizeDeliveryFree" className="cursor-pointer font-medium">
                  Personnaliser la livraison gratuite à partir de
                </Label>
              </div>
              {!customizeDeliveryFree && (
                <p className="text-sm text-muted-foreground">Global: {globalDeliveryFree} €</p>
              )}
              {customizeDeliveryFree && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="deliveryFreeAbove">Livraison gratuite à partir de (€)</Label>
                  <Input
                    id="deliveryFreeAbove"
                    type="number"
                    step="0.01"
                    value={deliveryFreeAbove}
                    onChange={(e) => setDeliveryFreeAbove(e.target.value)}
                  />
                </div>
              )}
            </div>

            <Button onClick={handleUpdateSettings} size="sm">
              Enregistrer les paramètres
            </Button>
          </div>
        </TabsContent>

        {/* INTEGRATIONS TAB */}
        <TabsContent value="integrations" className="space-y-4">
          {/* Uber Eats */}
          <Card>
            <CardHeader>
              <CardTitle>Uber Eats</CardTitle>
              <CardDescription>Configuration de l'intégration Uber Eats pour cet établissement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasUberEatsGlobal ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Configurez d'abord Uber Eats dans les Paramètres Globaux
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="uberEatsStoreId">ID du restaurant Uber Eats</Label>
                    <Input
                      id="uberEatsStoreId"
                      value={uberEatsStoreId}
                      onChange={(e) => setUberEatsStoreId(e.target.value)}
                      placeholder="12345678-abcd-efgh-ijkl-mnopqrstuvwx"
                    />
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

                  <div className="flex gap-2">
                    <Button onClick={handleSaveUberEats} size="sm">
                      Enregistrer
                    </Button>
                    {storeIntegrations?.some((i: StoreIntegration) => i.platform === "uberEats") && (
                      <Button onClick={handleRemoveUberEats} size="sm" variant="destructive">
                        Supprimer
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Deliveroo */}
          <Card>
            <CardHeader>
              <CardTitle>Deliveroo</CardTitle>
              <CardDescription>Configuration de l'intégration Deliveroo pour cet établissement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasDeliverooGlobal ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Configurez d'abord Deliveroo dans les Paramètres Globaux
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="deliverooStoreId">ID du restaurant Deliveroo</Label>
                    <Input
                      id="deliverooStoreId"
                      value={deliverooStoreId}
                      onChange={(e) => setDeliverooStoreId(e.target.value)}
                      placeholder="87654321-zyxw-vutr-sqpo-nmlkjihgfed"
                    />
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

                  <div className="flex gap-2">
                    <Button onClick={handleSaveDeliveroo} size="sm">
                      Enregistrer
                    </Button>
                    {storeIntegrations?.some((i: StoreIntegration) => i.platform === "deliveroo") && (
                      <Button onClick={handleRemoveDeliveroo} size="sm" variant="destructive">
                        Supprimer
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
