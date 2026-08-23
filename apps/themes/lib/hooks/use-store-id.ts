"use client"

import { useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  useStorefrontStoreSelection,
  useCartStore,
  useNearestStore,
  type StoreDoc,
} from "@be-in-digital/restaurant"

/**
 * Hook: useStoreId
 *
 * Resolves the store the visitor is browsing:
 *   persisted selection > nearest store (geolocation) > first store
 *
 * The selection is an id, and the document comes back from Convex, so a
 * renamed store or a change of opening hours reaches the visitor on the next
 * render. Storing the whole document meant it stayed frozen in localStorage.
 *
 * Geolocation is only requested when it can decide something: several stores,
 * and none chosen yet. It used to be asked for on every page load, including
 * single-location restaurants.
 */
export function useStoreId(): {
  storeId: string | null
  store: StoreDoc | null
  isLoading: boolean
} {
  const storeId = useStorefrontStoreSelection((s) => s.storeId)
  const setStoreId = useStorefrontStoreSelection((s) => s.setStoreId)
  const cartStoreId = useCartStore((s) => s.storeId)
  const setCartStoreId = useCartStore((s) => s.setStoreId)

  const stores = useQuery(api.stores.list)

  const store = (stores as StoreDoc[] | undefined)?.find((s) => s._id === storeId) ?? null
  const needsResolution = !!stores && !store

  const { nearestStore } = useNearestStore(stores ?? [], {
    autoLocate: needsResolution && (stores?.length ?? 0) > 1,
  })

  useEffect(() => {
    if (!stores) return // still loading

    if (store) {
      // Sync cart storeId with store selection
      if (cartStoreId !== store._id) {
        setCartStoreId(store._id)
      }
      return
    }

    // Nothing selected, or a selection that no longer exists. `nearestStore` is
    // the closest one when the visitor shared their position and simply the
    // first otherwise.
    const next = nearestStore ?? stores[0]
    if (next) {
      setStoreId(next._id)
      setCartStoreId(next._id)
    }
  }, [stores, store, cartStoreId, nearestStore, setStoreId, setCartStoreId])

  return {
    storeId: store?._id ?? null,
    store,
    isLoading: stores === undefined,
  }
}
