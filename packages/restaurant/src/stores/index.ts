/**
 * Zustand Stores - Barrel Export
 */

export { useCartStore } from './cart'
export {
  useAdminStoreSelection,
  useStorefrontStoreSelection,
  ADMIN_SELECTION_KEY,
  STOREFRONT_SELECTION_KEY,
} from './store'
export { useUIStore } from './ui'
export { useLanguageStore } from './language'

// The state/action types must be public: without them a consumer writing
// `export const cart = useCartStore` gets TS4023/TS2742, the inferred type
// referencing names it cannot reach.
export type { CartState, CartActions, CartStore } from './cart'
export type {
  StoreSelectionState,
  StoreSelectionActions,
  StoreSelection,
} from './store'
export type { UIState, UIActions, UIStore } from './ui'
export type {
  Language,
  LanguageState,
  LanguageActions,
  LanguageStore,
} from './language'
