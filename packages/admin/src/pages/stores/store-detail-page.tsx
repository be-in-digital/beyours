"use client"

import { ArrowLeft, AlertTriangle } from "lucide-react"
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { centsToEuros } from "../../lib/formatters"
import { useStoreDetail } from "./use-store-detail"
import { StoreGeneralTab } from "./store-general-tab"
import { StoreHoursTab } from "./store-hours-tab"
import { StoreSettingsTab } from "./store-settings-tab"
import { StoreKitchenTab } from "./store-kitchen-tab"
import { StoreIntegrationsTab } from "./store-integrations-tab"

export function StoreDetailPage({ params }: { params: Promise<{ storeId: string }> }) {
  const {
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
    reservationUrl,
    setReservationUrl,
    setEmail,
    status,
    setStatus,
    address,
    setAddress,
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
    uberEatsPublicUrl,
    setUberEatsPublicUrl,
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
    deliverooPublicUrl,
    setDeliverooPublicUrl,
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
    soundConfig,
    setSoundConfig,
    handleUpdateSounds,
    displayConfig,
    setDisplayConfig,
    handleUpdateDisplay,
    categories,
    orderConfirmation,
    setOrderConfirmation,
    handleUpdateOrderConfirmation,
    printConfig,
    setPrintConfig,
    handleUpdatePrintConfig,
    kitchenStations,
    setKitchenStations,
    stationMapping,
    setStationMapping,
    handleUpdateStations,
    handleSaveUberEats,
    handleSaveDeliveroo,
    handleRemoveUberEats,
    handleSyncUberEatsMenu,
    handleSyncDeliverooMenu,
    handleImportUberEats,
    handleImportDeliveroo,
    handleRemoveDeliveroo,
  } = useStoreDetail({ params })

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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <a href="/dashboard/stores">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{store.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez les détails et paramètres de l&apos;établissement</p>
        </div>
      </div>

      {store.status === "draft" && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Établissement en brouillon</AlertTitle>
          <AlertDescription>
            Cet établissement n&apos;est pas encore visible. Complétez les informations générales, les horaires et les paramètres, puis changez le statut en &quot;Ouvert&quot; dans l&apos;onglet Général pour l&apos;activer.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="hours">Horaires</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
          <TabsTrigger value="kitchen">Cuisine</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          <StoreGeneralTab
            name={name}
            setName={setName}
            slug={slug}
            setSlug={setSlug}
            description={description}
            setDescription={setDescription}
            phone={phone}
            setPhone={setPhone}
            email={email}
            reservationUrl={reservationUrl}
            setReservationUrl={setReservationUrl}
            setEmail={setEmail}
            status={status}
            setStatus={setStatus}
            address={address}
            setAddress={setAddress}
            handleUpdateGeneral={handleUpdateGeneral}
          />
        </TabsContent>

        {/* HOURS TAB */}
        <TabsContent value="hours" className="space-y-6">
          <StoreHoursTab
            useGlobalHours={useGlobalHours}
            setUseGlobalHours={setUseGlobalHours}
            globalHours={globalHours}
            hours={hours}
            setHours={setHours}
            handleSetAllWeekdays={handleSetAllWeekdays}
            handleSetAllDays={handleSetAllDays}
            handleUpdateHours={handleUpdateHours}
          />
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-6">
          <StoreSettingsTab
            customizeServices={customizeServices}
            setCustomizeServices={setCustomizeServices}
            dineIn={dineIn}
            setDineIn={setDineIn}
            takeaway={takeaway}
            setTakeaway={setTakeaway}
            delivery={delivery}
            setDelivery={setDelivery}
            clickAndCollect={clickAndCollect}
            setClickAndCollect={setClickAndCollect}
            customizeMinOrder={customizeMinOrder}
            setCustomizeMinOrder={setCustomizeMinOrder}
            minimumOrderAmount={minimumOrderAmount}
            setMinimumOrderAmount={setMinimumOrderAmount}
            customizeDeliveryRadius={customizeDeliveryRadius}
            setCustomizeDeliveryRadius={setCustomizeDeliveryRadius}
            deliveryRadius={deliveryRadius}
            setDeliveryRadius={setDeliveryRadius}
            customizeDeliveryFee={customizeDeliveryFee}
            setCustomizeDeliveryFee={setCustomizeDeliveryFee}
            deliveryFee={deliveryFee}
            setDeliveryFee={setDeliveryFee}
            customizeDeliveryFree={customizeDeliveryFree}
            setCustomizeDeliveryFree={setCustomizeDeliveryFree}
            deliveryFreeAbove={deliveryFreeAbove}
            setDeliveryFreeAbove={setDeliveryFreeAbove}
            globalServices={globalServices}
            globalMinOrder={globalMinOrder}
            globalDeliveryRadius={globalDeliveryRadius}
            globalDeliveryFee={globalDeliveryFee}
            globalDeliveryFree={globalDeliveryFree}
            handleUpdateSettings={handleUpdateSettings}
          />
        </TabsContent>

        {/* KITCHEN TAB */}
        <TabsContent value="kitchen" className="space-y-6">
          <StoreKitchenTab
            soundConfig={soundConfig}
            setSoundConfig={setSoundConfig}
            handleUpdateSounds={handleUpdateSounds}
            orderConfirmation={orderConfirmation}
            setOrderConfirmation={setOrderConfirmation}
            handleUpdateOrderConfirmation={handleUpdateOrderConfirmation}
            printConfig={printConfig}
            setPrintConfig={setPrintConfig}
            handleUpdatePrintConfig={handleUpdatePrintConfig}
            categories={categories}
            kitchenStations={kitchenStations}
            setKitchenStations={setKitchenStations}
            stationMapping={stationMapping}
            setStationMapping={setStationMapping}
            handleUpdateStations={handleUpdateStations}
            displayConfig={displayConfig}
            setDisplayConfig={setDisplayConfig}
            handleUpdateDisplay={handleUpdateDisplay}
            storeId={store?._id}
          />
        </TabsContent>

        {/* INTEGRATIONS TAB */}
        <TabsContent value="integrations" className="space-y-4">
          <StoreIntegrationsTab
            storeId={store?._id}
            storeIntegrations={storeIntegrations}
            hasUberEatsGlobal={hasUberEatsGlobal}
            hasDeliverooGlobal={hasDeliverooGlobal}
            uberEatsStoreId={uberEatsStoreId}
            setUberEatsStoreId={setUberEatsStoreId}
            uberEatsSyncMenu={uberEatsSyncMenu}
            setUberEatsSyncMenu={setUberEatsSyncMenu}
            uberEatsAutoAccept={uberEatsAutoAccept}
            setUberEatsAutoAccept={setUberEatsAutoAccept}
            uberEatsEnabled={uberEatsEnabled}
            setUberEatsEnabled={setUberEatsEnabled}
            uberEatsStoreStatus={uberEatsStoreStatus}
            setUberEatsStoreStatus={setUberEatsStoreStatus}
            uberEatsPrepTime={uberEatsPrepTime}
            uberEatsPublicUrl={uberEatsPublicUrl}
            setUberEatsPublicUrl={setUberEatsPublicUrl}
            setUberEatsPrepTime={setUberEatsPrepTime}
            deliverooStoreId={deliverooStoreId}
            setDeliverooStoreId={setDeliverooStoreId}
            deliverooBrandId={deliverooBrandId}
            setDeliverooBrandId={setDeliverooBrandId}
            deliverooSyncMenu={deliverooSyncMenu}
            setDeliverooSyncMenu={setDeliverooSyncMenu}
            deliverooAutoAccept={deliverooAutoAccept}
            setDeliverooAutoAccept={setDeliverooAutoAccept}
            deliverooEnabled={deliverooEnabled}
            setDeliverooEnabled={setDeliverooEnabled}
            deliverooStoreStatus={deliverooStoreStatus}
            setDeliverooStoreStatus={setDeliverooStoreStatus}
            deliverooPrepTime={deliverooPrepTime}
            deliverooPublicUrl={deliverooPublicUrl}
            setDeliverooPublicUrl={setDeliverooPublicUrl}
            setDeliverooPrepTime={setDeliverooPrepTime}
            isSyncingUberEats={isSyncingUberEats}
            isImportingUberEats={isImportingUberEats}
            isSyncingDeliveroo={isSyncingDeliveroo}
            isImportingDeliveroo={isImportingDeliveroo}
            isValidatingUberEats={isValidatingUberEats}
            isValidatingDeliveroo={isValidatingDeliveroo}
            setRemovingPlatform={setRemovingPlatform}
            handleSyncUberEatsMenu={handleSyncUberEatsMenu}
            handleImportUberEats={handleImportUberEats}
            handleSaveUberEats={handleSaveUberEats}
            handleSyncDeliverooMenu={handleSyncDeliverooMenu}
            handleImportDeliveroo={handleImportDeliveroo}
            handleSaveDeliveroo={handleSaveDeliveroo}
          />
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={removingPlatform !== null}
        onOpenChange={(open) => { if (!open) setRemovingPlatform(null) }}
        onConfirm={() => {
          if (removingPlatform === "uberEats") handleRemoveUberEats()
          else if (removingPlatform === "deliveroo") handleRemoveDeliveroo()
        }}
        title={
          removingPlatform === "uberEats"
            ? "Supprimer l'intégration Uber Eats"
            : "Supprimer l'intégration Deliveroo"
        }
        description={
          removingPlatform === "uberEats"
            ? "Cette action supprimera la connexion Uber Eats de cet établissement. Les commandes en cours ne seront pas affectées."
            : "Cette action supprimera la connexion Deliveroo de cet établissement. Les commandes en cours ne seront pas affectées."
        }
        isDeleting={isRemovingIntegration}
      />
    </div>
  )
}
