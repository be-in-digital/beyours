/**
 * Admin API Store - Zustand
 *
 * Injects the app-generated Convex API object into the admin package.
 * The app initializes this store once in the admin layout, then all
 * package components read the API from here instead of importing
 * `@/convex/_generated/api` directly.
 *
 * It used to carry a `storeId` too, copied here by an effect in `StoreGuard`.
 * A copy is always a frame behind its source: on the render where the guard
 * first lets a page through, the page read the not-yet-written mirror and
 * announced "Veuillez sélectionner un établissement" before correcting itself.
 * The selection now lives in one place, `useAdminStoreSelection`, and is read
 * directly.
 */

import { create } from "zustand"

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AdminApiState {
  api: any
  setApi: (api: any) => void
}

export const useAdminApiStore = create<AdminApiState>((set) => ({
  api: null,
  setApi: (api) => set({ api }),
}))
