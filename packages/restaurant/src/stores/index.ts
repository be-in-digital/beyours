/**
 * Zustand Stores - Barrel Export
 */

export { useCartStore } from './cart'
/**
 * The persisted cart's schema version.
 *
 * Public because the e2e specs seed a cart straight into `localStorage` and have
 * to seed it at the CURRENT version. `migrateCartState` recomputes every
 * `lineId` when it runs, so a spec that seeded an older version had its own
 * hand-written ids replaced and its `[data-line-id]` selectors found nothing —
 * which is how the bump to 2 was caught.
 */
export { CART_STORAGE_VERSION } from './cart'
export {
  useAdminStoreSelection,
  useStorefrontStoreSelection,
  ADMIN_SELECTION_KEY,
  STOREFRONT_SELECTION_KEY,
} from './store'
export { useUIStore } from './ui'
export { useLanguageStore, buildTranslator } from './language'

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
  TranslatableState,
} from './language'
