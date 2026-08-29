"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { type AddressValue } from "@be-in-digital/ui"
import { calculateDeliveryFee } from "@be-in-digital/convex-functions/deliveryFee"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { centsToEuros, eurosToCents } from "../../lib/formatters"
import type { PaymentConnection } from "./settings-types"

export function useSettingsForm() {
  const api = useAdminApiStore((s) => s.api)
  const adminStoreId = useAdminStoreId()
  /**
   * `getAdmin`, not `get` — the form has to load what it is going to save.
   *
   * `get` is the public storefront query, and it strips the Uber Direct
   * credentials (`customerId`, `clientId`, `clientSecret`, `apiKey`). The
   * Integrations tab initialised its fields from that stripped object, so they
   * came up empty, and saving patched the empty values over the stored ones:
   * opening the tab and pressing Enregistrer deleted the credentials (#169).
   *
   * The Paramètres entry is already gated on `settings:read` in `nav-config`,
   * which is exactly the permission `getAdmin` checks — anyone who can reach
   * this page can read it.
   */
  const settings = useQuery(api.globalSettings.getAdmin)
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
  const [simulatorAddress, setSimulatorAddress] = useState<AddressValue>({
    street: "", city: "", postalCode: "", country: "France",
  })
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationResult, setSimulationResult] = useState<{
    uberDirectCost: number
    clientFee: number
    restaurantLoss: number
    estimatedMinutes: number
  } | null>(null)
  const getDeliveryQuote = useAction(api.uberDirect.getDeliveryQuote)

  // Payments tab state
  const [cardProvider, setCardProvider] = useState<"stripe" | "sumup">("stripe")
  const [paypalEnabled, setPaypalEnabled] = useState(false)
  const [paypalEmail, setPaypalEmail] = useState("")
  const [cashEnabled, setCashEnabled] = useState(false)

  // OAuth payment connections
  const connections = useQuery(api.paymentConnections.getAll)
  const disconnectProvider = useMutation(api.paymentConnections.disconnect)
  const generateOAuthUrl = useAction(api.oauthConnect.generateOAuthUrl)
  const validateIntegration = useAction(api.validateIntegration.validate)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [isValidatingIntegrations, setIsValidatingIntegrations] = useState(false)

  const stripeConnection = connections?.find((c: PaymentConnection) => c.provider === "stripe")
  const sumupConnection = connections?.find((c: PaymentConnection) => c.provider === "sumup")
  const paypalConnection = connections?.find((c: PaymentConnection) => c.provider === "paypal")

  // Integrations tab state
  const [uberDirectCustomerId, setUberDirectCustomerId] = useState("")
  const [uberDirectClientId, setUberDirectClientId] = useState("")
  const [uberDirectClientSecret, setUberDirectClientSecret] = useState("")
  const [uberDirectEnabled, setUberDirectEnabled] = useState(true)
  const [uberEatsEnabled, setUberEatsEnabled] = useState(true)
  const [uberEatsPriceMarkup, setUberEatsPriceMarkup] = useState("")
  const [deliverooEnabled, setDeliverooEnabled] = useState(true)
  const [deliverooPriceMarkup, setDeliverooPriceMarkup] = useState("")

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
        setUberEatsPriceMarkup((settings.integrations.uberEats as any).priceMarkup?.toString() ?? "")
      }
      if (settings.integrations?.deliveroo) {
        setDeliverooEnabled(settings.integrations.deliveroo.enabled)
        setDeliverooPriceMarkup((settings.integrations.deliveroo as any).priceMarkup?.toString() ?? "")
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
    if (!simulatorAddress.latitude || !simulatorAddress.longitude) {
      toast.error("Sélectionnez une adresse depuis les suggestions pour obtenir les coordonnées")
      return
    }
    if (!adminStoreId) {
      toast.error("Aucun restaurant sélectionné")
      return
    }
    setIsSimulating(true)
    setSimulationResult(null)

    try {
      const quote = await getDeliveryQuote({
        storeId: adminStoreId as any,
        dropoffLatitude: simulatorAddress.latitude,
        dropoffLongitude: simulatorAddress.longitude,
        dropoffAddress: `${simulatorAddress.street}, ${simulatorAddress.postalCode} ${simulatorAddress.city}`,
      })

      const parsedPercentage = parseFloat(deliveryPercentage) || 100
      const parsedMaxFee = deliveryMaxFee ? parseFloat(deliveryMaxFee) : undefined
      const parsedFreeAbove = freeAbove ? parseFloat(freeAbove) : undefined

      const result = calculateDeliveryFee({
        feeMode: "percentage",
        percentage: parsedPercentage,
        maxFee: parsedMaxFee !== undefined ? eurosToCents(parsedMaxFee) : undefined,
        freeAbove: parsedFreeAbove !== undefined ? eurosToCents(parsedFreeAbove) : undefined,
        orderSubtotal: 2000, // 20€ simulation baseline
        uberDirectFee: quote.fee,
      })

      setSimulationResult({
        uberDirectCost: quote.fee,
        clientFee: result.clientFee,
        restaurantLoss: result.restaurantLoss,
        estimatedMinutes: quote.estimatedDeliveryMinutes,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Impossible d'estimer le coût"
      if (msg.includes("UNDELIVERABLE_ZONE")) {
        toast.error("Uber Direct ne peut pas livrer à cette adresse")
      } else if (msg.includes("STORE_ADDRESS_INCOMPLETE")) {
        toast.error("L'adresse du restaurant n'a pas de coordonnées GPS. Mettez à jour l'adresse du restaurant.")
      } else if (msg.includes("UBER_DIRECT_NOT_CONFIGURED")) {
        toast.error("Uber Direct n'est pas correctement configuré. Vérifiez les credentials dans l'onglet Intégrations.")
      } else {
        toast.error(msg)
      }
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
    // Validate Uber Direct credentials before saving (only if enabled with credentials)
    const hasUberDirectCreds = uberDirectEnabled &&
      uberDirectClientId.trim() &&
      uberDirectClientSecret.trim() &&
      uberDirectCustomerId.trim()

    if (hasUberDirectCreds) {
      setIsValidatingIntegrations(true)
      try {
        const validation = await validateIntegration({
          platform: "uberDirect",
          clientId: uberDirectClientId.trim(),
          clientSecret: uberDirectClientSecret.trim(),
          customerId: uberDirectCustomerId.trim(),
        })

        if (!validation.valid) {
          toast.error(`Uber Direct : ${validation.error}`)
          setIsValidatingIntegrations(false)
          return
        }
      } catch (error) {
        toast.error("Impossible de valider les credentials Uber Direct")
        setIsValidatingIntegrations(false)
        return
      }
    }

    // If Uber Direct is enabled but some credentials are missing, warn the user
    if (uberDirectEnabled && !hasUberDirectCreds && (uberDirectClientId.trim() || uberDirectClientSecret.trim() || uberDirectCustomerId.trim())) {
      toast.error("Uber Direct : les 3 champs (Customer ID, Client ID, Client Secret) sont requis")
      return
    }

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
            priceMarkup: uberEatsPriceMarkup ? parseFloat(uberEatsPriceMarkup) : undefined,
          },
          deliveroo: {
            enabled: deliverooEnabled,
            priceMarkup: deliverooPriceMarkup ? parseFloat(deliverooPriceMarkup) : undefined,
          },
        },
      })
      toast.success(hasUberDirectCreds ? "Intégrations vérifiées et enregistrées" : "Intégrations enregistrées")
    } catch (error) {
      toast.error("Échec de l'enregistrement")
      console.error(error)
    } finally {
      setIsValidatingIntegrations(false)
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

  return {
    settings,
    // General
    currency,
    setCurrency,
    timezone,
    setTimezone,
    taxRate,
    setTaxRate,
    minimumOrder,
    setMinimumOrder,
    dineIn,
    setDineIn,
    takeaway,
    setTakeaway,
    delivery,
    setDelivery,
    clickAndCollect,
    setClickAndCollect,
    handleSaveGeneral,
    // Hours
    hours,
    updateHour,
    applyWeekdayHours,
    applyAllDaysHours,
    handleSaveHours,
    // Delivery
    feeMode,
    setFeeMode,
    deliveryRadius,
    setDeliveryRadius,
    freeAbove,
    setFreeAbove,
    deliveryFee,
    setDeliveryFee,
    deliveryPercentage,
    setDeliveryPercentage,
    deliveryMaxFee,
    setDeliveryMaxFee,
    handleSaveDelivery,
    simulatorAddress,
    setSimulatorAddress,
    handleSimulate,
    isSimulating,
    simulationResult,
    setSimulationResult,
    // Payments
    cardProvider,
    setCardProvider,
    stripeConnection,
    sumupConnection,
    paypalConnection,
    connectingProvider,
    handleConnect,
    handleDisconnect,
    paypalEnabled,
    setPaypalEnabled,
    paypalEmail,
    setPaypalEmail,
    cashEnabled,
    setCashEnabled,
    handleSavePayments,
    // Integrations
    uberDirectEnabled,
    setUberDirectEnabled,
    uberDirectCustomerId,
    setUberDirectCustomerId,
    uberDirectClientId,
    setUberDirectClientId,
    uberDirectClientSecret,
    setUberDirectClientSecret,
    uberEatsEnabled,
    setUberEatsEnabled,
    uberEatsPriceMarkup,
    setUberEatsPriceMarkup,
    deliverooEnabled,
    setDeliverooEnabled,
    deliverooPriceMarkup,
    setDeliverooPriceMarkup,
    handleSaveIntegrations,
    isValidatingIntegrations,
  }
}
