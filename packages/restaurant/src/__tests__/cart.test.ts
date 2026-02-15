/**
 * Cart Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '../stores/cart'
import type { CartItem } from '../types'

describe('Cart Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useCartStore.getState().clearCart()
  })

  describe('addItem', () => {
    it('should add new item to cart', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]).toEqual(item)
    })

    it('should increment quantity for same item', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().addItem(item)

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0].quantity).toBe(2)
    })

    it('should add separate items for same product with different options', () => {
      const item1: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [{ name: 'Size', choice: 'Large', priceModifier: 200 }],
      }

      const item2: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [{ name: 'Size', choice: 'Small', priceModifier: 0 }],
      }

      useCartStore.getState().addItem(item1)
      useCartStore.getState().addItem(item2)

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(2)
    })
  })

  describe('removeItem', () => {
    it('should remove item from cart', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().removeItem('p1')

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(0)
    })
  })

  describe('updateQuantity', () => {
    it('should update item quantity', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().updateQuantity('p1', 3)

      const state = useCartStore.getState()
      expect(state.items[0].quantity).toBe(3)
    })

    it('should remove item when quantity is 0', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().updateQuantity('p1', 0)

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(0)
    })
  })

  describe('clearCart', () => {
    it('should clear all items and reset state', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().setStoreId('store1')
      useCartStore.getState().setOrderType('delivery')

      useCartStore.getState().clearCart()

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(0)
      expect(state.storeId).toBeNull()
      expect(state.orderType).toBe('pickup')
    })
  })

  describe('setOrderType', () => {
    it('should set order type', () => {
      useCartStore.getState().setOrderType('delivery')
      expect(useCartStore.getState().orderType).toBe('delivery')
    })
  })

  describe('setStoreId', () => {
    it('should set store ID', () => {
      useCartStore.getState().setStoreId('store1')
      expect(useCartStore.getState().storeId).toBe('store1')
    })
  })

  describe('getSubtotal', () => {
    it('should calculate subtotal correctly', () => {
      const item1: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 2,
        options: [],
      }

      const item2: CartItem = {
        productId: 'p2',
        name: 'Fries',
        price: 500,
        quantity: 1,
        options: [{ name: 'Size', choice: 'Large', priceModifier: 200 }],
      }

      useCartStore.getState().addItem(item1)
      useCartStore.getState().addItem(item2)

      const subtotal = useCartStore.getState().getSubtotal()
      // (1000 * 2) + (500 + 200) = 2700
      expect(subtotal).toBe(2700)
    })
  })

  describe('getTax', () => {
    it('should calculate tax correctly', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)

      const tax = useCartStore.getState().getTax(20)
      expect(tax).toBe(200) // 20% of 1000
    })
  })

  describe('getDeliveryFee', () => {
    it('should return fee for delivery orders', () => {
      useCartStore.getState().setOrderType('delivery')
      const fee = useCartStore.getState().getDeliveryFee(500)
      expect(fee).toBe(500)
    })

    it('should return 0 for pickup orders', () => {
      useCartStore.getState().setOrderType('pickup')
      const fee = useCartStore.getState().getDeliveryFee(500)
      expect(fee).toBe(0)
    })
  })

  describe('getTotal', () => {
    it('should calculate total correctly for pickup', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().setOrderType('pickup')

      const total = useCartStore.getState().getTotal(20, 500)
      // subtotal: 1000, tax: 200, delivery: 0
      expect(total).toBe(1200)
    })

    it('should calculate total correctly for delivery', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().setOrderType('delivery')

      const total = useCartStore.getState().getTotal(20, 500)
      // subtotal: 1000, tax: 200, delivery: 500
      expect(total).toBe(1700)
    })
  })

  describe('getItemCount', () => {
    it('should return total item count', () => {
      const item1: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 2,
        options: [],
      }

      const item2: CartItem = {
        productId: 'p2',
        name: 'Fries',
        price: 500,
        quantity: 3,
        options: [],
      }

      useCartStore.getState().addItem(item1)
      useCartStore.getState().addItem(item2)

      const count = useCartStore.getState().getItemCount()
      expect(count).toBe(5)
    })
  })

  describe('getSummary', () => {
    it('should return complete cart summary', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 2,
        options: [],
      }

      useCartStore.getState().addItem(item)
      useCartStore.getState().setOrderType('delivery')

      const summary = useCartStore.getState().getSummary(20, 500)

      expect(summary).toEqual({
        subtotal: 2000,
        tax: 400,
        deliveryFee: 500,
        total: 2900,
        itemCount: 2,
      })
    })
  })
})
