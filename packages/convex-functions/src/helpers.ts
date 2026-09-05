/**
 * Utility functions for Convex backend operations
 */

/**
 * Generate an order number.
 *
 * @deprecated Use `allocateOrderNumber` from `./numbering`. This produced
 * `ORD-2026-K3X9QA` while the schema documented `ORD-2026-0001`; it was written
 * to the database with no uniqueness check, no per-store sequence and no retry
 * on collision, and "unique" rested on nothing but a 36^6 coincidence. Nothing
 * in the engine calls it any more.
 *
 * Kept, rather than deleted, because it is re-exported from this package's
 * barrel and the package is published — removing it is a breaking change and
 * belongs in a major, with a changeset. It must not acquire a new caller.
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
