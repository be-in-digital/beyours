"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { SettingsIcon, Clock, Truck, Plug2, CreditCard, Loader2, Info, ExternalLink } from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { centsToEuros, eurosToCents } from "../../lib/formatters"

// ---------------------------------------------------------------------------
// Info dialog helper — renders an (i) icon that opens a guide dialog
// ---------------------------------------------------------------------------

type HelpStep = { text: string }
type HelpLink = { label: string; url: string }

interface FieldInfoProps {
  title: string
  description: string
  steps: HelpStep[]
  links?: HelpLink[]
  note?: string
}

function FieldInfo({ title, description, steps, links, note }: FieldInfoProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Aide : ${title}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="!max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
            {steps.map((step, i) => (
              <li key={i}>{step.text}</li>
            ))}
          </ol>
          {links && links.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Liens utiles</p>
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {link.label}
                </a>
              ))}
            </div>
          )}
          {note && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">{note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Help content for each integration field
// ---------------------------------------------------------------------------

const HELP = {
  uberDirect: {
    customerId: {
      title: "Customer ID (Uber Store ID)",
      description: "Identifiant unique de votre restaurant sur Uber Direct.",
      steps: [
        { text: "Connectez-vous au tableau de bord Uber Direct." },
        { text: "Allez dans Paramètres > API." },
        { text: "Copiez le Customer ID (aussi appelé Store ID) affiché dans la section identifiants." },
      ],
      links: [
        { label: "Uber Direct Dashboard", url: "https://dashboard.uber.com/" },
      ],
    } satisfies FieldInfoProps,
    clientId: {
      title: "Client ID (OAuth)",
      description: "Clé d'identification de votre application Uber pour l'authentification API.",
      steps: [
        { text: "Rendez-vous sur le portail développeur Uber." },
        { text: "Créez une application ou sélectionnez une application existante." },
        { text: "Dans l'onglet « Credentials », copiez le Client ID." },
      ],
      links: [
        { label: "Uber Developer Portal", url: "https://developer.uber.com/" },
        { label: "Documentation API Uber Direct", url: "https://developer.uber.com/docs/deliveries/overview" },
      ],
    } satisfies FieldInfoProps,
    clientSecret: {
      title: "Client Secret (OAuth)",
      description: "Clé secrète liée à votre application Uber. Ne la partagez jamais.",
      steps: [
        { text: "Rendez-vous sur le portail développeur Uber." },
        { text: "Sélectionnez votre application." },
        { text: "Dans l'onglet « Credentials », copiez le Client Secret." },
      ],
      links: [
        { label: "Uber Developer Portal", url: "https://developer.uber.com/" },
      ],
      note: "Le Client Secret n'est visible qu'une seule fois lors de sa création. Si vous l'avez perdu, vous devez en générer un nouveau.",
    } satisfies FieldInfoProps,
  },
  uberEats: {
    general: {
      title: "Uber Eats",
      description: "Intégration pour synchroniser votre menu et recevoir des commandes Uber Eats.",
      steps: [
        { text: "Créez un compte restaurant sur Uber Eats si ce n'est pas déjà fait." },
        { text: "Contactez votre account manager Uber Eats pour activer l'accès API." },
        { text: "Une fois l'API activée par Uber, activez l'intégration ici." },
      ],
      links: [
        { label: "Uber Eats for Merchants", url: "https://merchants.ubereats.com/" },
        { label: "Uber Eats API Documentation", url: "https://developer.uber.com/docs/eats/introduction" },
      ],
      note: "L'activation de l'API Uber Eats nécessite un accord préalable avec Uber. Contactez votre représentant commercial.",
    } satisfies FieldInfoProps,
  },
  deliveroo: {
    general: {
      title: "Deliveroo",
      description: "Intégration pour synchroniser votre menu et recevoir des commandes Deliveroo.",
      steps: [
        { text: "Créez un compte restaurant partenaire sur Deliveroo si ce n'est pas déjà fait." },
        { text: "Contactez votre account manager Deliveroo pour demander l'accès API." },
        { text: "Deliveroo vous fournira vos identifiants d'intégration." },
        { text: "Une fois les identifiants reçus, activez l'intégration ici." },
      ],
      links: [
        { label: "Deliveroo for Restaurants", url: "https://restaurants.deliveroo.com/" },
        { label: "Deliveroo API Documentation", url: "https://developers.deliveroo.com/" },
      ],
      note: "L'accès API Deliveroo est réservé aux restaurants partenaires. Contactez votre représentant pour démarrer l'intégration.",
    } satisfies FieldInfoProps,
  },
  payments: {
    stripe: {
      title: "Stripe",
      description: "Plateforme de paiement en ligne et terminal de paiement.",
      steps: [
        { text: "Cliquez sur le bouton « Connecter » ci-dessous." },
        { text: "Vous serez redirigé vers Stripe pour créer ou connecter votre compte." },
        { text: "Complétez les informations demandées par Stripe (identité, coordonnées bancaires)." },
        { text: "Une fois terminé, vous serez automatiquement redirigé ici." },
      ],
      links: [
        { label: "Stripe Dashboard", url: "https://dashboard.stripe.com/" },
        { label: "Tarifs Stripe", url: "https://stripe.com/fr/pricing" },
      ],
    } satisfies FieldInfoProps,
    sumup: {
      title: "SumUp",
      description: "Terminal de paiement mobile pour les paiements en personne.",
      steps: [
        { text: "Cliquez sur le bouton « Connecter » ci-dessous." },
        { text: "Connectez-vous à votre compte SumUp ou créez-en un." },
        { text: "Autorisez l'accès à votre compte SumUp." },
        { text: "Vous serez automatiquement redirigé ici une fois connecté." },
      ],
      links: [
        { label: "SumUp Dashboard", url: "https://me.sumup.com/" },
        { label: "Boutique SumUp (terminaux)", url: "https://store.sumup.com/" },
      ],
    } satisfies FieldInfoProps,
    paypal: {
      title: "PayPal",
      description: "Accepter les paiements via PayPal en renseignant votre adresse email PayPal Business.",
      steps: [
        { text: "Créez ou connectez-vous à votre compte PayPal Business." },
        { text: "Copiez l'adresse email associée à votre compte PayPal Business." },
        { text: "Collez-la dans le champ ci-dessous et enregistrez." },
      ],
      links: [
        { label: "PayPal Business", url: "https://www.paypal.com/business" },
        { label: "Tarifs PayPal", url: "https://www.paypal.com/fr/webapps/mpp/merchant-fees" },
      ],
    } satisfies FieldInfoProps,
  },
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

  // Delivery fee mode
  const [feeMode, setFeeMode] = useState<"fixed" | "percentage">("fixed")
  const [deliveryPercentage, setDeliveryPercentage] = useState("")
  const [deliveryMaxFee, setDeliveryMaxFee] = useState("")

  // Simulator state
  const [simulatorAddress, setSimulatorAddress] = useState("")
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationResult, setSimulationResult] = useState<{
    uberDirectCost: number
    clientFee: number
    restaurantLoss: number
    estimatedMinutes: number
  } | null>(null)

  // Payments tab state
  const [cardProvider, setCardProvider] = useState<"stripe" | "sumup">("stripe")
  const [paypalEnabled, setPaypalEnabled] = useState(false)
  const [paypalEmail, setPaypalEmail] = useState("")
  const [cashEnabled, setCashEnabled] = useState(false)

  // OAuth payment connections
  const connections = useQuery(api.paymentConnections.getAll)
  const disconnectProvider = useMutation(api.paymentConnections.disconnect)
  const generateOAuthUrl = useAction(api.oauthConnect.generateOAuthUrl)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)

  type PaymentConnection = {
    _id: string
    provider: "stripe" | "sumup" | "paypal"
    merchantId: string
    status: "connected" | "disconnected" | "error"
    connectedAt: number
    updatedAt: number
  }

  const stripeConnection = connections?.find((c: PaymentConnection) => c.provider === "stripe")
  const sumupConnection = connections?.find((c: PaymentConnection) => c.provider === "sumup")
  const paypalConnection = connections?.find((c: PaymentConnection) => c.provider === "paypal")

  // Integrations tab state
  const [uberDirectCustomerId, setUberDirectCustomerId] = useState("")
  const [uberDirectClientId, setUberDirectClientId] = useState("")
  const [uberDirectClientSecret, setUberDirectClientSecret] = useState("")
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
      setFeeMode((settings.delivery as any).feeMode ?? "fixed")
      setDeliveryPercentage((settings.delivery as any).percentage?.toString() ?? "")
      setDeliveryMaxFee((settings.delivery as any).maxFee ? centsToEuros((settings.delivery as any).maxFee).toString() : "")

      // Payments
      if (settings.payments) {
        setCardProvider(settings.payments.cardProvider ?? "stripe")
        setPaypalEnabled(settings.payments.paypal ?? false)
        setPaypalEmail((settings.payments as any).paypalEmail ?? "")
        setCashEnabled(settings.payments.cash ?? false)
      }

      // Integrations
      if (settings.integrations?.uberDirect) {
        setUberDirectCustomerId(settings.integrations.uberDirect.customerId || "")
        setUberDirectClientId((settings.integrations.uberDirect as any).clientId || "")
        setUberDirectClientSecret((settings.integrations.uberDirect as any).clientSecret || "")
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

  // Handle OAuth callback URL params: show feedback and clean the URL
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("connected")
    const error = params.get("error")
    if (connected) {
      toast.success(`${connected} connecté avec succès`)
      window.history.replaceState({}, "", window.location.pathname)
    }
    if (error) {
      toast.error(`Erreur: ${error}`)
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  // Redirect to provider OAuth page to initiate connection
  const handleConnect = async (provider: "stripe" | "sumup") => {
    setConnectingProvider(provider)
    try {
      const { url } = await generateOAuthUrl({ provider })
      window.location.href = url
    } catch (error) {
      toast.error(`Erreur de connexion ${provider}`)
      setConnectingProvider(null)
    }
  }

  // Disconnect a payment provider OAuth connection
  const handleDisconnect = async (provider: "stripe" | "sumup") => {
    try {
      await disconnectProvider({ provider })
      toast.success(`${provider} déconnecté`)
    } catch (error) {
      toast.error(`Erreur lors de la déconnexion`)
    }
  }

  const handleSaveGeneral = async () => {
    const parsedTaxRate = parseFloat(taxRate)
    if (isNaN(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100) {
      toast.error("Taux de TVA invalide (0-100)")
      return
    }

    const parsedMinOrder = minimumOrder ? parseFloat(minimumOrder) : undefined
    if (minimumOrder && (parsedMinOrder === undefined || isNaN(parsedMinOrder) || parsedMinOrder < 0)) {
      toast.error("Montant minimum invalide")
      return
    }

    try {
      await updateSettings({
        currency,
        timezone,
        taxRate: parsedTaxRate,
        services: {
          dineIn,
          takeaway,
          delivery,
          clickAndCollect,
        },
        minimumOrderAmount: parsedMinOrder !== undefined ? eurosToCents(parsedMinOrder) : undefined,
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
    const parsedRadius = deliveryRadius ? parseFloat(deliveryRadius) : undefined
    if (deliveryRadius && (parsedRadius === undefined || isNaN(parsedRadius) || parsedRadius < 0)) {
      toast.error("Rayon de livraison invalide")
      return
    }

    const parsedFreeAbove = freeAbove ? parseFloat(freeAbove) : undefined
    if (freeAbove && (parsedFreeAbove === undefined || isNaN(parsedFreeAbove) || parsedFreeAbove < 0)) {
      toast.error("Seuil de livraison gratuite invalide")
      return
    }

    if (feeMode === "fixed") {
      const parsedFee = deliveryFee ? parseFloat(deliveryFee) : undefined
      if (deliveryFee && (parsedFee === undefined || isNaN(parsedFee) || parsedFee < 0)) {
        toast.error("Frais de livraison invalides")
        return
      }

      try {
        await updateSettings({
          delivery: {
            feeMode: "fixed" as const,
            fee: parsedFee !== undefined ? eurosToCents(parsedFee) : undefined,
            freeAbove: parsedFreeAbove !== undefined ? eurosToCents(parsedFreeAbove) : undefined,
            radius: parsedRadius,
          },
        })
        toast.success("Paramètres de livraison enregistrés")
      } catch (error) {
        toast.error("Échec de l'enregistrement")
        console.error(error)
      }
    } else {
      // percentage mode
      const parsedPercentage = deliveryPercentage ? parseFloat(deliveryPercentage) : undefined
      if (!parsedPercentage || isNaN(parsedPercentage) || parsedPercentage < 1 || parsedPercentage > 100) {
        toast.error("Pourcentage invalide (1-100)")
        return
      }

      const parsedMaxFee = deliveryMaxFee ? parseFloat(deliveryMaxFee) : undefined
      if (deliveryMaxFee && (parsedMaxFee === undefined || isNaN(parsedMaxFee) || parsedMaxFee < 0)) {
        toast.error("Plafond invalide")
        return
      }

      try {
        await updateSettings({
          delivery: {
            feeMode: "percentage" as const,
            percentage: parsedPercentage,
            maxFee: parsedMaxFee !== undefined ? eurosToCents(parsedMaxFee) : undefined,
            freeAbove: parsedFreeAbove !== undefined ? eurosToCents(parsedFreeAbove) : undefined,
            radius: parsedRadius,
          },
        })
        toast.success("Paramètres de livraison enregistrés")
      } catch (error) {
        toast.error("Échec de l'enregistrement")
        console.error(error)
      }
    }
  }

  const handleSimulate = async () => {
    if (!simulatorAddress.trim()) return
    setIsSimulating(true)
    setSimulationResult(null)

    try {
      // TODO: Call uberDirect.getDeliveryQuote action when available
      // For now, show a placeholder message
      toast.info("Le simulateur sera disponible après la configuration d'Uber Direct")
    } catch (error) {
      toast.error("Impossible d'estimer le coût")
      console.error(error)
    } finally {
      setIsSimulating(false)
    }
  }

  const handleSavePayments = async () => {
    // Validate PayPal email if PayPal is enabled
    if (paypalEnabled && paypalEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim())) {
      toast.error("Adresse email PayPal invalide")
      return
    }
    try {
      await updateSettings({
        payments: {
          cardProvider,
          paypal: paypalEnabled && !!paypalEmail.trim(),
          paypalEmail: paypalEmail.trim() || undefined,
          cash: cashEnabled,
        },
      })
      toast.success("Paramètres de paiement enregistrés")
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
            clientId: uberDirectClientId || undefined,
            clientSecret: uberDirectClientSecret || undefined,
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

      <Tabs
        defaultValue={
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("tab") === "payments"
            ? "payments"
            : "general"
        }
        className="space-y-4"
      >
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
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Paiements
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
          {/* Pricing mode section */}
          <div className="border border-border/50 rounded-lg p-6 space-y-6">
            {/* Fee mode selector - same card pattern as payment provider */}
            <div className="space-y-3">
              <Label>Mode de tarification</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFeeMode("fixed")
                    setSimulationResult(null)
                  }}
                  className={`flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
                    feeMode === "fixed"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className={`h-3 w-3 rounded-full border-2 ${
                    feeMode === "fixed"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`} />
                  <div>
                    <div className="text-sm font-medium">Prix fixe</div>
                    <div className="text-xs text-muted-foreground">Montant constant par commande</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFeeMode("percentage")
                    setSimulationResult(null)
                  }}
                  className={`flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
                    feeMode === "percentage"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className={`h-3 w-3 rounded-full border-2 ${
                    feeMode === "percentage"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`} />
                  <div>
                    <div className="text-sm font-medium">Pourcentage Uber Direct</div>
                    <div className="text-xs text-muted-foreground">Calculé sur le coût réel de la livraison</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Fixed mode fields */}
            {feeMode === "fixed" && (
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
            )}

            {/* Percentage mode fields */}
            {feeMode === "percentage" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveryPercentage">Pourcentage du coût Uber Direct (%)</Label>
                  <Input
                    id="deliveryPercentage"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={deliveryPercentage}
                    onChange={(e) => setDeliveryPercentage(e.target.value)}
                    placeholder="70"
                  />
                  <p className="text-xs text-muted-foreground">Entre 1 et 100</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryMaxFee">Plafond maximum (€)</Label>
                  <Input
                    id="deliveryMaxFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryMaxFee}
                    onChange={(e) => setDeliveryMaxFee(e.target.value)}
                    placeholder="Optionnel"
                    disabled={!deliveryPercentage}
                  />
                  <p className="text-xs text-muted-foreground">Optionnel — sans plafond si vide</p>
                </div>
              </div>
            )}

            <Button onClick={handleSaveDelivery} size="sm">
              Enregistrer les paramètres de livraison
            </Button>
          </div>

          {/* Simulator section - only visible in percentage mode with Uber Direct enabled */}
          {feeMode === "percentage" && uberDirectEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Simulateur de coût</CardTitle>
                <CardDescription className="text-xs">
                  Estimez ce que paiera le client et votre perte sur une livraison
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="simulatorAddress">Adresse de livraison (test)</Label>
                  <Input
                    id="simulatorAddress"
                    type="text"
                    value={simulatorAddress}
                    onChange={(e) => {
                      setSimulatorAddress(e.target.value)
                      setSimulationResult(null)
                    }}
                    placeholder="ex: 12 rue de la Paix, 75002 Paris"
                  />
                </div>

                <Button
                  onClick={handleSimulate}
                  size="sm"
                  variant="outline"
                  disabled={!simulatorAddress.trim() || isSimulating || !deliveryPercentage}
                >
                  {isSimulating ? "Estimation en cours..." : "Estimer le coût"}
                </Button>

                {simulationResult && (
                  <>
                    <div className="border border-border/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Coût Uber Direct</span>
                        <span>{centsToEuros(simulationResult.uberDirectCost).toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais client ({deliveryPercentage}%)</span>
                        <span className="font-medium text-primary">{centsToEuros(simulationResult.clientFee).toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {simulationResult.restaurantLoss > 0 ? "Perte restaurant" : "Marge restaurant"}
                        </span>
                        <span className={simulationResult.restaurantLoss > 0 ? "text-destructive" : "text-green-600"}>
                          {centsToEuros(simulationResult.restaurantLoss).toFixed(2)} €
                        </span>
                      </div>
                      <div className="border-t border-border/50 pt-3 flex justify-between text-sm">
                        <span className="text-muted-foreground">Temps estimé</span>
                        <span>~{simulationResult.estimatedMinutes} min</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                      <span className="text-amber-600 dark:text-amber-400 text-sm mt-0.5">⚠</span>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Estimation indicative. Le prix réel peut varier selon la demande et la disponibilité des coursiers.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="border border-border/50 rounded-lg p-6 space-y-6">

            {/* Card provider section: Stripe and SumUp with OAuth connect/disconnect */}
            <div className="space-y-3">
              <Label>Paiement par carte bancaire</Label>
              <p className="text-xs text-muted-foreground">
                Choisissez votre prestataire de paiement par carte. Un seul peut être actif à la fois.
              </p>
              <div className="grid grid-cols-2 gap-4">

                {/* Stripe card */}
                <div
                  className={`border rounded-lg p-4 space-y-3 transition-colors cursor-pointer ${
                    cardProvider === "stripe"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/50 opacity-60 hover:opacity-80 hover:border-border"
                  }`}
                  onClick={() => setCardProvider("stripe")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                        cardProvider === "stripe"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">Stripe</span>
                        <FieldInfo {...HELP.payments.stripe} />
                      </div>
                      <div className="text-xs text-muted-foreground">Paiement en ligne et TPE</div>
                    </div>
                  </div>

                  {/* Connection status badge */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        stripeConnection?.status === "connected" ? "bg-green-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {stripeConnection?.status === "connected" ? "Connecté" : "Non connecté"}
                    </span>
                  </div>

                  {/* Merchant ID when connected */}
                  {stripeConnection?.status === "connected" && stripeConnection.merchantId && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      ID : {stripeConnection.merchantId}
                    </p>
                  )}

                  {/* Connect / Disconnect button — only shown for selected provider */}
                  {cardProvider === "stripe" && (
                    <div onClick={(e) => e.stopPropagation()}>
                      {stripeConnection?.status === "connected" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 h-7"
                          onClick={() => handleDisconnect("stripe")}
                        >
                          Déconnecter
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7"
                          disabled={connectingProvider === "stripe"}
                          onClick={() => handleConnect("stripe")}
                        >
                          {connectingProvider === "stripe" ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              Connexion...
                            </>
                          ) : (
                            "Connecter"
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* SumUp card */}
                <div
                  className={`border rounded-lg p-4 space-y-3 transition-colors cursor-pointer ${
                    cardProvider === "sumup"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/50 opacity-60 hover:opacity-80 hover:border-border"
                  }`}
                  onClick={() => setCardProvider("sumup")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                        cardProvider === "sumup"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">SumUp</span>
                        <FieldInfo {...HELP.payments.sumup} />
                      </div>
                      <div className="text-xs text-muted-foreground">Terminal de paiement mobile</div>
                    </div>
                  </div>

                  {/* Connection status badge */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        sumupConnection?.status === "connected" ? "bg-green-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {sumupConnection?.status === "connected" ? "Connecté" : "Non connecté"}
                    </span>
                  </div>

                  {/* Merchant ID when connected */}
                  {sumupConnection?.status === "connected" && sumupConnection.merchantId && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      ID : {sumupConnection.merchantId}
                    </p>
                  )}

                  {/* Connect / Disconnect button — only shown for selected provider */}
                  {cardProvider === "sumup" && (
                    <div onClick={(e) => e.stopPropagation()}>
                      {sumupConnection?.status === "connected" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 h-7"
                          onClick={() => handleDisconnect("sumup")}
                        >
                          Déconnecter
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7"
                          disabled={connectingProvider === "sumup"}
                          onClick={() => handleConnect("sumup")}
                        >
                          {connectingProvider === "sumup" ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              Connexion...
                            </>
                          ) : (
                            "Connecter"
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Other payment methods */}
            <div className="space-y-3">
              <Label>Autres moyens de paiement</Label>
              <div className="space-y-3">

                {/* PayPal — email-based connection */}
                <div className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">PayPal</p>
                        <FieldInfo {...HELP.payments.paypal} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Accepter les paiements via PayPal
                      </p>
                    </div>
                    <Switch
                      checked={paypalEnabled}
                      onCheckedChange={setPaypalEnabled}
                    />
                  </div>

                  {paypalEnabled && (
                    <div className="space-y-1.5">
                      <Label htmlFor="paypalEmail" className="text-xs">
                        Email PayPal Business
                      </Label>
                      <Input
                        id="paypalEmail"
                        type="email"
                        placeholder="votre-email@business.paypal.com"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        L'adresse email associée à votre compte PayPal Business.
                        Les paiements seront envoyés directement sur ce compte.
                      </p>
                    </div>
                  )}
                </div>

                {/* Cash — simple toggle, no OAuth */}
                <div className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
                  <div>
                    <Label htmlFor="cashEnabled" className="cursor-pointer">Espèces</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Disponible uniquement pour les commandes sur place et Click &amp; Collect
                    </p>
                  </div>
                  <Switch
                    id="cashEnabled"
                    checked={cashEnabled}
                    onCheckedChange={setCashEnabled}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSavePayments} size="sm">
              Enregistrer les paramètres de paiement
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
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-base">Uber Direct</CardTitle>
                    <FieldInfo
                      title="Uber Direct"
                      description="Service de livraison on-demand qui utilise le réseau de coursiers Uber pour livrer vos commandes."
                      steps={[
                        { text: "Créez un compte Uber Direct sur le dashboard Uber." },
                        { text: "Obtenez votre Customer ID, Client ID et Client Secret (voir l'aide de chaque champ)." },
                        { text: "Entrez ces identifiants dans les champs ci-dessous." },
                        { text: "Activez l'intégration pour commencer à utiliser Uber Direct." },
                      ]}
                      links={[
                        { label: "Uber Direct Dashboard", url: "https://dashboard.uber.com/" },
                        { label: "Guide de démarrage Uber Direct", url: "https://developer.uber.com/docs/deliveries/overview" },
                      ]}
                    />
                  </div>
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
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="uberDirectCustomerId" className="text-xs">
                      Customer ID (Uber Store ID)
                    </Label>
                    <FieldInfo {...HELP.uberDirect.customerId} />
                  </div>
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
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="uberDirectClientId" className="text-xs">
                      Client ID (OAuth)
                    </Label>
                    <FieldInfo {...HELP.uberDirect.clientId} />
                  </div>
                  <Input
                    id="uberDirectClientId"
                    type="text"
                    value={uberDirectClientId}
                    onChange={(e) => setUberDirectClientId(e.target.value)}
                    placeholder="Entrez votre Client ID"
                    disabled={!uberDirectEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="uberDirectClientSecret" className="text-xs">
                      Client Secret (OAuth)
                    </Label>
                    <FieldInfo {...HELP.uberDirect.clientSecret} />
                  </div>
                  <Input
                    id="uberDirectClientSecret"
                    type="password"
                    value={uberDirectClientSecret}
                    onChange={(e) => setUberDirectClientSecret(e.target.value)}
                    placeholder="Entrez votre Client Secret"
                    disabled={!uberDirectEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Uber Eats */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-base">Uber Eats</CardTitle>
                    <FieldInfo {...HELP.uberEats.general} />
                  </div>
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
            </Card>

            {/* Deliveroo */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-base">Deliveroo</CardTitle>
                    <FieldInfo {...HELP.deliveroo.general} />
                  </div>
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
