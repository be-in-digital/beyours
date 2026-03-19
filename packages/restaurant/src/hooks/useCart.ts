/**
 * useCart Hook
 *
 * Convenience hooks for cart store
 */

'use client'

import { useShallow } from 'zustand/react/shallow'
import { useCartStore } from '../stores/cart'
import type { CartSummary } from '../types'

/**
 * Get entire cart store
 */
export const useCart = () => useCartStore()

/**
 * Get cart items only
 */
export const useCartItems = () => useCartStore((state) => state.items)

/**
 * Get cart summary with calculated totals
 */
export const useCartSummary = (taxRate: number, deliveryFee: number): CartSummary => {
  return useCartStore(
    useShallow((state) => state.getSummary(taxRate, deliveryFee))
  )
}

/**
 * Get total item count in cart
 */
export const useCartItemCount = () => useCartStore((state) => state.getItemCount())

/**
 * Get cart order type
 */
export const useCartOrderType = () => useCartStore((state) => state.orderType)

/**
 * Get cart store ID
 */
export const useCartStoreId = () => useCartStore((state) => state.storeId)
