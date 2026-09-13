/**
 * Cart Service
 *
 * Pure business logic functions for cart operations
 * No side effects, no store mutations - operates on data only
 */

import type { CartItem, CartSummary, NewCartItem } from '../types'

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

  // Exactly one of the two: a line is a dish or a formule, never both and
  // never neither. A line with both would price twice; one with neither is the
  // empty line that used to be impossible and is now expressible.
  if (item.menu) {
    if (item.productId) {
      errors.push('A line cannot be both a product and a menu')
    }
    if (!item.menu.menuId || item.menu.menuId.trim().length === 0) {
      errors.push('Menu ID is required')
    }
    if (item.menu.choices.length === 0) {
      errors.push('A menu line must carry its choices')
    }
    item.menu.choices.forEach((choice, index) => {
      if (!choice.productId || choice.productId.trim().length === 0) {
        errors.push(`Menu choice ${index + 1}: product ID is required`)
      }
      if (!choice.sectionId || choice.sectionId.trim().length === 0) {
        errors.push(`Menu choice ${index + 1}: section ID is required`)
      }
      if (!Number.isInteger(choice.quantity) || choice.quantity <= 0) {
        errors.push(`Menu choice ${index + 1}: quantity must be a positive integer`)
      }
    })
  } else if (!item.productId || item.productId.trim().length === 0) {
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
 * The identity of a cart line: a product plus the options chosen with it.
 *
 * One pizza with extra cheese and one plain are two lines of one product, and
 * everything acting on a line has to be able to name it. Derived rather than
 * generated, so it is the same value before and after a reload — a random id
 * stored in localStorage would break the moment a cart is rehydrated by a
 * build that did not write it.
 *
 * Options are sorted, so the order the customer ticked them in does not create
 * a second line. The separators are control characters no option name carries,
 * so "Taille: L" plus "Sauce: —" cannot collide with a single option called
 * something that happens to contain the separator.
 */
export const cartLineId = (item: NewCartItem): string => {
  const options = item.options
    .map((option) => `${option.name}\u001f${option.choice}`)
    .sort()
    .join('\u001e')

  /*
   * A *formule* line is identified by its WHOLE selection (#352).
   *
   * Two « Formule Midi » in one basket, one with the risotto and one with the
   * burrata, are two lines — and keyed on the menu id alone they would be one,
   * so "+" on either would raise both and the kitchen would receive two of
   * whichever was added first. Same defect this function was written to fix for
   * products with options, one level up.
   *
   * The choices are sorted so the id does not depend on the order the dialog
   * happened to collect them in, and each carries its quantity: two of the same
   * dessert is not the same line as one.
   */
  if (item.menu) {
    const choices = item.menu.choices
      .map(
        (choice) =>
          `${choice.sectionId}\u001f${choice.productId}\u001f${choice.quantity}${
            choice.options?.length
              ? `\u001f${choice.options
                  .map((option) => `${option.name}=${option.choice}`)
                  .sort()
                  .join(',')}`
              : ''
          }`
      )
      .sort()
      .join('\u001e')
    return `menu:${item.menu.menuId}\u001d${choices}`
  }

  // `productId` is required on a non-formule line; `validateCartItem` refuses
  // one without it, and the empty string keeps this total rather than throwing
  // on a line that has already been rejected.
  const productId = item.productId ?? ''
  return options ? `${productId}\u001d${options}` : productId
}

/**
 * Helper: Check if two items are the same (product + options)
 *
 * One definition of "same line", shared with `cartLineId`. `priceModifier` is
 * deliberately not compared: two identical choices whose price the owner
 * changed between two visits are the same dish, and the price the customer
 * actually pays is recomputed from the product server-side anyway.
 */
export const isSameItem = (a: NewCartItem, b: NewCartItem): boolean =>
  cartLineId(a) === cartLineId(b)

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
