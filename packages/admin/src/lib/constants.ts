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

/**
 * BeYours contact for maintenance renewal / migration questions.
 * Not set → the UI shows a neutral "contact BeYours" message
 * instead of a mailto link.
 */
export const BID_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_BID_SUPPORT_EMAIL ?? null
