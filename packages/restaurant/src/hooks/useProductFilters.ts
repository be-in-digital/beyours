/**
 * useProductFilters Hook
 *
 * Managed product filter state
 */

'use client'

import { useState, useCallback } from 'react'
import { isSameAllergenFilter } from '../services/product'
import type { ProductFilters } from '../types'

/**
 * Product filters hook result
 */
interface UseProductFiltersResult {
  filters: ProductFilters
  setFilters: (filters: ProductFilters) => void
  setCategory: (categoryId: string | undefined) => void
  setSearch: (search: string) => void
  toggleAllergen: (allergen: string) => void
  setPriceRange: (min: number | undefined, max: number | undefined) => void
  setAvailableOnly: (availableOnly: boolean) => void
  clearFilters: () => void
}

/**
 * Hook for managing product filters
 */
export const useProductFilters = (
  initialFilters: ProductFilters = {}
): UseProductFiltersResult => {
  const [filters, setFilters] = useState<ProductFilters>(initialFilters)

  const setCategory = useCallback((categoryId: string | undefined) => {
    setFilters((prev) => ({ ...prev, categoryId }))
  }, [])

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }))
  }, [])

  const toggleAllergen = useCallback((allergen: string) => {
    const value = allergen.trim()
    // An empty chip excludes nothing and would only sit in the filter state.
    if (!value) return

    setFilters((prev) => {
      const allergens = prev.allergens || []
      const hasAllergen = allergens.some((a) => isSameAllergenFilter(a, value))

      return {
        ...prev,
        allergens: hasAllergen
          ? allergens.filter((a) => !isSameAllergenFilter(a, value))
          : [...allergens, value],
      }
    })
  }, [])

  const setPriceRange = useCallback(
    (min: number | undefined, max: number | undefined) => {
      setFilters((prev) => ({ ...prev, minPrice: min, maxPrice: max }))
    },
    []
  )

  const setAvailableOnly = useCallback((availableOnly: boolean) => {
    setFilters((prev) => ({ ...prev, availableOnly }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return {
    filters,
    setFilters,
    setCategory,
    setSearch,
    toggleAllergen,
    setPriceRange,
    setAvailableOnly,
    clearFilters,
  }
}
