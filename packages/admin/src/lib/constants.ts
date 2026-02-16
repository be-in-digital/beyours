/**
 * Default page size for admin tables (stores, orders, products, etc.)
 * Reads from NEXT_PUBLIC_ADMIN_PAGE_SIZE env var, falls back to 15.
 */
export const ADMIN_PAGE_SIZE =
  parseInt(process.env.NEXT_PUBLIC_ADMIN_PAGE_SIZE ?? "15", 10)
