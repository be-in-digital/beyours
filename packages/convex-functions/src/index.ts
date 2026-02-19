/**
 * @beindigital-engine/convex-functions
 *
 * Function definition objects (args + handler) for Convex query/mutation wrappers
 */

// Re-export all function modules
export * as stores from "./stores"
export * as globalSettings from "./globalSettings"
export * as storeIntegrations from "./storeIntegrations"
export * as products from "./products"
export * as menus from "./menus"
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
export * as userProfiles from "./userProfiles"
export * as externalProductMappings from "./externalProductMappings"
export * as orphanProducts from "./orphanProducts"
export * as uberEatsOrders from "./uberEatsOrders"
export * as uberEatsMenuSync from "./uberEatsMenuSync"
export * as deliverooMenuSync from "./deliverooMenuSync"
export * as paymentConnectionsDefs from "./paymentConnections"

// Pure utility functions
export { generateOrderNumber, generateSlug, now } from "./helpers"

// Delivery fee calculation utility (pure math, no Convex dependencies)
export { calculateDeliveryFee, type DeliveryFeeParams, type DeliveryFeeResult } from "./deliveryFee"

// Note: encryption utilities are NOT re-exported from the barrel to avoid
// pulling Node.js crypto into non-"use node" bundles. Import directly:
// import { encrypt, decrypt } from "@beindigital-engine/convex-functions/encryption"
