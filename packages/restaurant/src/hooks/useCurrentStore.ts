/**
 * useCurrentStore Hook
 *
 * Convenience hooks for store selection
 */

'use client'

import { useMemo } from 'react'
import { useStoreStore } from '../stores/store'
import { isStoreOpen } from '../services/store'
import type { StoreHoursStatus } from '../types'

/**
 * Get current store
 */
export const useCurrentStore = () => useStoreStore((state) => state.currentStore)

/**
 * Get all stores
 */
export const useStores = () => useStoreStore((state) => state.stores)

/**
 * Get store hours status (open/closed)
 */
export const useStoreHours = (): StoreHoursStatus | null => {
  const currentStore = useStoreStore((state) => state.currentStore)

  return useMemo(() => {
    if (!currentStore || !currentStore.hours) {
      return null
    }

    return isStoreOpen(currentStore.hours)
  }, [currentStore])
}

/**
 * Check if current store is open
 */
export const useIsStoreOpen = (): boolean => {
  const hoursStatus = useStoreHours()
  return hoursStatus?.isOpen ?? false
}
