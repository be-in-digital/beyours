"use client"

import { SettingsIcon, Clock, Truck, Plug2, CreditCard, ReceiptText } from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { useSettingsForm } from "./use-settings-form"
import { GeneralTab } from "./general-tab"
import { BillingTab } from "./billing-tab"
import { HoursTab } from "./hours-tab"
import { DeliveryTab } from "./delivery-tab"
import { PaymentsTab } from "./payments-tab"
import { IntegrationsTab } from "./integrations-tab"

export function SettingsPage() {
  const {
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
    // Billing identity
    sellerForm,
    setSellerForm,
    handleSaveBilling,
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
    cardEnabled,
    setCardEnabled,
    setCardProvider,
    stripeConnection,
    sumupConnection,
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
  } = useSettingsForm()

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
        defaultValue={(() => {
          const requested =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("tab")
              : null
          return requested === "payments" || requested === "billing"
            ? requested
            : "general"
        })()}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="general">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Général
          </TabsTrigger>
          <TabsTrigger value="billing">
            <ReceiptText className="h-4 w-4 mr-2" />
            Facturation
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
          <GeneralTab
            currency={currency}
            setCurrency={setCurrency}
            timezone={timezone}
            setTimezone={setTimezone}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            minimumOrder={minimumOrder}
            setMinimumOrder={setMinimumOrder}
            dineIn={dineIn}
            setDineIn={setDineIn}
            takeaway={takeaway}
            setTakeaway={setTakeaway}
            delivery={delivery}
            setDelivery={setDelivery}
            clickAndCollect={clickAndCollect}
            setClickAndCollect={setClickAndCollect}
            handleSaveGeneral={handleSaveGeneral}
          />
        </TabsContent>

        {/* Billing identity Tab (#375) */}
        <TabsContent value="billing" className="space-y-4">
          <BillingTab
            sellerForm={sellerForm}
            setSellerForm={setSellerForm}
            handleSaveBilling={handleSaveBilling}
          />
        </TabsContent>

        {/* Hours Tab */}
        <TabsContent value="hours" className="space-y-4">
          <HoursTab
            hours={hours}
            updateHour={updateHour}
            applyWeekdayHours={applyWeekdayHours}
            applyAllDaysHours={applyAllDaysHours}
            handleSaveHours={handleSaveHours}
          />
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-4">
          <DeliveryTab
            feeMode={feeMode}
            setFeeMode={setFeeMode}
            deliveryRadius={deliveryRadius}
            setDeliveryRadius={setDeliveryRadius}
            freeAbove={freeAbove}
            setFreeAbove={setFreeAbove}
            deliveryFee={deliveryFee}
            setDeliveryFee={setDeliveryFee}
            deliveryPercentage={deliveryPercentage}
            setDeliveryPercentage={setDeliveryPercentage}
            deliveryMaxFee={deliveryMaxFee}
            setDeliveryMaxFee={setDeliveryMaxFee}
            handleSaveDelivery={handleSaveDelivery}
            uberDirectEnabled={uberDirectEnabled}
            simulatorAddress={simulatorAddress}
            setSimulatorAddress={setSimulatorAddress}
            handleSimulate={handleSimulate}
            isSimulating={isSimulating}
            simulationResult={simulationResult}
            setSimulationResult={setSimulationResult}
          />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <PaymentsTab
            cardProvider={cardProvider}
            cardEnabled={cardEnabled}
            setCardEnabled={setCardEnabled}
            setCardProvider={setCardProvider}
            stripeConnection={stripeConnection}
            sumupConnection={sumupConnection}
            connectingProvider={connectingProvider}
            handleConnect={handleConnect}
            handleDisconnect={handleDisconnect}
            paypalEnabled={paypalEnabled}
            setPaypalEnabled={setPaypalEnabled}
            paypalEmail={paypalEmail}
            setPaypalEmail={setPaypalEmail}
            cashEnabled={cashEnabled}
            setCashEnabled={setCashEnabled}
            handleSavePayments={handleSavePayments}
          />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <IntegrationsTab
            uberDirectEnabled={uberDirectEnabled}
            setUberDirectEnabled={setUberDirectEnabled}
            uberDirectCustomerId={uberDirectCustomerId}
            setUberDirectCustomerId={setUberDirectCustomerId}
            uberDirectClientId={uberDirectClientId}
            setUberDirectClientId={setUberDirectClientId}
            uberDirectClientSecret={uberDirectClientSecret}
            setUberDirectClientSecret={setUberDirectClientSecret}
            uberEatsEnabled={uberEatsEnabled}
            setUberEatsEnabled={setUberEatsEnabled}
            uberEatsPriceMarkup={uberEatsPriceMarkup}
            setUberEatsPriceMarkup={setUberEatsPriceMarkup}
            deliverooEnabled={deliverooEnabled}
            setDeliverooEnabled={setDeliverooEnabled}
            deliverooPriceMarkup={deliverooPriceMarkup}
            setDeliverooPriceMarkup={setDeliverooPriceMarkup}
            handleSaveIntegrations={handleSaveIntegrations}
            isValidatingIntegrations={isValidatingIntegrations}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
