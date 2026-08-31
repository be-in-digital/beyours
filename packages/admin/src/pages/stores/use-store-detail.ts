"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, use, useEffect } from "react"
import { type AddressValue } from "@be-in-digital/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { centsToEuros, eurosToCents } from "../../lib/formatters"
import type { DayHours, StoreOverrides, StoreIntegration } from "./store-detail-types"
import {
  DEFAULT_SOUND_CONFIG,
  KITCHEN_ALERTS,
  clampVolume,
  resolveSoundConfig,
  type KitchenSoundConfig,
} from "../../lib/kitchen-alerts"

export function useStoreDetail({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params)
  const { api } = useAdminApiStore()
  const store = useQuery(api.stores.getById, { id: storeId as string })
  const globalSettings = useQuery(api.globalSettings.get)
  const storeIntegrations = useQuery(api.storeIntegrations.listByStore, { storeId: storeId as string })

  const updateStore = useMutation(api.stores.update)
  const updateAddressMutation = useMutation(api.stores.updateAddress)
  const updateHours = useMutation(api.stores.updateHours)
  const updateOverrides = useMutation(api.stores.updateOverrides)
  const updateSoundConfig = useMutation(api.stores.updateSoundConfig)
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

  // Kitchen tab state
  const [soundConfig, setSoundConfig] =
    useState<KitchenSoundConfig>(DEFAULT_SOUND_CONFIG)

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

    // An establishment that has never been configured shows the display's own
    // fallbacks, so the form opens on what the kitchen is currently hearing
    // rather than on zeroes.
    setSoundConfig(resolveSoundConfig(store.soundConfig as never))

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

  const handleUpdateSounds = async () => {
    try {
      // Clamped here as well as in the slider: the value reaches the schema
      // through a mutation anyone with `stores:write` can call, and a volume
      // outside 0–100 is a gain the display would clamp silently.
      const payload = {} as KitchenSoundConfig
      for (const { key } of KITCHEN_ALERTS) {
        payload[key] = {
          enabled: soundConfig[key].enabled,
          volume: clampVolume(soundConfig[key].volume),
        }
      }

      await updateSoundConfig({ id: storeId as string, soundConfig: payload })
      toast.success("Alertes sonores mises à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour des alertes")
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
        const parsed = parseFloat(minimumOrderAmount)
        if (isNaN(parsed) || parsed < 0) { toast.error("Montant minimum invalide"); return }
        overrides.minimumOrderAmount = eurosToCents(parsed)
      }

      if (customizeDeliveryRadius && deliveryRadius) {
        const parsed = parseFloat(deliveryRadius)
        if (isNaN(parsed) || parsed < 0) { toast.error("Rayon de livraison invalide"); return }
        overrides.deliveryRadius = Math.round(parsed * 1000)
      }

      if (customizeDeliveryFee && deliveryFee) {
        const parsed = parseFloat(deliveryFee)
        if (isNaN(parsed) || parsed < 0) { toast.error("Frais de livraison invalides"); return }
        overrides.deliveryFee = eurosToCents(parsed)
      }

      if (customizeDeliveryFree && deliveryFreeAbove) {
        const parsed = parseFloat(deliveryFreeAbove)
        if (isNaN(parsed) || parsed < 0) { toast.error("Seuil de livraison gratuite invalide"); return }
        overrides.deliveryFreeAbove = eurosToCents(parsed)
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
        console.error("Uber Eats validation failed:", validation.error)
        toast.error("La connexion à Uber Eats a échoué. Veuillez vérifier vos identifiants et réessayer.")
        return
      }

      const parsedPrepTime = uberEatsPrepTime ? parseInt(uberEatsPrepTime, 10) : undefined
      if (uberEatsPrepTime && (parsedPrepTime === undefined || isNaN(parsedPrepTime) || parsedPrepTime <= 0)) {
        toast.error("Temps de préparation invalide")
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
        prepTime: parsedPrepTime,
      })

      toast.success("Intégration Uber Eats vérifiée et enregistrée")
    } catch (error) {
      toast.error("Échec de la validation Uber Eats")
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
        console.error("Deliveroo validation failed:", validation.error)
        toast.error("La connexion à Deliveroo a échoué. Veuillez vérifier vos identifiants et réessayer.")
        return
      }

      const parsedDlPrepTime = deliverooPrepTime ? parseInt(deliverooPrepTime, 10) : undefined
      if (deliverooPrepTime && (parsedDlPrepTime === undefined || isNaN(parsedDlPrepTime) || parsedDlPrepTime <= 0)) {
        toast.error("Temps de préparation invalide")
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
        prepTime: parsedDlPrepTime,
        brandId: deliverooBrandId || undefined,
      })

      toast.success("Intégration Deliveroo vérifiée et enregistrée")
    } catch (error) {
      toast.error("Échec de la validation Deliveroo")
      console.error(error)
    } finally {
      setIsValidatingDeliveroo(false)
    }
  }

  const handleRemoveUberEats = async () => {
    setIsRemovingIntegration(true)
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
    } finally {
      setIsRemovingIntegration(false)
      setRemovingPlatform(null)
    }
  }

  // Menu sync loading states
  const [isSyncingUberEats, setIsSyncingUberEats] = useState(false)
  const [isSyncingDeliveroo, setIsSyncingDeliveroo] = useState(false)

  // Import loading states
  const [isImportingUberEats, setIsImportingUberEats] = useState(false)
  const [isImportingDeliveroo, setIsImportingDeliveroo] = useState(false)

  // Integration removal confirmation
  const [removingPlatform, setRemovingPlatform] = useState<"uberEats" | "deliveroo" | null>(null)
  const [isRemovingIntegration, setIsRemovingIntegration] = useState(false)

  const syncUberEatsStore = useAction(api.uberEatsMenuSync.syncStore)
  const syncDeliverooStore = useAction(api.deliverooMenuSync.syncStore)
  const importFromUberEats = useAction(api.uberEatsImport.importFromStore)
  const importFromDeliveroo = useAction(api.deliverooImport.importFromStore)

  const handleSyncUberEatsMenu = async () => {
    setIsSyncingUberEats(true)
    try {
      const result = await syncUberEatsStore({ storeId }) as { success: boolean; error?: string } | undefined
      if (result?.success) {
        toast.success("Menu Uber Eats synchronisé avec succès")
      } else {
        console.error("Uber Eats menu sync failed:", result?.error)
        toast.error("La synchronisation du menu Uber Eats a échoué. Veuillez réessayer dans quelques instants.")
      }
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
      const result = await syncDeliverooStore({ storeId }) as { success: boolean; error?: string } | undefined
      if (result?.success) {
        toast.success("Menu Deliveroo synchronisé avec succès")
      } else {
        console.error("Deliveroo menu sync failed:", result?.error)
        toast.error("La synchronisation du menu Deliveroo a échoué. Veuillez réessayer dans quelques instants.")
      }
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
        console.error("Uber Eats import failed:", result.error)
        toast.error("L'import des produits Uber Eats a échoué. Veuillez vérifier votre configuration et réessayer.")
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
        console.error("Deliveroo import failed:", result.error)
        toast.error("L'import des produits Deliveroo a échoué. Veuillez vérifier votre configuration et réessayer.")
      }
    } catch (error) {
      toast.error("Erreur lors de l'import des produits Deliveroo")
      console.error(error)
    } finally {
      setIsImportingDeliveroo(false)
    }
  }

  const handleRemoveDeliveroo = async () => {
    setIsRemovingIntegration(true)
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
    } finally {
      setIsRemovingIntegration(false)
      setRemovingPlatform(null)
    }
  }

  return {
    store,
    globalSettings,
    storeIntegrations,
    name,
    setName,
    slug,
    setSlug,
    description,
    setDescription,
    phone,
    setPhone,
    email,
    setEmail,
    status,
    setStatus,
    address,
    setAddress,
    soundConfig,
    setSoundConfig,
    handleUpdateSounds,
    useGlobalHours,
    setUseGlobalHours,
    hours,
    setHours,
    customizeServices,
    setCustomizeServices,
    customizeMinOrder,
    setCustomizeMinOrder,
    customizeDeliveryRadius,
    setCustomizeDeliveryRadius,
    customizeDeliveryFee,
    setCustomizeDeliveryFee,
    customizeDeliveryFree,
    setCustomizeDeliveryFree,
    dineIn,
    setDineIn,
    takeaway,
    setTakeaway,
    delivery,
    setDelivery,
    clickAndCollect,
    setClickAndCollect,
    minimumOrderAmount,
    setMinimumOrderAmount,
    deliveryRadius,
    setDeliveryRadius,
    deliveryFee,
    setDeliveryFee,
    deliveryFreeAbove,
    setDeliveryFreeAbove,
    uberEatsStoreId,
    setUberEatsStoreId,
    uberEatsSyncMenu,
    setUberEatsSyncMenu,
    uberEatsAutoAccept,
    setUberEatsAutoAccept,
    uberEatsEnabled,
    setUberEatsEnabled,
    uberEatsStoreStatus,
    setUberEatsStoreStatus,
    uberEatsPrepTime,
    setUberEatsPrepTime,
    deliverooStoreId,
    setDeliverooStoreId,
    deliverooBrandId,
    setDeliverooBrandId,
    deliverooSyncMenu,
    setDeliverooSyncMenu,
    deliverooAutoAccept,
    setDeliverooAutoAccept,
    deliverooEnabled,
    setDeliverooEnabled,
    deliverooStoreStatus,
    setDeliverooStoreStatus,
    deliverooPrepTime,
    setDeliverooPrepTime,
    isValidatingUberEats,
    isValidatingDeliveroo,
    isSyncingUberEats,
    isSyncingDeliveroo,
    isImportingUberEats,
    isImportingDeliveroo,
    removingPlatform,
    setRemovingPlatform,
    isRemovingIntegration,
    handleUpdateGeneral,
    handleUpdateHours,
    handleSetAllWeekdays,
    handleSetAllDays,
    handleUpdateSettings,
    handleSaveUberEats,
    handleSaveDeliveroo,
    handleRemoveUberEats,
    handleSyncUberEatsMenu,
    handleSyncDeliverooMenu,
    handleImportUberEats,
    handleImportDeliveroo,
    handleRemoveDeliveroo,
  }
}
