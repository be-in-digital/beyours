/**
 * Cart Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateCartItem,
  mergeCartItems,
  calculateCartTotals,
  canCheckout,
  cartLineId,
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

/**
 * A *formule* line (#352).
 *
 * The cart had no way to hold one: `CartItem` was a flat `{ productId, name,
 * price, quantity, options[] }`, so a fixed-price bundle with chosen dishes
 * inside it had nowhere to go. `productId` is optional now, and exactly one of
 * it and `menu` is set on any line.
 */
describe('a formule in the cart', () => {
  const formuleLine = (choices: Array<{ sectionId: string; productId: string; quantity?: number }>) => ({
    menu: {
      menuId: 'm1',
      choices: choices.map((choice) => ({
        sectionId: choice.sectionId,
        sectionLabel: choice.sectionId === 's1' ? 'Plat' : 'Dessert',
        productId: choice.productId,
        productName: choice.productId,
        quantity: choice.quantity ?? 1,
      })),
    },
    name: 'Formule Midi',
    price: 1_800,
    quantity: 1,
    options: [],
  })

  it('keeps two differently-composed formules apart', () => {
    // THE DEFECT THIS PREVENTS. Keyed on the menu id alone these would be one
    // line, so "+" on either would raise both and the kitchen would receive two
    // of whichever was added first — the same bug `cartLineId` was written to fix
    // for products with options, one level up.
    const risotto = cartLineId(formuleLine([{ sectionId: 's1', productId: 'risotto' }]))
    const burrata = cartLineId(formuleLine([{ sectionId: 's1', productId: 'burrata' }]))
    expect(risotto).not.toBe(burrata)
  })

  it('treats the same composition as the same line', () => {
    expect(cartLineId(formuleLine([{ sectionId: 's1', productId: 'risotto' }]))).toBe(
      cartLineId(formuleLine([{ sectionId: 's1', productId: 'risotto' }]))
    )
  })

  it('does not depend on the order the dialog collected the picks in', () => {
    const forwards = cartLineId(
      formuleLine([
        { sectionId: 's1', productId: 'risotto' },
        { sectionId: 's2', productId: 'tiramisu' },
      ])
    )
    const backwards = cartLineId(
      formuleLine([
        { sectionId: 's2', productId: 'tiramisu' },
        { sectionId: 's1', productId: 'risotto' },
      ])
    )
    expect(forwards).toBe(backwards)
  })

  it('counts the quantity of a repeated dish as part of the identity', () => {
    // Two of the same dessert is not the same line as one of it.
    const one = cartLineId(formuleLine([{ sectionId: 's2', productId: 'tiramisu', quantity: 1 }]))
    const two = cartLineId(formuleLine([{ sectionId: 's2', productId: 'tiramisu', quantity: 2 }]))
    expect(one).not.toBe(two)
  })

  it('never collides with a product line', () => {
    // A menu id and a product id are both opaque strings from the same generator.
    const formule = cartLineId(formuleLine([{ sectionId: 's1', productId: 'risotto' }]))
    const productLine = cartLineId({
      productId: 'm1',
      name: 'Risotto',
      price: 1_600,
      quantity: 1,
      options: [],
    })
    expect(formule).not.toBe(productLine)
  })

  it('accepts a valid formule line', () => {
    const result = validateCartItem({
      ...formuleLine([{ sectionId: 's1', productId: 'risotto' }]),
      lineId: 'x',
    })
    expect(result.valid).toBe(true)
  })

  it('refuses a line that is both a product and a formule', () => {
    // It would be priced twice.
    const result = validateCartItem({
      ...formuleLine([{ sectionId: 's1', productId: 'risotto' }]),
      productId: 'p1',
      lineId: 'x',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('A line cannot be both a product and a menu')
  })

  it('refuses a formule line with no choices', () => {
    const result = validateCartItem({
      ...formuleLine([]),
      lineId: 'x',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('A menu line must carry its choices')
  })

  it('still refuses a product line with no product', () => {
    const result = validateCartItem({
      name: 'Risotto',
      price: 1_600,
      quantity: 1,
      options: [],
      lineId: 'x',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Product ID is required')
  })
})
