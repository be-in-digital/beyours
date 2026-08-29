/**
 * Cart Store - Zustand
 *
 * Client-side state management for shopping cart
 * Persisted to localStorage for cart persistence
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, CartSummary, NewCartItem, OrderType } from '../types'
import { cartLineId, getItemTotal } from '../services/cart'

/**
 * Cart store state
 */
export interface CartState {
  items: CartItem[]
  orderType: OrderType
  storeId: string | null
}

/**
 * Cart store actions
 */
export interface CartActions {
  addItem: (item: NewCartItem) => void
  /** Takes a line id, not a product id — see `CartItem.lineId`. */
  removeItem: (lineId: string) => void
  /** Takes a line id, not a product id — see `CartItem.lineId`. */
  updateQuantity: (lineId: string, quantity: number) => void
  clearCart: () => void
  setOrderType: (type: OrderType) => void
  setStoreId: (storeId: string) => void
  getSubtotal: () => number
  getTax: (rate: number) => number
  getDeliveryFee: (fee: number) => number
  getTotal: (taxRate: number, deliveryFee: number) => number
  getItemCount: () => number
  getSummary: (taxRate: number, deliveryFee: number) => CartSummary
}

/**
 * Cart store type
 */
export type CartStore = CartState & CartActions

/** Bumped when the persisted shape changes; see `migrateCartState`. */
export const CART_STORAGE_VERSION = 1

/**
 * Bring a cart written by an older build up to the current shape.
 *
 * A cart persisted before lines had an identity is still sitting in a
 * customer's browser. Rehydrating it untouched would leave every `lineId`
 * undefined — and undefined matches every other line, which is the exact bug
 * this replaces. The id is derived from the line's own contents, so it is
 * simply recomputed.
 */
export function migrateCartState(persisted: unknown, version: number): CartState {
  const state = persisted as CartState
  if (version >= CART_STORAGE_VERSION || !state?.items) return state
  return {
    ...state,
    items: state.items.map((item) => ({ ...item, lineId: cartLineId(item) })),
  }
}

/**
 * Cart store with persistence
 */
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      orderType: 'pickup',
      storeId: null,

      // Actions
      addItem: (newItem) => {
        // The line's identity is assigned here and nowhere else: a caller that
        // invented one could split a line that should merge.
        const lineId = cartLineId(newItem)

        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.lineId === lineId)

          if (existingIndex >= 0) {
            // Item exists, increment quantity
            const updatedItems = [...state.items]
            const existingItem = updatedItems[existingIndex]
            if (existingItem) {
              updatedItems[existingIndex] = {
                ...existingItem,
                quantity: existingItem.quantity + newItem.quantity,
              }
            }
            return { items: updatedItems }
          } else {
            // New item, add to cart
            return { items: [...state.items, { ...newItem, lineId }] }
          }
        })
      },

      removeItem: (lineId) => {
        set((state) => ({
          items: state.items.filter((item) => item.lineId !== lineId),
        }))
      },

      updateQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(lineId)
          return
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.lineId === lineId ? { ...item, quantity } : item
          ),
        }))
      },

      clearCart: () => {
        set({ items: [], orderType: 'pickup', storeId: null })
      },

      setOrderType: (type) => {
        set({ orderType: type })
      },

      setStoreId: (storeId) => {
        const currentStoreId = get().storeId
        if (currentStoreId && currentStoreId !== storeId) {
          // Store changed — clear cart to prevent cross-store items
          set({ items: [], orderType: 'pickup', storeId })
        } else {
          set({ storeId })
        }
      },

      // Computed getters
      getSubtotal: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + getItemTotal(item), 0)
      },

      getTax: (rate) => {
        const subtotal = get().getSubtotal()
        return Math.round(subtotal * (rate / 100))
      },

      getDeliveryFee: (fee) => {
        const { orderType } = get()
        return orderType === 'delivery' ? fee : 0
      },

      getTotal: (taxRate, deliveryFee) => {
        const subtotal = get().getSubtotal()
        const tax = get().getTax(taxRate)
        const delivery = get().getDeliveryFee(deliveryFee)
        return subtotal + tax + delivery
      },

      getItemCount: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getSummary: (taxRate, deliveryFee) => {
        const { items, orderType } = get()
        const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0)
        const tax = Math.round(subtotal * (taxRate / 100))
        const delivery = orderType === 'delivery' ? deliveryFee : 0
        const total = subtotal + tax + delivery
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
        return { subtotal, tax, deliveryFee: delivery, total, itemCount }
      },
    }),
    {
      name: 'beindigital-cart', // localStorage key
      // A cart written before lines had an identity is still sitting in a
      // customer's browser. Rehydrating it without one would leave every
      // `lineId` undefined, which matches every other line — the exact bug
      // this replaces. The id is derived, so it can simply be recomputed.
      version: CART_STORAGE_VERSION,
      migrate: migrateCartState,
    }
  )
)
