/**
 * Cart Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateCartItem,
  mergeCartItems,
  calculateCartTotals,
  canCheckout,
} from '../services/cart'
import type { CartItem } from '../types'

describe('Cart Service', () => {
  describe('validateCartItem', () => {
    it('should validate valid item', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      const result = validateCartItem(item)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject item with missing productId', () => {
      const item: CartItem = {
        productId: '',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [],
      }

      const result = validateCartItem(item)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Product ID is required')
    })

    it('should reject item with negative price', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: -100,
        quantity: 1,
        options: [],
      }

      const result = validateCartItem(item)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Price must be positive')
    })

    it('should reject item with zero quantity', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 0,
        options: [],
      }

      const result = validateCartItem(item)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Quantity must be greater than 0')
    })

    it('should reject item with invalid options', () => {
      const item: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [{ name: '', choice: 'Large', priceModifier: 200 }],
      }

      const result = validateCartItem(item)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('mergeCartItems', () => {
    it('should merge items with same product and options', () => {
      const existing: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 1,
          options: [],
        },
      ]

      const newItem: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 2,
        options: [],
      }

      const merged = mergeCartItems(existing, newItem)
      expect(merged).toHaveLength(1)
      expect(merged[0].quantity).toBe(3)
    })

    it('should not merge items with different options', () => {
      const existing: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 1,
          options: [{ name: 'Size', choice: 'Small', priceModifier: 0 }],
        },
      ]

      const newItem: CartItem = {
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 1,
        options: [{ name: 'Size', choice: 'Large', priceModifier: 200 }],
      }

      const merged = mergeCartItems(existing, newItem)
      expect(merged).toHaveLength(2)
    })

    it('should add new item when product does not exist', () => {
      const existing: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 1,
          options: [],
        },
      ]

      const newItem: CartItem = {
        productId: 'p2',
        name: 'Fries',
        price: 500,
        quantity: 1,
        options: [],
      }

      const merged = mergeCartItems(existing, newItem)
      expect(merged).toHaveLength(2)
    })
  })

  describe('calculateCartTotals', () => {
    it('should calculate totals correctly', () => {
      const items: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 2,
          options: [],
        },
        {
          productId: 'p2',
          name: 'Fries',
          price: 500,
          quantity: 1,
          options: [{ name: 'Size', choice: 'Large', priceModifier: 200 }],
        },
      ]

      const totals = calculateCartTotals(items, 20, 500)

      expect(totals.subtotal).toBe(2700) // (1000 * 2) + (500 + 200)
      expect(totals.tax).toBe(540) // 20% of 2700
      expect(totals.deliveryFee).toBe(500)
      expect(totals.total).toBe(3740) // 2700 + 540 + 500
      expect(totals.itemCount).toBe(3)
    })
  })

  describe('canCheckout', () => {
    it('should allow checkout with valid cart', () => {
      const items: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 1,
          options: [],
        },
      ]

      const result = canCheckout(items, 'store1')
      expect(result.eligible).toBe(true)
    })

    it('should reject checkout without store ID', () => {
      const items: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 1,
          options: [],
        },
      ]

      const result = canCheckout(items, null)
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('No store selected')
    })

    it('should reject checkout with empty cart', () => {
      const result = canCheckout([], 'store1')
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('Cart is empty')
    })

    it('should reject checkout with invalid items', () => {
      const items: CartItem[] = [
        {
          productId: '',
          name: 'Burger',
          price: 1000,
          quantity: 1,
          options: [],
        },
      ]

      const result = canCheckout(items, 'store1')
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('Invalid item')
    })
  })
})
