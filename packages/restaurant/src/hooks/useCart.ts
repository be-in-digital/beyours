/**
 * useCart Hook
 *
 * Convenience hook for the cart store.
 *
 * WHAT WAS HERE. Five more selector wrappers — `useCartItems`,
 * `useCartSummary`, `useCartItemCount`, `useCartOrderType` and
 * `useCartStoreId` — compiled into `@be-yours/restaurant`'s `dist` and
 * published on both the root and the `./hooks` subpath. Not one of them had a
 * single reference anywhere in the repository, in either app, in any package or
 * in any test. The storefront reaches for `useCartStore` with an inline
 * selector instead (~60 call sites), which is the ordinary Zustand idiom and
 * the reason the wrappers never got used.
 *
 * `useCart` stays: it is what `packages/mcp-server`'s registry tells a client
 * developer to import, so removing it would break a documented instruction
 * rather than an unused export.
 */

'use client'

import { useCartStore } from '../stores/cart'

/**
 * Get entire cart store
 */
export const useCart = () => useCartStore()
