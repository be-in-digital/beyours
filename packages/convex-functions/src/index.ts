/**
 * @beindigital-engine/convex-functions
 *
 * Function definition objects (args + handler) for Convex query/mutation wrappers
 */

// Re-export all function modules
export * as stores from "./stores"
export * as products from "./products"
export * as categories from "./categories"
export * as orders from "./orders"
export * as kitchenTickets from "./kitchenTickets"
export * as payments from "./payments"
export * as teamMembers from "./teamMembers"
export * as languages from "./languages"
export * as translations from "./translations"
export * as games from "./games"
export * as prizes from "./prizes"
export * as gameQRCodes from "./gameQRCodes"

// Pure utility functions
export { generateOrderNumber, generateSlug, now } from "./helpers"
