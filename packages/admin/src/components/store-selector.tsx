"use client"

import { useQuery } from "convex/react"
import { useStoreStore, type StoreDoc } from "@be-in-digital/restaurant"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@be-in-digital/ui"
import { toast } from "sonner"
import { useAdminApiStore } from "../stores/admin-api-store"

/**
 * Compact store selector dropdown for sidebar.
 * Auto-selects the store when there is only one.
 * Hides the dropdown when a single store is selected.
 */
export function StoreSelector() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected dynamically at runtime
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query ref is dynamic
  const stores = useQuery(api?.stores?.list ?? ("skip" as any)) as StoreDoc[] | undefined
  const currentStore = useStoreStore((state) => state.currentStore)
  const setCurrentStore = useStoreStore((state) => state.setCurrentStore)

  // Auto-select when only one store exists
  const singleStore = stores?.length === 1 ? stores[0] : null
  if (singleStore && currentStore?._id !== singleStore._id) {
    setCurrentStore(singleStore)
  }

  if (stores === undefined) {
    return <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
  }

  if (!stores || stores.length === 0) return null

  // Single store: show name as label, no dropdown needed
  if (stores.length === 1) {
    return (
      <div className="h-8 flex items-center px-3 text-xs font-medium text-muted-foreground truncate">
        {stores[0].name}
      </div>
    )
  }

  const handleStoreChange = (storeId: string) => {
    const store = stores.find((s) => s._id === storeId)
    if (store) {
      setCurrentStore(store)
      toast.success(`Établissement : ${store.name}`)
    }
  }

  return (
    <Select
      value={currentStore?._id as string}
      onValueChange={handleStoreChange}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Choisir un établissement" />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store._id} value={store._id} className="text-xs">
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
