/**
 * Cart Service
 *
 * Pure business logic functions for cart operations
 * No side effects, no store mutations - operates on data only
 */

import type { CartItem, CartSummary } from '../types'

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate cart item
 */
export const validateCartItem = (item: CartItem): ValidationResult => {
  const errors: string[] = []

  if (!item.productId || item.productId.trim().length === 0) {
    errors.push('Product ID is required')
  }

  if (!item.name || item.name.trim().length === 0) {
    errors.push('Product name is required')
  }

  if (item.price < 0) {
    errors.push('Price must be positive')
  }

  if (item.quantity <= 0) {
    errors.push('Quantity must be greater than 0')
  }

  if (!Number.isInteger(item.quantity)) {
    errors.push('Quantity must be an integer')
  }

  // Validate options
  item.options.forEach((opt, index) => {
    if (!opt.name || opt.name.trim().length === 0) {
      errors.push(`Option ${index + 1}: name is required`)
    }
    if (!opt.choice || opt.choice.trim().length === 0) {
      errors.push(`Option ${index + 1}: choice is required`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Merge cart items (combine items with same product + options)
 */
export const mergeCartItems = (existing: CartItem[], newItem: CartItem): CartItem[] => {
  const existingIndex = existing.findIndex((item) => isSameItem(item, newItem))

  if (existingIndex >= 0) {
    // Item exists, increment quantity
    const merged = [...existing]
    const existingItem = merged[existingIndex]
    if (existingItem) {
      merged[existingIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + newItem.quantity,
      }
    }
    return merged
  } else {
    // New item, add to cart
    return [...existing, newItem]
  }
}

/**
 * Helper: Check if two items are the same (product + options)
 */
export const isSameItem = (a: CartItem, b: CartItem): boolean => {
  if (a.productId !== b.productId) return false
  if (a.options.length !== b.options.length) return false

  // Sort and compare options
  const aOptions = [...a.options].sort((x, y) => x.name.localeCompare(y.name))
  const bOptions = [...b.options].sort((x, y) => x.name.localeCompare(y.name))

  return aOptions.every((opt, i) => {
    const bOpt = bOptions[i]
    if (!bOpt) return false
    return (
      opt.name === bOpt.name &&
      opt.choice === bOpt.choice &&
      opt.priceModifier === bOpt.priceModifier
    )
  })
}

/**
 * Helper: Calculate item total price
 */
export const getItemTotal = (item: CartItem): number => {
  const optionsTotal = item.options.reduce((sum, opt) => sum + opt.priceModifier, 0)
  return (item.price + optionsTotal) * item.quantity
}

/**
 * Calculate cart totals
 */
export const calculateCartTotals = (
  items: CartItem[],
  taxRate: number,
  deliveryFee: number
): CartSummary => {
  const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0)
  const tax = Math.round(subtotal * (taxRate / 100))
  const total = subtotal + tax + deliveryFee
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    subtotal,
    tax,
    deliveryFee,
    total,
    itemCount,
  }
}

/**
 * Check if cart can proceed to checkout
 */
export const canCheckout = (
  items: CartItem[],
  storeId: string | null
): { eligible: boolean; reason?: string } => {
  if (!storeId) {
    return {
      eligible: false,
      reason: 'No store selected',
    }
  }

  if (items.length === 0) {
    return {
      eligible: false,
      reason: 'Cart is empty',
    }
  }

  // Validate all items
  for (const item of items) {
    const validation = validateCartItem(item)
    if (!validation.valid) {
      return {
        eligible: false,
        reason: `Invalid item: ${validation.errors.join(', ')}`,
      }
    }
  }

  return {
    eligible: true,
  }
}
