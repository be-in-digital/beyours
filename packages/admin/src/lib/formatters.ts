/**
 * Format price from cents to currency string
 */
export function formatPrice(cents: number, currency: string = "EUR"): string {
  const amount = cents / 100

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount)
}

/**
 * Format timestamp to French date string
 */
export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

/**
 * Format timestamp to short date string
 */
export function formatShortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
  }).format(new Date(timestamp))
}

/**
 * Format order number with # prefix
 */
export function formatOrderNumber(orderNumber: string): string {
  return `#${orderNumber}`
}

/**
 * Generate a URL-friendly slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100)
}

/**
 * Convert euros to cents
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

/**
 * Convert cents to euros
 */
export function centsToEuros(cents: number): number {
  return cents / 100
}
