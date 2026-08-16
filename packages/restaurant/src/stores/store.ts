/**
 * Store Store - Zustand
 *
 * Client-side state management for store selection
 * Persisted to localStorage for store selection persistence
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StoreDoc } from '../types'

/**
 * Store state
 */
export interface StoreState {
  currentStore: StoreDoc | null
  stores: StoreDoc[]
}

/**
 * Store actions
 */
export interface StoreActions {
  setCurrentStore: (store: StoreDoc) => void
  setStores: (stores: StoreDoc[]) => void
  clearCurrentStore: () => void
}

/**
 * Store store type
 */
export type StoreStore = StoreState & StoreActions

/**
 * Store store with persistence for current store
 */
export const useStoreStore = create<StoreStore>()(
  persist(
    (set) => ({
      // Initial state
      currentStore: null,
      stores: [],

      // Actions
      setCurrentStore: (store) => {
        set({ currentStore: store })
      },

      setStores: (stores) => {
        set({ stores })
      },

      clearCurrentStore: () => {
        set({ currentStore: null })
      },
    }),
    {
      name: 'beindigital-store', // localStorage key
      partialize: (state) => ({ currentStore: state.currentStore }), // Only persist currentStore
    }
  )
)
