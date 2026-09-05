/**
 * Product Service
 *
 * Pure business logic functions for product operations
 * No side effects, no Convex calls - operates on data only
 */

import { isWithinWindow } from '@be-in-digital/convex-schema'
import type { ProductDoc, ProductFilters, ProductSortBy, CartSelectedOption } from '../types'

/**
 * Calculate product price with selected options
 */
export const calculateProductPrice = (basePrice: number, options: CartSelectedOption[]): number => {
  const optionsTotal = options.reduce((sum, opt) => sum + opt.priceModifier, 0)
  return basePrice + optionsTotal
}

/**
 * Check if product is available
 *
 * `timeZone` is the establishment's — see `isProductScheduledNow`. Without it
 * the serving window is read on the visitor's own clock, which is how a diner
 * abroad was shown a dish the kitchen would refuse.
 */
export const isProductAvailable = (product: ProductDoc, timeZone?: string): boolean => {
  // Check if active
  if (!product.isActive) return false

  // Check stock if tracked
  if (product.stock?.tracked && product.stock.quantity <= 0) return false

  // Check scheduling
  if (product.scheduling && !isProductScheduledNow(product, new Date(), timeZone)) return false

  return true
}

/**
 * Check if product is available according to scheduling
 *
 * WHY THIS DELEGATES: the menu and `orders.create` used to disagree about the
 * same dish. This function read `now.getDay()` and `now.getHours()` on the
 * *visitor's* clock and compared `"HH:MM"` strings with no wrap, so a
 * 22:00–02:00 late menu was an empty set — `currentTime > availableUntil` is
 * true from 02:01 until midnight — and the dish was greyed out for every hour
 * it was actually being served. The mutation, meanwhile, handled the
 * midnight crossing and read the restaurant's timezone, so a diner abroad saw a
 * dish, added it, and was refused at payment.
 *
 * One implementation now, in `convex-schema` because it is the only package
 * both the storefront and the order mutation can import. Two that agree today
 * is what produced this.
 *
 * `timeZone` is `globalSettings.timezone`. Absent, `isWithinWindow` falls back
 * to UTC, which is what the server does when the setting is unwritten.
 */
export const isProductScheduledNow = (
  product: ProductDoc,
  now: Date = new Date(),
  timeZone?: string
): boolean => {
  if (!product.scheduling) return true

  return isWithinWindow(
    {
      days: product.scheduling.availableDays,
      from: product.scheduling.availableFrom,
      until: product.scheduling.availableUntil,
    },
    now.getTime(),
    timeZone
  )
}

/**
 * Filter products based on criteria
 */
export const filterProducts = (products: ProductDoc[], filters: ProductFilters): ProductDoc[] => {
  let filtered = [...products]

  // Filter by category
  if (filters.categoryId) {
    filtered = filtered.filter((p) => p.categoryId === filters.categoryId)
  }

  // Filter by search query
  if (filters.search && filters.search.trim().length > 0) {
    const query = filters.search.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }

  // Filter by allergens (exclude products with specified allergens)
  if (filters.allergens && filters.allergens.length > 0) {
    filtered = filtered.filter((p) => {
      return !p.allergens.some((allergen) => filters.allergens!.includes(allergen))
    })
  }

  // Filter by price range
  if (filters.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.price >= filters.minPrice!)
  }
  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.price <= filters.maxPrice!)
  }

  // Filter by availability
  if (filters.availableOnly) {
    filtered = filtered.filter((p) => isProductAvailable(p, filters.timeZone))
  }

  return filtered
}

/**
 * Sort products
 */
export const sortProducts = (products: ProductDoc[], sortBy: ProductSortBy): ProductDoc[] => {
  const sorted = [...products]

  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))

    case 'price':
      return sorted.sort((a, b) => a.price - b.price)

    case 'popular':
      // Sort by featured first, then by sortOrder
      return sorted.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1
        if (!a.isFeatured && b.isFeatured) return 1
        return a.sortOrder - b.sortOrder
      })

    default:
      return sorted
  }
}

/**
 * Format price for display
 */
export const formatPrice = (
  amount: number,
  currency: string = 'EUR',
  locale: string = 'fr-FR'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount / 100) // Convert cents to euros
}

/**
 * Get product allergens list
 */
export const getProductAllergens = (product: ProductDoc): string[] => {
  return product.allergens || []
}
