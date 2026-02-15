/**
 * Product Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  calculateProductPrice,
  isProductAvailable,
  isProductScheduledNow,
  filterProducts,
  sortProducts,
  formatPrice,
  getProductAllergens,
} from '../services/product'
import type { ProductDoc, CartSelectedOption } from '../types'

describe('Product Service', () => {
  describe('calculateProductPrice', () => {
    it('should calculate price with no options', () => {
      const price = calculateProductPrice(1000, [])
      expect(price).toBe(1000)
    })

    it('should calculate price with options', () => {
      const options: CartSelectedOption[] = [
        { name: 'Size', choice: 'Large', priceModifier: 200 },
        { name: 'Extra', choice: 'Cheese', priceModifier: 100 },
      ]

      const price = calculateProductPrice(1000, options)
      expect(price).toBe(1300)
    })
  })

  describe('isProductAvailable', () => {
    const baseProduct: ProductDoc = {
      _id: 'p1',
      _creationTime: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      storeId: 's1',
      categoryId: 'c1',
      name: 'Burger',
      slug: 'burger',
      price: 1000,
      taxRate: 20,
      images: [],
      options: [],
      allergens: [],
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      source: 'manual',
    }

    it('should return true for available product', () => {
      expect(isProductAvailable(baseProduct)).toBe(true)
    })

    it('should return false for inactive product', () => {
      const product = { ...baseProduct, isActive: false }
      expect(isProductAvailable(product)).toBe(false)
    })

    it('should return false for out of stock product', () => {
      const product = {
        ...baseProduct,
        stock: { tracked: true, quantity: 0, lowStockThreshold: 5 },
      }
      expect(isProductAvailable(product)).toBe(false)
    })

    it('should return true for tracked in-stock product', () => {
      const product = {
        ...baseProduct,
        stock: { tracked: true, quantity: 10, lowStockThreshold: 5 },
      }
      expect(isProductAvailable(product)).toBe(true)
    })
  })

  describe('isProductScheduledNow', () => {
    const baseProduct: ProductDoc = {
      _id: 'p1',
      _creationTime: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      storeId: 's1',
      categoryId: 'c1',
      name: 'Burger',
      slug: 'burger',
      price: 1000,
      taxRate: 20,
      images: [],
      options: [],
      allergens: [],
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      source: 'manual',
    }

    it('should return true when no scheduling', () => {
      expect(isProductScheduledNow(baseProduct)).toBe(true)
    })

    it('should return true when within time range', () => {
      const product = {
        ...baseProduct,
        scheduling: {
          availableFrom: '09:00',
          availableUntil: '18:00',
        },
      }

      // Test at 12:00
      const testDate = new Date()
      testDate.setHours(12, 0, 0, 0)

      expect(isProductScheduledNow(product, testDate)).toBe(true)
    })

    it('should return false when outside time range', () => {
      const product = {
        ...baseProduct,
        scheduling: {
          availableFrom: '09:00',
          availableUntil: '18:00',
        },
      }

      // Test at 20:00
      const testDate = new Date()
      testDate.setHours(20, 0, 0, 0)

      expect(isProductScheduledNow(product, testDate)).toBe(false)
    })

    it('should return true when day is allowed', () => {
      const product = {
        ...baseProduct,
        scheduling: {
          availableDays: [1, 2, 3, 4, 5], // Monday to Friday
        },
      }

      // Test on Monday (day 1)
      const monday = new Date('2024-01-01T12:00:00') // 2024-01-01 is a Monday

      expect(isProductScheduledNow(product, monday)).toBe(true)
    })

    it('should return false when day is not allowed', () => {
      const product = {
        ...baseProduct,
        scheduling: {
          availableDays: [1, 2, 3, 4, 5], // Monday to Friday
        },
      }

      // Test on Sunday (day 0)
      const sunday = new Date('2024-01-07T12:00:00') // 2024-01-07 is a Sunday

      expect(isProductScheduledNow(product, sunday)).toBe(false)
    })
  })

  describe('filterProducts', () => {
    const products: ProductDoc[] = [
      {
        _id: 'p1',
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storeId: 's1',
        categoryId: 'c1',
        name: 'Burger',
        slug: 'burger',
        price: 1000,
        taxRate: 20,
        images: [],
        options: [],
        allergens: ['gluten'],
        tags: ['fast-food'],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
        source: 'manual',
      },
      {
        _id: 'p2',
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storeId: 's1',
        categoryId: 'c2',
        name: 'Salad',
        slug: 'salad',
        price: 800,
        taxRate: 20,
        images: [],
        options: [],
        allergens: [],
        tags: ['healthy'],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
        source: 'manual',
      },
    ]

    it('should filter by category', () => {
      const filtered = filterProducts(products, { categoryId: 'c1' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Burger')
    })

    it('should filter by search query', () => {
      const filtered = filterProducts(products, { search: 'salad' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Salad')
    })

    it('should filter by allergens', () => {
      const filtered = filterProducts(products, { allergens: ['gluten'] })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Salad')
    })

    it('should filter by price range', () => {
      const filtered = filterProducts(products, { minPrice: 900 })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Burger')
    })
  })

  describe('sortProducts', () => {
    const products: ProductDoc[] = [
      {
        _id: 'p1',
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storeId: 's1',
        categoryId: 'c1',
        name: 'Burger',
        slug: 'burger',
        price: 1000,
        taxRate: 20,
        images: [],
        options: [],
        allergens: [],
        tags: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 1,
        source: 'manual',
      },
      {
        _id: 'p2',
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storeId: 's1',
        categoryId: 'c1',
        name: 'Salad',
        slug: 'salad',
        price: 800,
        taxRate: 20,
        images: [],
        options: [],
        allergens: [],
        tags: [],
        isActive: true,
        isFeatured: true,
        sortOrder: 0,
        source: 'manual',
      },
    ]

    it('should sort by name', () => {
      const sorted = sortProducts(products, 'name')
      expect(sorted[0].name).toBe('Burger')
      expect(sorted[1].name).toBe('Salad')
    })

    it('should sort by price', () => {
      const sorted = sortProducts(products, 'price')
      expect(sorted[0].price).toBe(800)
      expect(sorted[1].price).toBe(1000)
    })

    it('should sort by popular (featured first)', () => {
      const sorted = sortProducts(products, 'popular')
      expect(sorted[0].isFeatured).toBe(true)
      expect(sorted[1].isFeatured).toBe(false)
    })
  })

  describe('formatPrice', () => {
    it('should format price in EUR', () => {
      const formatted = formatPrice(1000, 'EUR', 'fr-FR')
      expect(formatted).toContain('10')
      expect(formatted).toContain('€')
    })

    it('should format price in USD', () => {
      const formatted = formatPrice(1000, 'USD', 'en-US')
      expect(formatted).toContain('10')
    })
  })

  describe('getProductAllergens', () => {
    it('should return allergens list', () => {
      const product: ProductDoc = {
        _id: 'p1',
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storeId: 's1',
        categoryId: 'c1',
        name: 'Burger',
        slug: 'burger',
        price: 1000,
        taxRate: 20,
        images: [],
        options: [],
        allergens: ['gluten', 'dairy'],
        tags: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
        source: 'manual',
      }

      const allergens = getProductAllergens(product)
      expect(allergens).toEqual(['gluten', 'dairy'])
    })
  })
})
