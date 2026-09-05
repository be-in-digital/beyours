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
  getResolvedProductAllergens,
  isSameAllergenFilter,
  productMayContainAllergen,
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

    it('should ignore an empty allergen filter entry', () => {
      const filtered = filterProducts(products, { allergens: ['', '  '] })
      expect(filtered).toHaveLength(2)
    })
  })

  /**
   * The exclusion filter is a safety control: a diner uses it to keep a dish
   * they cannot eat off their screen. Every case below used to come back as a
   * false negative — the dish was shown — because the comparison was a raw
   * string equality against `products.allergens`, which is free text.
   */
  describe('productMayContainAllergen', () => {
    const dish = (allergens: string[]): ProductDoc => ({
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
      allergens,
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      source: 'manual',
    })

    it.each([
      ['Gluten'],
      ['GLUTEN'],
      ['gluten'],
      ['blé'],
      ['Farine de blé'],
      ['Céréales contenant du gluten'],
      ['FROMENT'],
    ])('matches %s against a canonical gluten exclusion', (declared) => {
      expect(productMayContainAllergen(dish([declared]), ['gluten'])).toBe(true)
    })

    it('matches a French exclusion against a canonical declaration', () => {
      expect(productMayContainAllergen(dish(['dairy']), ['Lait'])).toBe(true)
    })

    it('does not match an allergen the dish does not carry', () => {
      expect(productMayContainAllergen(dish(['Œufs', 'Lait']), ['gluten'])).toBe(false)
    })

    it('does not match when the dish declares nothing', () => {
      expect(productMayContainAllergen(dish([]), ['gluten'])).toBe(false)
    })

    // The decision documented on the function: an unrecognised declaration is
    // not proof of absence, so the dish is hidden rather than served to
    // somebody who asked not to see it.
    it('hides a dish whose declaration the vocabulary does not recognise', () => {
      expect(productMayContainAllergen(dish(['farine T65']), ['gluten'])).toBe(true)
    })

    it('hides a dish when the exclusion itself is unrecognised', () => {
      expect(productMayContainAllergen(dish(['gluten']), ['sarrasin'])).toBe(true)
    })

    it('matches two unrecognised values that are the same wording', () => {
      expect(productMayContainAllergen(dish(['Farine T65']), ['farine t65'])).toBe(true)
    })

    it('ignores empty and whitespace-only exclusions', () => {
      expect(productMayContainAllergen(dish(['gluten']), ['', '   '])).toBe(false)
    })

    it('drives filterProducts', () => {
      const products: ProductDoc[] = [dish(['Gluten']), { ...dish(['Œufs']), _id: 'p2', name: 'Salad' }]
      const filtered = filterProducts(products, { allergens: ['gluten'] })
      expect(filtered.map((p) => p.name)).toEqual(['Salad'])
    })
  })

  /**
   * The identity `useProductFilters.toggleAllergen` uses: it decides whether a
   * second click turns an existing chip off, so it must not answer the
   * unrecognised case the way the exclusion filter does.
   */
  describe('isSameAllergenFilter', () => {
    it('treats every spelling of one allergen as one chip', () => {
      expect(isSameAllergenFilter('Gluten', 'gluten')).toBe(true)
      expect(isSameAllergenFilter('blé', 'GLUTEN')).toBe(true)
      expect(isSameAllergenFilter('Lactose', 'lait')).toBe(true)
    })

    it('keeps distinct allergens apart', () => {
      expect(isSameAllergenFilter('gluten', 'dairy')).toBe(false)
    })

    it('never equates an unrecognised value with a canonical one', () => {
      expect(isSameAllergenFilter('farine T65', 'gluten')).toBe(false)
      expect(isSameAllergenFilter('gluten', 'farine T65')).toBe(false)
    })

    it('equates two unrecognised values that are the same wording', () => {
      expect(isSameAllergenFilter('Farine T65', 'farine t65')).toBe(true)
      expect(isSameAllergenFilter('farine T65', 'sarrasin')).toBe(false)
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

    it('should return the owner wording untouched', () => {
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
        allergens: ['Farine de blé', 'farine T65'],
        tags: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
        source: 'manual',
      }

      expect(getProductAllergens(product)).toEqual(['Farine de blé', 'farine T65'])
    })
  })

  describe('getResolvedProductAllergens', () => {
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
      allergens: ['Farine de blé', 'lactose', 'lait', 'farine T65'],
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      source: 'manual',
    }

    it('should resolve, deduplicate and label declarations', () => {
      expect(getResolvedProductAllergens(product)).toEqual([
        { raw: 'Farine de blé', allergen: 'gluten', kind: 'allergen', label: 'Gluten' },
        { raw: 'lactose', allergen: 'dairy', kind: 'allergen', label: 'Lait' },
        { raw: 'farine T65', allergen: null, kind: 'unverified', label: 'farine T65' },
      ])
    })

    it('should keep an unrecognised declaration rather than drop it', () => {
      const resolved = getResolvedProductAllergens(product, 'en')
      expect(resolved.map((r) => r.label)).toEqual(['Gluten', 'Milk', 'farine T65'])
      expect(resolved.at(-1)?.kind).toBe('unverified')
    })
  })
})
