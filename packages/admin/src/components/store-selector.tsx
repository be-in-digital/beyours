"use client"

import { useQuery } from "convex/react"
import { useStoreStore } from "@beindigital-engine/restaurant"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@beindigital-engine/ui"
import { toast } from "sonner"
import { useAdminApiStore } from "../stores/admin-api-store"

/**
 * Compact store selector dropdown for sidebar
 */
export function StoreSelector() {
  const api = useAdminApiStore((s) => s.api) as Record<string, any> | null
  const stores = useQuery(api?.stores?.list ?? "skip" as any)
  const currentStore = useStoreStore((state) => state.currentStore)
  const setCurrentStore = useStoreStore((state) => state.setCurrentStore)

  if (stores === undefined) {
    return <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
  }

  if (!stores || stores.length === 0) return null

  const handleStoreChange = (storeId: string) => {
    const store = (stores as any[]).find((s) => s._id === storeId)
    if (store) {
      setCurrentStore(store)
      toast.success(`Établissement : ${store.name}`)
    }
  }

  return (
    <Select
      value={(currentStore as any)?._id as string}
      onValueChange={handleStoreChange}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Choisir un établissement" />
      </SelectTrigger>
      <SelectContent>
        {(stores as any[]).map((store) => (
          <SelectItem key={store._id} value={store._id} className="text-xs">
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
