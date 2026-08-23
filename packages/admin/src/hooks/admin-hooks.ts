"use client"

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import {
  useAdminStoreSelection,
  type StoreDoc,
} from "@be-in-digital/restaurant"
import { useAdminApiStore } from "../stores/admin-api-store"

/**
 * The establishment currently being administered.
 *
 * Reads the selection itself rather than a copy of it, so it is correct on the
 * very render where `StoreGuard` first lets a page through.
 */
export function useAdminStoreId(): string | null {
  return useAdminStoreSelection((state) => state.storeId)
}

/**
 * Changes the establishment being administered.
 */
export function useSelectAdminStore(): (storeId: string | null) => void {
  return useAdminStoreSelection((state) => state.setStoreId)
}

/**
 * The full document of the establishment being administered, as the server has
 * it right now.
 *
 * Only the id is persisted, so a renamed store or new opening hours are right
 * here on the next render. Convex de-duplicates the `stores.list` subscription
 * across components, so calling this from several places costs one query.
 */
export function useAdminStore(): StoreDoc | null {
  const storeId = useAdminStoreId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected dynamically at runtime
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query ref is dynamic
  const stores = useQuery(api?.stores?.list ?? ("skip" as any)) as StoreDoc[] | undefined

  if (!storeId || !stores) return null
  return stores.find((store) => store._id === storeId) ?? null
}

/**
 * Hook to get the injected Convex API object
 */
export function useAdminApi() {
  return useAdminApiStore((state) => state.api)
}

/**
 * Hook to debounce a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
