"use client"

import { useState, useEffect } from "react"
import { useAdminApiStore } from "../stores/admin-api-store"

/**
 * Hook to get the current admin store ID from the Zustand store
 */
export function useAdminStoreId(): string | null {
  return useAdminApiStore((state) => state.storeId)
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
