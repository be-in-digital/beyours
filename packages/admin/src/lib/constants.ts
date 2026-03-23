/**
 * Default page size for admin tables (stores, orders, products, etc.)
 * Reads from NEXT_PUBLIC_ADMIN_PAGE_SIZE env var, falls back to 15.
 */
export const ADMIN_PAGE_SIZE =
  parseInt(process.env.NEXT_PUBLIC_ADMIN_PAGE_SIZE ?? "15", 10)

/**
 * Application version — source of truth is the runtime (package.json).
 * Reads from NEXT_PUBLIC_APP_VERSION env var, falls back to "0.1.0".
 */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"
