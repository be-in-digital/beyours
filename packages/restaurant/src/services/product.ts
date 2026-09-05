/**
 * Product Service
 *
 * Pure business logic functions for product operations
 * No side effects, no Convex calls - operates on data only
 */

import {
  normalizeAllergen,
  normalizeAllergenKey,
  resolveAllergens,
  type ResolvedAllergen,
  type AllergenLocale,
} from '@be-in-digital/core/allergens'
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
 */
export const isProductAvailable = (product: ProductDoc): boolean => {
  // Check if active
  if (!product.isActive) return false

  // Check stock if tracked
  if (product.stock?.tracked && product.stock.quantity <= 0) return false

  // Check scheduling
  if (product.scheduling && !isProductScheduledNow(product)) return false

  return true
}

/**
 * Check if product is available according to scheduling
 */
export const isProductScheduledNow = (product: ProductDoc, now: Date = new Date()): boolean => {
  if (!product.scheduling) return true

  const currentDay = now.getDay()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Check day restriction
  if (product.scheduling.availableDays && product.scheduling.availableDays.length > 0) {
    if (!product.scheduling.availableDays.includes(currentDay)) {
      return false
    }
  }

  // Check time restriction
  const { availableFrom, availableUntil } = product.scheduling
  if (availableFrom && currentTime < availableFrom) return false
  if (availableUntil && currentTime > availableUntil) return false

  return true
}

/**
 * Do two allergen filter entries name the same thing?
 *
 * Identity, not safety. This answers "did the diner already tick this chip?",
 * so it goes through the same vocabulary the exclusion filter uses — `blé` and
 * `Gluten` are one chip, not two — but it stops there: a value the vocabulary
 * does not recognise is equal only to the same wording, so a diner who typed
 * `farine T65` does not lose it by toggling `gluten` off.
 *
 * `productMayContainAllergen` below deliberately answers the unrecognised case
 * the other way, because it is deciding whether a dish is safe to show rather
 * than which chip was clicked.
 */
export const isSameAllergenFilter = (a: string, b: string): boolean => {
  const left = normalizeAllergen(a)
  const right = normalizeAllergen(b)
  if (left || right) return left === right
  return normalizeAllergenKey(a) === normalizeAllergenKey(b)
}

/**
 * Can this product carry one of the allergens the diner asked to exclude?
 *
 * Both sides go through `normalizeAllergen` from
 * `@be-in-digital/core/allergens` — the one vocabulary in the repository — so a
 * filter on `gluten` matches `Gluten`, `GLUTEN`, `blé` and `Céréales contenant
 * du gluten` alike. The previous implementation compared the two raw strings,
 * which meant a diner who excluded `gluten` was still served a dish tagged
 * `Gluten`: a false negative on an allergy filter, i.e. a dish shown to
 * somebody who asked not to see it.
 *
 * The decision this function encodes, and the reason it is named "may contain"
 * rather than "contains":
 *
 *   An allergen value the vocabulary does not recognise is NOT proof of
 *   absence. `farine T65`, `sauce maison` or a misspelling could each be the
 *   very allergen being excluded, and nothing here can tell. So whenever the
 *   two sides cannot be compared — the product declares something unrecognised,
 *   or the diner filters on something unrecognised — the product is treated as
 *   a possible match and hidden.
 *
 * That is deliberately asymmetric. Hiding a safe dish costs a sale; showing an
 * unsafe one costs a diner. Only a value that positively resolves to a
 * *different* allergen is evidence enough to keep the dish on the menu.
 *
 * Empty and whitespace-only entries are ignored on both sides: they declare
 * nothing, and letting one through would empty the menu.
 */
export const productMayContainAllergen = (
  product: ProductDoc,
  excluded: readonly string[]
): boolean => {
  const exclusions = excluded
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => ({
      allergen: normalizeAllergen(value),
      key: normalizeAllergenKey(value),
    }))
  if (exclusions.length === 0) return false

  const declared = resolveAllergens(product.allergens)
  if (declared.length === 0) return false

  return declared.some((entry) =>
    exclusions.some((exclusion) => {
      // Both sides recognised: an honest comparison of canonical keys.
      if (entry.allergen && exclusion.allergen) return entry.allergen === exclusion.allergen
      // Neither recognised: compare the owner's own wording, normalised, so
      // "Fait maison" and "fait maison" are the same declaration.
      if (!entry.allergen && !exclusion.allergen) {
        return normalizeAllergenKey(entry.raw) === exclusion.key
      }
      // One side recognised and the other not — not comparable, so not proof
      // of absence. See the note above: hide the dish.
      return true
    })
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
    const excluded = filters.allergens
    filtered = filtered.filter((p) => !productMayContainAllergen(p, excluded))
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
    filtered = filtered.filter((p) => isProductAvailable(p))
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
 * Get product allergens list, exactly as the owner stored it.
 *
 * This is the raw accessor and stays raw: `products.allergens` is free text
 * (`v.array(v.string())`) precisely so a restaurateur can declare something the
 * vocabulary has never heard of, and rewriting their wording here would lose
 * that declaration.
 *
 * It is therefore NOT a matching primitive. Comparing what it returns against
 * anything is the defect `productMayContainAllergen` exists to prevent — use
 * `getResolvedProductAllergens` to render, and `productMayContainAllergen` to
 * decide whether a dish is safe to show.
 */
export const getProductAllergens = (product: ProductDoc): string[] => {
  return product.allergens || []
}

/**
 * Get product allergens resolved against the canonical vocabulary.
 *
 * One entry per distinct declaration, in the order the owner entered it. An
 * entry whose `allergen` is `null` is one the vocabulary does not recognise:
 * it is kept and labelled with the owner's own wording, never dropped and
 * never presented as a verified allergen.
 */
export const getResolvedProductAllergens = (
  product: ProductDoc,
  locale: AllergenLocale = 'fr'
): ResolvedAllergen[] => {
  return resolveAllergens(product.allergens, locale)
}
