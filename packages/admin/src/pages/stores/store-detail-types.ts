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
  storeStatus?: "ONLINE" | "PAUSED" | "OFFLINE"
  prepTime?: number
  brandId?: string
  menuSyncStatus?: "idle" | "syncing" | "success" | "error"
  menuSyncError?: string
  lastMenuSyncAt?: number
}

export type { DayHours, StoreOverrides, StoreIntegration }
