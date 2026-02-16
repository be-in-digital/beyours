"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { useState, use } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LoadingState } from "@/components/admin/LoadingState"
import { AddressAutocomplete, type AddressValue } from "@/components/ui/address-autocomplete"

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const dayNames: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
}

export function StoreDetailContent({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params)
  const store = useQuery(api.stores.getById, { id: storeId as Id<"stores"> })
  const updateStore = useMutation(api.stores.update)
  const updateAddressMutation = useMutation(api.stores.updateAddress)
  const updateHours = useMutation(api.stores.updateHours)
  const updateBranding = useMutation(api.stores.updateBranding)
  const updateSettings = useMutation(api.stores.updateSettings)

  // General tab state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("open")

  // Address tab state
  const [address, setAddress] = useState<AddressValue>({
    street: "",
    city: "",
    postalCode: "",
    country: "France",
  })

  // Hours tab state
  const [hours, setHours] = useState<Array<{ day: string; open: string; close: string; isClosed: boolean }>>([])

  // Branding tab state
  const [primaryColor, setPrimaryColor] = useState("#000000")
  const [secondaryColor, setSecondaryColor] = useState("#ffffff")
  const [accentColor, setAccentColor] = useState("#0066cc")
  const [logoUrl, setLogoUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [fontHeading, setFontHeading] = useState("Inter")
  const [fontBody, setFontBody] = useState("Inter")

  // Settings tab state
  const [currency, setCurrency] = useState("EUR")
  const [timezone, setTimezone] = useState("Europe/Paris")
  const [deliveryEnabled, setDeliveryEnabled] = useState(true)
  const [pickupEnabled, setPickupEnabled] = useState(true)
  const [dineInEnabled, setDineInEnabled] = useState(true)
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [deliveryRadius, setDeliveryRadius] = useState("")
  const [taxRate, setTaxRate] = useState("")

  // Initialize state when store loads
  if (store && name === "") {
    setName(store.name)
    setSlug(store.slug)
    setDescription(store.description || "")
    setPhone(store.phone || "")
    setEmail(store.email || "")
    setStatus(store.status)

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

    if (store.hours) {
      setHours(store.hours)
    } else {
      // Initialize default hours
      setHours(daysOfWeek.map(day => ({ day, open: "09:00", close: "22:00", isClosed: false })))
    }

    if (store.branding) {
      setPrimaryColor(store.branding.primaryColor || "#000000")
      setSecondaryColor(store.branding.secondaryColor || "#ffffff")
      setAccentColor(store.branding.accentColor || "#0066cc")
      setLogoUrl(store.branding.logoUrl || "")
      setFaviconUrl(store.branding.faviconUrl || "")
      setFontHeading(store.branding.fontHeading || "Inter")
      setFontBody(store.branding.fontBody || "Inter")
    }

    if (store.settings) {
      setCurrency(store.settings.currency)
      setTimezone(store.settings.timezone)
      setDeliveryEnabled(store.settings.deliveryEnabled)
      setPickupEnabled(store.settings.pickupEnabled)
      setDineInEnabled(store.settings.dineInEnabled)
      setMinimumOrderAmount(String(store.settings.minimumOrderAmount || 1000))
      setDeliveryFee(String(store.settings.deliveryFee || 300))
      setDeliveryRadius(String(store.settings.deliveryRadius || 5000))
      setTaxRate(String(store.settings.taxRate || 10))
    }
  }

  const handleUpdateGeneral = async () => {
    try {
      await updateStore({
        id: storeId as Id<"stores">,
        name,
        slug,
        description: description || undefined,
        phone: phone || undefined,
        email: email || undefined,
        status,
      })
      toast.success("Établissement mis à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour de l'établissement")
      console.error(error)
    }
  }

  const handleUpdateAddress = async () => {
    try {
      await updateAddressMutation({
        id: storeId as Id<"stores">,
        address: {
          street: address.street,
          city: address.city,
          postalCode: address.postalCode,
          country: address.country,
          latitude: address.latitude,
          longitude: address.longitude,
        },
      })
      toast.success("Adresse mise à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour de l'adresse")
      console.error(error)
    }
  }

  const handleUpdateHours = async () => {
    try {
      await updateHours({
        id: storeId as Id<"stores">,
        hours,
      })
      toast.success("Horaires mis à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour des horaires")
      console.error(error)
    }
  }

  const handleUpdateBranding = async () => {
    try {
      await updateBranding({
        id: storeId as Id<"stores">,
        branding: {
          primaryColor,
          secondaryColor,
          accentColor,
          logoUrl: logoUrl || undefined,
          faviconUrl: faviconUrl || undefined,
          fontHeading,
          fontBody,
        },
      })
      toast.success("Identité visuelle mise à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour de l'identité visuelle")
      console.error(error)
    }
  }

  const handleUpdateSettings = async () => {
    try {
      await updateSettings({
        id: storeId as Id<"stores">,
        settings: {
          currency,
          timezone,
          deliveryEnabled,
          pickupEnabled,
          dineInEnabled,
          minimumOrderAmount: parseInt(minimumOrderAmount),
          deliveryFee: parseInt(deliveryFee),
          deliveryRadius: parseInt(deliveryRadius),
          taxRate: parseInt(taxRate),
        },
      })
      toast.success("Paramètres mis à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour des paramètres")
      console.error(error)
    }
  }

  if (!store) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{store.name}</h1>
        <p className="text-muted-foreground mt-2">Gérez les détails et paramètres de l&apos;établissement</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="address">Adresse</TabsTrigger>
          <TabsTrigger value="hours">Horaires</TabsTrigger>
          <TabsTrigger value="branding">Identité visuelle</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l&apos;établissement</Label>
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
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Ouvert</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                  <SelectItem value="temporarily_unavailable">Temporairement indisponible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateGeneral}>Enregistrer</Button>
          </div>
        </TabsContent>

        <TabsContent value="address" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <AddressAutocomplete
              label="Adresse de l&apos;établissement"
              value={address}
              onChange={setAddress}
              apiKey={GOOGLE_MAPS_API_KEY}
            />
            <Button onClick={handleUpdateAddress}>Enregistrer l&apos;adresse</Button>
          </div>
        </TabsContent>

        <TabsContent value="hours" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            {hours.map((dayHours, index) => (
              <div key={dayHours.day} className="grid grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>{dayNames[dayHours.day] || dayHours.day}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`open-${dayHours.day}`}>Ouverture</Label>
                  <Input
                    id={`open-${dayHours.day}`}
                    type="time"
                    value={dayHours.open}
                    onChange={(e) => {
                      const newHours = [...hours]
                      const h = newHours[index]
                      if (h) h.open = e.target.value
                      setHours(newHours)
                    }}
                    disabled={dayHours.isClosed}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`close-${dayHours.day}`}>Fermeture</Label>
                  <Input
                    id={`close-${dayHours.day}`}
                    type="time"
                    value={dayHours.close}
                    onChange={(e) => {
                      const newHours = [...hours]
                      const h = newHours[index]
                      if (h) h.close = e.target.value
                      setHours(newHours)
                    }}
                    disabled={dayHours.isClosed}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`closed-${dayHours.day}`}
                    checked={dayHours.isClosed}
                    onCheckedChange={(checked) => {
                      const newHours = [...hours]
                      const h = newHours[index]
                      if (h) h.isClosed = checked
                      setHours(newHours)
                    }}
                  />
                  <Label htmlFor={`closed-${dayHours.day}`}>Fermé</Label>
                </div>
              </div>
            ))}
            <Button onClick={handleUpdateHours}>Enregistrer les horaires</Button>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Couleur primaire</Label>
                <div className="flex gap-2">
                  <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-20" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Couleur secondaire</Label>
                <div className="flex gap-2">
                  <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-20" />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Couleur d&apos;accent</Label>
                <div className="flex gap-2">
                  <Input id="accentColor" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-20" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL du logo</Label>
                <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">URL du favicon</Label>
                <Input id="faviconUrl" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontHeading">Police des titres</Label>
                <Input id="fontHeading" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontBody">Police du texte</Label>
                <Input id="fontBody" value={fontBody} onChange={(e) => setFontBody(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleUpdateBranding}>Enregistrer l&apos;identité visuelle</Button>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Fuseau horaire</Label>
                <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="deliveryEnabled">Livraison activée</Label>
                <Switch id="deliveryEnabled" checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pickupEnabled">Click & Collect activé</Label>
                <Switch id="pickupEnabled" checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="dineInEnabled">Sur place activé</Label>
                <Switch id="dineInEnabled" checked={dineInEnabled} onCheckedChange={setDineInEnabled} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimumOrderAmount">Commande minimum (centimes)</Label>
                <Input id="minimumOrderAmount" type="number" value={minimumOrderAmount} onChange={(e) => setMinimumOrderAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Frais de livraison (centimes)</Label>
                <Input id="deliveryFee" type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryRadius">Rayon de livraison (mètres)</Label>
                <Input id="deliveryRadius" type="number" value={deliveryRadius} onChange={(e) => setDeliveryRadius(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Taux de TVA (%)</Label>
                <Input id="taxRate" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleUpdateSettings}>Enregistrer les paramètres</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
