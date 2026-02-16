/**
 * Admin API Store - Zustand
 *
 * Injects the app-generated Convex API object into the admin package.
 * The app initializes this store once in the admin layout, then all
 * package components read the API from here instead of importing
 * `@/convex/_generated/api` directly.
 */

import { create } from "zustand"

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AdminApiState {
  api: any
  storeId: string | null
  setApi: (api: any) => void
  setStoreId: (storeId: string | null) => void
}

export const useAdminApiStore = create<AdminApiState>((set) => ({
  api: null,
  storeId: null,
  setApi: (api) => set({ api }),
  setStoreId: (storeId) => set({ storeId }),
}))
