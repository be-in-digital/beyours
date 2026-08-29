/**
 * Cart Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, migrateCartState, CART_STORAGE_VERSION } from '../stores/cart'
import type { NewCartItem } from '../types'

describe('Cart Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useCartStore.getState().clearCart()
  })

  describe('addItem', () => {
    it('should add new item to cart', () => {
      const item: NewCartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      useCartStore.getState().addItem(item)

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(1)
      // The store adds the one field a caller does not supply: the line's own
      // identity.
      expect(state.items[0]).toEqual({ ...item, lineId: 'p1' })
    })

    it('should increment quantity for same item', () => {
      const item: NewCartItem = {
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
      const item1: NewCartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [{ name: 'Size', choice: 'Large', priceModifier: 200 }],
      }

      const item2: NewCartItem = {
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
      const item: NewCartItem = {
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
      const item: NewCartItem = {
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
      const item: NewCartItem = {
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

  /**
   * The bug this store was rewritten for.
   *
   * One pizza with extra cheese and one plain are two lines. Keyed on the
   * product id, "+" on the second raised both and the total silently doubled
   * before checkout; the bin on either emptied both.
   */
  describe('two configurations of one dish', () => {
    const withCheese: NewCartItem = {
      productId: 'p1',
      name: 'Pizza',
      price: 1200,
      quantity: 1,
      options: [{ name: 'Supplément', choice: 'Extra fromage', priceModifier: 150 }],
    }

    const plain: NewCartItem = {
      productId: 'p1',
      name: 'Pizza',
      price: 1200,
      quantity: 1,
      options: [],
    }

    beforeEach(() => {
      useCartStore.getState().addItem(withCheese)
      useCartStore.getState().addItem(plain)
    })

    it('keeps them as two lines with distinct ids', () => {
      const { items } = useCartStore.getState()
      expect(items).toHaveLength(2)
      expect(items[0]!.lineId).not.toBe(items[1]!.lineId)
    })

    it('raises the quantity of one line only', () => {
      const { items } = useCartStore.getState()
      useCartStore.getState().updateQuantity(items[1]!.lineId, 2)

      const after = useCartStore.getState()
      expect(after.items.map((i) => i.quantity)).toEqual([1, 2])
      expect(after.getItemCount()).toBe(3)
    })

    it('removes one line and leaves the other', () => {
      const { items } = useCartStore.getState()
      useCartStore.getState().removeItem(items[0]!.lineId)

      const after = useCartStore.getState()
      expect(after.items).toHaveLength(1)
      expect(after.items[0]!.options).toEqual([])
    })

    it('merges a third add of an existing configuration', () => {
      useCartStore.getState().addItem(withCheese)

      const after = useCartStore.getState()
      expect(after.items).toHaveLength(2)
      expect(after.items[0]!.quantity).toBe(2)
    })

    it('does not split a line over the order the options were ticked in', () => {
      useCartStore.getState().clearCart()
      const twoOptions: NewCartItem = {
        ...withCheese,
        options: [
          { name: 'Taille', choice: 'Grande', priceModifier: 300 },
          { name: 'Supplément', choice: 'Extra fromage', priceModifier: 150 },
        ],
      }
      const sameReversed: NewCartItem = {
        ...twoOptions,
        options: [...twoOptions.options].reverse(),
      }

      useCartStore.getState().addItem(twoOptions)
      useCartStore.getState().addItem(sameReversed)

      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0]!.quantity).toBe(2)
    })
  })

  describe('clearCart', () => {
    it('should clear all items and reset state', () => {
      const item: NewCartItem = {
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
      const item1: NewCartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 2,
        options: [],
      }

      const item2: NewCartItem = {
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
      const item: NewCartItem = {
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
      const item: NewCartItem = {
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
      const item: NewCartItem = {
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
      const item1: NewCartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 2,
        options: [],
      }

      const item2: NewCartItem = {
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
      const item: NewCartItem = {
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

  /**
   * A cart written before this change is still in a customer's browser. Left
   * alone, every line would rehydrate with `lineId: undefined` — and undefined
   * matches every other line, which is the bug this replaces.
   */
  describe('a cart persisted by an older build', () => {
    const legacy = {
      orderType: 'pickup' as const,
      storeId: 'store_1',
      items: [
        {
          productId: 'p1',
          name: 'Pizza',
          price: 1200,
          quantity: 1,
          options: [{ name: 'Supplément', choice: 'Extra fromage', priceModifier: 150 }],
        },
        {
          productId: 'p1',
          name: 'Pizza',
          price: 1200,
          quantity: 1,
          options: [],
        },
      ],
    }

    it('gets an identity for every line on rehydration', () => {
      const migrated = migrateCartState(legacy, 0)

      const ids = migrated.items.map((i) => i.lineId)
      expect(ids.every(Boolean)).toBe(true)
      expect(new Set(ids).size).toBe(2)
    })

    it('leaves a cart already at the current version alone', () => {
      const current = migrateCartState(legacy, CART_STORAGE_VERSION)
      expect(current).toBe(legacy)
    })
  })
})
