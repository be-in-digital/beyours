"use client"

import { useQuery } from "convex/react"
import { useStoreStore, type StoreDoc } from "@beindigital-engine/restaurant"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@beindigital-engine/ui"
import { toast } from "sonner"
import { useAdminApiStore } from "../stores/admin-api-store"

/**
 * Compact store selector dropdown for sidebar
 */
export function StoreSelector() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected dynamically at runtime
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  // Use adminList (auth-protected) so users only see stores they have access to
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query ref is dynamic
  const stores = useQuery(api?.stores?.adminList ?? ("skip" as any)) as StoreDoc[] | undefined
  const currentStore = useStoreStore((state) => state.currentStore)
  const setCurrentStore = useStoreStore((state) => state.setCurrentStore)

  if (stores === undefined) {
    return <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
  }

  if (!stores || stores.length === 0) return null

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
