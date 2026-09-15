"use client"

import type { Dispatch, SetStateAction } from "react"
import type { StoreIntegration } from "./store-detail-types"
import { StoreUberEatsCard } from "./store-uber-eats-card"
import { StoreDeliverooCard } from "./store-deliveroo-card"
import { OrphanProductsPanel } from "./orphan-products-panel"
import { WebhookFailuresPanel } from "./webhook-failures-panel"
import { UberEatsConnectionCard } from "./uber-eats-connection-card"

interface StoreIntegrationsTabProps {
  storeId: string | undefined
  storeIntegrations: StoreIntegration[] | undefined
  hasUberEatsGlobal: boolean | undefined
  hasDeliverooGlobal: boolean | undefined
  uberEatsStoreId: string
  setUberEatsStoreId: Dispatch<SetStateAction<string>>
  uberEatsSyncMenu: boolean
  setUberEatsSyncMenu: Dispatch<SetStateAction<boolean>>
  uberEatsAutoAccept: boolean
  setUberEatsAutoAccept: Dispatch<SetStateAction<boolean>>
  uberEatsEnabled: boolean
  setUberEatsEnabled: Dispatch<SetStateAction<boolean>>
  uberEatsStoreStatus: "ONLINE" | "PAUSED" | "OFFLINE"
  setUberEatsStoreStatus: Dispatch<SetStateAction<"ONLINE" | "PAUSED" | "OFFLINE">>
  uberEatsPrepTime: string
  uberEatsPublicUrl: string
  setUberEatsPublicUrl: Dispatch<SetStateAction<string>>
  setUberEatsPrepTime: Dispatch<SetStateAction<string>>
  deliverooStoreId: string
  setDeliverooStoreId: Dispatch<SetStateAction<string>>
  deliverooBrandId: string
  setDeliverooBrandId: Dispatch<SetStateAction<string>>
  deliverooSyncMenu: boolean
  setDeliverooSyncMenu: Dispatch<SetStateAction<boolean>>
  deliverooAutoAccept: boolean
  setDeliverooAutoAccept: Dispatch<SetStateAction<boolean>>
  deliverooEnabled: boolean
  setDeliverooEnabled: Dispatch<SetStateAction<boolean>>
  deliverooStoreStatus: "ONLINE" | "PAUSED" | "OFFLINE"
  setDeliverooStoreStatus: Dispatch<SetStateAction<"ONLINE" | "PAUSED" | "OFFLINE">>
  deliverooPrepTime: string
  deliverooPublicUrl: string
  setDeliverooPublicUrl: Dispatch<SetStateAction<string>>
  setDeliverooPrepTime: Dispatch<SetStateAction<string>>
  isSyncingUberEats: boolean
  isImportingUberEats: boolean
  isSyncingDeliveroo: boolean
  isImportingDeliveroo: boolean
  isValidatingUberEats: boolean
  isValidatingDeliveroo: boolean
  setRemovingPlatform: Dispatch<SetStateAction<"uberEats" | "deliveroo" | null>>
  handleSyncUberEatsMenu: () => Promise<void>
  handleImportUberEats: () => Promise<void>
  handleSaveUberEats: () => Promise<void>
  handleSyncDeliverooMenu: () => Promise<void>
  handleImportDeliveroo: () => Promise<void>
  handleSaveDeliveroo: () => Promise<void>
}

export function StoreIntegrationsTab({
  storeId,
  storeIntegrations,
  hasUberEatsGlobal,
  hasDeliverooGlobal,
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
  isSyncingUberEats,
  isImportingUberEats,
  isSyncingDeliveroo,
  isImportingDeliveroo,
  isValidatingUberEats,
  isValidatingDeliveroo,
  setRemovingPlatform,
  handleSyncUberEatsMenu,
  handleImportUberEats,
  handleSaveUberEats,
  handleSyncDeliverooMenu,
  handleImportDeliveroo,
  handleSaveDeliveroo,
}: StoreIntegrationsTabProps) {
  return (
    <>
      {/* Above the two platform cards: an import that left unmatched items is the
          first thing to resolve, and the cards are where the next import is
          launched from. */}
      <OrphanProductsPanel storeId={storeId} />

      {/* Above everything: a platform order that never reached the kitchen is
          the most urgent thing this tab can be carrying, and it is the one
          failure every other screen looks normal through. Deployment-wide, not
          per store — an entry whose reason is `unidentified_store` has no
          establishment by definition. */}
      <WebhookFailuresPanel />

      {/* The merchant account is one connection for the whole deployment, so it
          sits above the per-store cards rather than inside one of them. */}
      <UberEatsConnectionCard hasUberEatsGlobal={hasUberEatsGlobal} />

      <StoreUberEatsCard
        storeIntegrations={storeIntegrations}
        hasUberEatsGlobal={hasUberEatsGlobal}
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
        isSyncingUberEats={isSyncingUberEats}
        isImportingUberEats={isImportingUberEats}
        isValidatingUberEats={isValidatingUberEats}
        setRemovingPlatform={setRemovingPlatform}
        handleSyncUberEatsMenu={handleSyncUberEatsMenu}
        handleImportUberEats={handleImportUberEats}
        handleSaveUberEats={handleSaveUberEats}
      />

      <StoreDeliverooCard
        storeIntegrations={storeIntegrations}
        hasDeliverooGlobal={hasDeliverooGlobal}
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
        isSyncingDeliveroo={isSyncingDeliveroo}
        isImportingDeliveroo={isImportingDeliveroo}
        isValidatingDeliveroo={isValidatingDeliveroo}
        setRemovingPlatform={setRemovingPlatform}
        handleSyncDeliverooMenu={handleSyncDeliverooMenu}
        handleImportDeliveroo={handleImportDeliveroo}
        handleSaveDeliveroo={handleSaveDeliveroo}
      />
    </>
  )
}
