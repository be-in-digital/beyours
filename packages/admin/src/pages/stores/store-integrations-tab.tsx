"use client"

import type { Dispatch, SetStateAction } from "react"
import type { StoreIntegration } from "./store-detail-types"
import { StoreUberEatsCard } from "./store-uber-eats-card"
import { StoreDeliverooCard } from "./store-deliveroo-card"

interface StoreIntegrationsTabProps {
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
