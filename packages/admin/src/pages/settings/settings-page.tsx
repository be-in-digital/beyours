"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { SettingsIcon, Clock, Truck, Plug2 } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { centsToEuros, eurosToCents } from "../../lib/formatters"

const CURRENCIES = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "CHF", label: "Swiss Franc (CHF)" },
]

const TIMEZONES = [
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "America/New_York", label: "America/New_York (GMT-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
]

// Day names in French - IMPORTANT: day 0 = Dimanche (Sunday), day 1 = Lundi (Monday)
const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

// Display order: Monday first (day=1), Sunday last (day=0)
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function SettingsPage() {
  const { api } = useAdminApiStore()
  const settings = useQuery(api.globalSettings.get)
  const updateSettings = useMutation(api.globalSettings.upsert)

  // General tab state
  const [currency, setCurrency] = useState("EUR")
  const [timezone, setTimezone] = useState("Europe/Paris")
  const [taxRate, setTaxRate] = useState("20")
  const [dineIn, setDineIn] = useState(true)
  const [takeaway, setTakeaway] = useState(true)
  const [delivery, setDelivery] = useState(false)
  const [clickAndCollect, setClickAndCollect] = useState(false)
  const [minimumOrder, setMinimumOrder] = useState("")

  // Hours tab state
  const [hours, setHours] = useState<Array<{
    day: number
    open: string
    close: string
    isClosed: boolean
  }>>([])

  // Delivery tab state
  const [deliveryRadius, setDeliveryRadius] = useState("")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [freeAbove, setFreeAbove] = useState("")

  // Integrations tab state
  const [uberDirectCustomerId, setUberDirectCustomerId] = useState("")
  const [uberDirectApiKey, setUberDirectApiKey] = useState("")
  const [uberDirectEnabled, setUberDirectEnabled] = useState(true)
  const [uberEatsEnabled, setUberEatsEnabled] = useState(true)
  const [deliverooEnabled, setDeliverooEnabled] = useState(true)

  // Initialize state when settings load
  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency)
      setTimezone(settings.timezone)
      setTaxRate(settings.taxRate.toString())
      setDineIn(settings.services.dineIn)
      setTakeaway(settings.services.takeaway)
      setDelivery(settings.services.delivery)
      setClickAndCollect(settings.services.clickAndCollect)
      setMinimumOrder(settings.minimumOrderAmount ? centsToEuros(settings.minimumOrderAmount).toString() : "")
      setHours(settings.hours)
      setDeliveryRadius(settings.delivery.radius?.toString() || "")
      setDeliveryFee(settings.delivery.fee ? centsToEuros(settings.delivery.fee).toString() : "")
      setFreeAbove(settings.delivery.freeAbove ? centsToEuros(settings.delivery.freeAbove).toString() : "")

      // Integrations
      if (settings.integrations?.uberDirect) {
        setUberDirectCustomerId(settings.integrations.uberDirect.customerId || "")
        setUberDirectApiKey(settings.integrations.uberDirect.apiKey || "")
        setUberDirectEnabled(settings.integrations.uberDirect.enabled)
      }
      if (settings.integrations?.uberEats) {
        setUberEatsEnabled(settings.integrations.uberEats.enabled)
      }
      if (settings.integrations?.deliveroo) {
        setDeliverooEnabled(settings.integrations.deliveroo.enabled)
      }
    } else {
      // Initialize with default hours if no settings exist
      setHours([
        { day: 0, open: "00:00", close: "00:00", isClosed: true },
        { day: 1, open: "09:00", close: "22:00", isClosed: false },
        { day: 2, open: "09:00", close: "22:00", isClosed: false },
        { day: 3, open: "09:00", close: "22:00", isClosed: false },
        { day: 4, open: "09:00", close: "22:00", isClosed: false },
        { day: 5, open: "09:00", close: "23:00", isClosed: false },
        { day: 6, open: "09:00", close: "23:00", isClosed: false },
      ])
    }
  }, [settings])

  const handleSaveGeneral = async () => {
    try {
      await updateSettings({
        currency,
        timezone,
        taxRate: parseFloat(taxRate),
        services: {
          dineIn,
          takeaway,
          delivery,
          clickAndCollect,
        },
        minimumOrderAmount: minimumOrder ? eurosToCents(parseFloat(minimumOrder)) : undefined,
      })
      toast.success("Paramètres généraux enregistrés")
    } catch (error) {
      toast.error("Échec de l'enregistrement")
      console.error(error)
    }
  }

  const handleSaveHours = async () => {
    try {
      await updateSettings({ hours })
      toast.success("Horaires enregistrés")
    } catch (error) {
      toast.error("Échec de l'enregistrement")
      console.error(error)
    }
  }

  const handleSaveDelivery = async () => {
    try {
      await updateSettings({
        delivery: {
          radius: deliveryRadius ? parseFloat(deliveryRadius) : undefined,
          fee: deliveryFee ? eurosToCents(parseFloat(deliveryFee)) : undefined,
          freeAbove: freeAbove ? eurosToCents(parseFloat(freeAbove)) : undefined,
        },
      })
      toast.success("Paramètres de livraison enregistrés")
    } catch (error) {
      toast.error("Échec de l'enregistrement")
      console.error(error)
    }
  }

  const handleSaveIntegrations = async () => {
    try {
      await updateSettings({
        integrations: {
          uberDirect: {
            customerId: uberDirectCustomerId || undefined,
            apiKey: uberDirectApiKey || undefined,
            enabled: uberDirectEnabled,
          },
          uberEats: {
            enabled: uberEatsEnabled,
          },
          deliveroo: {
            enabled: deliverooEnabled,
          },
        },
      })
      toast.success("Intégrations enregistrées")
    } catch (error) {
      toast.error("Échec de l'enregistrement")
      console.error(error)
    }
  }

  const updateHour = (day: number, field: "open" | "close" | "isClosed", value: string | boolean) => {
    setHours((prev) =>
      prev.map((h) =>
        h.day === day ? { ...h, [field]: value } : h
      )
    )
  }

  const applyWeekdayHours = () => {
    const mondayHours = hours.find((h) => h.day === 1)
    if (!mondayHours) return

    setHours((prev) =>
      prev.map((h) => {
        // Apply to Tuesday (2) through Friday (5)
        if (h.day >= 2 && h.day <= 5) {
          return {
            ...h,
            open: mondayHours.open,
            close: mondayHours.close,
            isClosed: mondayHours.isClosed,
          }
        }
        return h
      })
    )
    toast.success("Horaires du lundi appliqués à mar-ven")
  }

  const applyAllDaysHours = () => {
    const mondayHours = hours.find((h) => h.day === 1)
    if (!mondayHours) return

    setHours((prev) =>
      prev.map((h) => ({
        ...h,
        open: mondayHours.open,
        close: mondayHours.close,
        isClosed: mondayHours.isClosed,
      }))
    )
    toast.success("Horaires du lundi appliqués à tous les jours")
  }

  if (settings === undefined) {
    return <LoadingState variant="form" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres Globaux</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez les valeurs par défaut héritées par tous les établissements
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Général
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="h-4 w-4 mr-2" />
            Horaires
          </TabsTrigger>
          <TabsTrigger value="delivery">
            <Truck className="h-4 w-4 mr-2" />
            Livraison
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug2 className="h-4 w-4 mr-2" />
            Intégrations
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Fuseau horaire</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">TVA par défaut (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumOrder">Commande minimum (€)</Label>
                <Input
                  id="minimumOrder"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minimumOrder}
                  onChange={(e) => setMinimumOrder(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Services activés</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
                  <Label htmlFor="dineIn" className="cursor-pointer">Sur place</Label>
                  <Switch
                    id="dineIn"
                    checked={dineIn}
                    onCheckedChange={setDineIn}
                  />
                </div>
                <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
                  <Label htmlFor="takeaway" className="cursor-pointer">À emporter</Label>
                  <Switch
                    id="takeaway"
                    checked={takeaway}
                    onCheckedChange={setTakeaway}
                  />
                </div>
                <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
                  <Label htmlFor="delivery" className="cursor-pointer">Livraison</Label>
                  <Switch
                    id="delivery"
                    checked={delivery}
                    onCheckedChange={setDelivery}
                  />
                </div>
                <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
                  <Label htmlFor="clickAndCollect" className="cursor-pointer">Click & Collect</Label>
                  <Switch
                    id="clickAndCollect"
                    checked={clickAndCollect}
                    onCheckedChange={setClickAndCollect}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveGeneral} size="sm">
              Enregistrer les paramètres généraux
            </Button>
          </div>
        </TabsContent>

        {/* Hours Tab */}
        <TabsContent value="hours" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-4">
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={applyWeekdayHours}>
                Lun-Ven même horaire
              </Button>
              <Button variant="outline" size="sm" onClick={applyAllDaysHours}>
                Tous les jours
              </Button>
            </div>

            <div className="space-y-3">
              {DISPLAY_ORDER.map((dayNum) => {
                const dayHours = hours.find((h) => h.day === dayNum)
                if (!dayHours) return null

                return (
                  <div key={dayNum} className="flex items-center gap-4 border border-border/50 rounded-lg p-4">
                    <div className="w-24 font-medium text-sm">
                      {DAY_NAMES[dayNum]}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`open-${dayNum}`} className="text-xs text-muted-foreground">
                          Ouverture
                        </Label>
                        <Input
                          id={`open-${dayNum}`}
                          type="time"
                          value={dayHours.open}
                          onChange={(e) => updateHour(dayNum, "open", e.target.value)}
                          disabled={dayHours.isClosed}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`close-${dayNum}`} className="text-xs text-muted-foreground">
                          Fermeture
                        </Label>
                        <Input
                          id={`close-${dayNum}`}
                          type="time"
                          value={dayHours.close}
                          onChange={(e) => updateHour(dayNum, "close", e.target.value)}
                          disabled={dayHours.isClosed}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`closed-${dayNum}`}
                        checked={!dayHours.isClosed}
                        onCheckedChange={(checked) => updateHour(dayNum, "isClosed", !checked)}
                      />
                      <Label htmlFor={`closed-${dayNum}`} className="text-sm cursor-pointer">
                        {dayHours.isClosed ? "Fermé" : "Ouvert"}
                      </Label>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button onClick={handleSaveHours} size="sm">
              Enregistrer les horaires
            </Button>
          </div>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryRadius">Rayon de livraison (km)</Label>
                <Input
                  id="deliveryRadius"
                  type="number"
                  min="0"
                  step="0.1"
                  value={deliveryRadius}
                  onChange={(e) => setDeliveryRadius(e.target.value)}
                  placeholder="10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Frais de livraison (€)</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="3.50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="freeAbove">Livraison gratuite à partir de (€)</Label>
                <Input
                  id="freeAbove"
                  type="number"
                  min="0"
                  step="0.01"
                  value={freeAbove}
                  onChange={(e) => setFreeAbove(e.target.value)}
                  placeholder="30.00"
                />
              </div>
            </div>

            <Button onClick={handleSaveDelivery} size="sm">
              Enregistrer les paramètres de livraison
            </Button>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4">
            {/* Uber Direct */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Uber Direct</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${uberDirectEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                      {uberDirectEnabled ? "Activé" : "Désactivé"}
                    </span>
                    <Switch
                      checked={uberDirectEnabled}
                      onCheckedChange={setUberDirectEnabled}
                    />
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Service de livraison on-demand d'Uber
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="uberDirectCustomerId" className="text-xs">
                    Customer ID
                  </Label>
                  <Input
                    id="uberDirectCustomerId"
                    type="text"
                    value={uberDirectCustomerId}
                    onChange={(e) => setUberDirectCustomerId(e.target.value)}
                    placeholder="Entrez votre Customer ID"
                    disabled={!uberDirectEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uberDirectApiKey" className="text-xs">
                    API Key
                  </Label>
                  <Input
                    id="uberDirectApiKey"
                    type="password"
                    value={uberDirectApiKey}
                    onChange={(e) => setUberDirectApiKey(e.target.value)}
                    placeholder="Entrez votre clé API"
                    disabled={!uberDirectEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Uber Eats */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Uber Eats</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${uberEatsEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                      {uberEatsEnabled ? "Activé" : "Désactivé"}
                    </span>
                    <Switch
                      checked={uberEatsEnabled}
                      onCheckedChange={setUberEatsEnabled}
                    />
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Synchronisez votre menu et recevez des commandes depuis Uber Eats
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Les identifiants Uber Eats (Client ID, Client Secret) sont gérés au niveau de la plateforme BeInDigital via les variables d'environnement.
                </p>
              </CardContent>
            </Card>

            {/* Deliveroo */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Deliveroo</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${deliverooEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                      {deliverooEnabled ? "Activé" : "Désactivé"}
                    </span>
                    <Switch
                      checked={deliverooEnabled}
                      onCheckedChange={setDeliverooEnabled}
                    />
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Synchronisez votre menu et recevez des commandes depuis Deliveroo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Les identifiants Deliveroo (Client ID, Client Secret, Webhook Secret) sont gérés au niveau de la plateforme BeInDigital via les variables d'environnement.
                </p>
              </CardContent>
            </Card>

            <Button onClick={handleSaveIntegrations} size="sm">
              Enregistrer les intégrations
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
