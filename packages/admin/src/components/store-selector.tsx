"use client"

import { useEffect } from "react"
import { useQuery } from "convex/react"
import { useAdminStoreSelection, type StoreDoc } from "@be-in-digital/restaurant"
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
  const stores = useQuery(api?.stores?.listAll ?? ("skip" as any)) as StoreDoc[] | undefined
  const storeId = useAdminStoreSelection((s) => s.storeId)
  const setStoreId = useAdminStoreSelection((s) => s.setStoreId)

  // Auto-select when only one store exists.
  //
  // This used to run in the render body, which React reports as "Cannot update
  // a component while rendering a different component" — a setState during
  // render, and the kind that can loop: the write changes the store this very
  // component subscribes to, which schedules another render, which writes
  // again. It survived only because the id comparison stopped the second pass.
  //
  // `StoreGuard` performs the same selection correctly, in an effect. This is
  // the same fix, kept here because `StoreGuard` bypasses itself on the stores,
  // settings and team routes — where the selector is still on screen.
  const singleStore = stores?.length === 1 ? stores[0] : null
  useEffect(() => {
    if (singleStore && storeId !== singleStore._id) {
      setStoreId(singleStore._id)
    }
  }, [singleStore, storeId, setStoreId])

  if (stores === undefined) {
    return <div className="h-8 rounded-md bg-muted/40 animate-pulse" />
  }

  if (!stores || stores.length === 0) return null

  // Single store: show name as label, no dropdown needed
  if (stores.length === 1) {
    return (
      <div className="h-8 flex items-center px-3 text-xs font-medium text-muted-foreground truncate">
        {stores[0]?.name}
      </div>
    )
  }

  const handleStoreChange = (nextId: string) => {
    const store = stores.find((s) => s._id === nextId)
    if (store) {
      setStoreId(store._id)
      toast.success(`Établissement : ${store.name}`)
    }
  }

  return (
    <Select
      value={storeId ?? undefined}
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
