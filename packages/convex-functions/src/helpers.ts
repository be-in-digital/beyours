/**
 * Utility functions for Convex backend operations
 */

/**
 * Generate a unique order number
 * Format: ORD-YYYY-XXXX
 */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${year}-${random}`
}

/**
 * Generate a slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now()
}
