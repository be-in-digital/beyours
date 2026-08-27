/**
 * Store selection - Zustand
 *
 * Which establishment is active, and nothing else.
 *
 * Two zones, two selections. An owner administering "Lyon" in one tab and a
 * visitor browsing "Paris" in another are answering different questions; under
 * the single `beindigital-store` key they used to overwrite each other's
 * answer, so a visitor's geolocation could silently move the dashboard.
 *
 * Only the id is persisted. The document is read from Convex by whoever needs
 * it, which is what makes a rename or a change of opening hours show up on the
 * next render instead of staying frozen in localStorage until the browser is
 * cleared.
 */

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

/**
 * Selection state
 */
export interface StoreSelectionState {
  storeId: string | null
}

/**
 * Selection actions
 */
export interface StoreSelectionActions {
  setStoreId: (storeId: string | null) => void
}

/**
 * Selection store type
 */
export type StoreSelection = StoreSelectionState & StoreSelectionActions

/** localStorage key used before admin and storefront were split apart. */
const LEGACY_KEY = 'beindigital-store'

export const ADMIN_SELECTION_KEY = 'beyours-admin-store'
export const STOREFRONT_SELECTION_KEY = 'beyours-storefront-store'

/**
 * Reads the id out of the pre-split payload, which persisted the whole store
 * document. Returning it keeps an existing selection alive across the upgrade
 * rather than silently resetting every browser to the first store.
 */
function readLegacyStoreId(): string | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      state?: { currentStore?: { _id?: unknown } }
    }
    const id = parsed.state?.currentStore?._id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

const selectionStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    const own = window.localStorage.getItem(name)
    if (own !== null) return own

    const legacy = readLegacyStoreId()
    if (!legacy) return null
    return JSON.stringify({ state: { storeId: legacy }, version: 0 })
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

function createSelectionStore(name: string) {
  return create<StoreSelection>()(
    persist(
      (set) => ({
        storeId: null,
        setStoreId: (storeId) => {
          set({ storeId })
        },
      }),
      {
        name,
        storage: createJSONStorage(() => selectionStorage),
      }
    )
  )
}

/**
 * The establishment being administered. Written by the admin store guard and
 * selector; read by every admin page.
 */
export const useAdminStoreSelection = createSelectionStore(ADMIN_SELECTION_KEY)

/**
 * The establishment being browsed. Written by the storefront resolver and the
 * customer-facing selector; read by the menu, cart and checkout.
 */
export const useStorefrontStoreSelection = createSelectionStore(
  STOREFRONT_SELECTION_KEY
)
