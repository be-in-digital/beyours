/**
 * @be-in-digital/convex-functions
 *
 * Function definition objects (args + handler) for Convex query/mutation wrappers
 */

// Re-export all function modules
export * as stores from "./stores"
export * as backupRemap from "./backupRemap"
export * as storeAudit from "./storeAudit"
export * as accessAudit from "./accessAudit"
export * as globalSettings from "./globalSettings"
export * as storeIntegrations from "./storeIntegrations"
export * as products from "./products"
export * as menus from "./menus"
export * as categories from "./categories"
export * as orders from "./orders"
export * as orderConfirmation from "./orderConfirmation"
export * as numbering from "./numbering"
export * as invoices from "./invoices"
export * as orderSource from "./orderSource"
export * as kitchenTickets from "./kitchenTickets"
export * as platformWebhook from "./platformWebhook"
export * as platformWebhookFailures from "./platformWebhookFailures"
export * as payments from "./payments"
export * as teamMembers from "./teamMembers"
export * as languages from "./languages"
export * as translations from "./translations"
export * as games from "./games"
export * as prizes from "./prizes"
export * as gameQRCodes from "./gameQRCodes"
export * as gamePlay from "./gamePlay"
export * as requiredActions from "./requiredActions"
export * as userProfiles from "./userProfiles"
export * as externalProductMappings from "./externalProductMappings"
export * as orphanProducts from "./orphanProducts"
export * as uberEatsOrders from "./uberEatsOrders"
export * as uberEatsMenuSync from "./uberEatsMenuSync"
export * as deliverooMenuSync from "./deliverooMenuSync"
export * as paymentConnectionsDefs from "./paymentConnections"
export * as uberEatsConnectionsDefs from "./uberEatsConnections"
export * as promotions from "./promotions"
export * as emailSubscribers from "./emailSubscribers"
export * as emailTemplates from "./emailTemplates"
export * as emailCampaigns from "./emailCampaigns"
export * as emailSegments from "./emailSegments"
export * as emailAutomations from "./emailAutomations"
export * as emailEvents from "./emailEvents"
export * as emailConfig from "./emailConfig"
export * as cms from "./cms"
export * as cmsPublish from "./cmsPublish"
export * as cmsMedia from "./cmsMedia"
export * as blog from "./blog"
export * as blogPublish from "./blogPublish"
export * as ownerEntitlements from "./ownerEntitlements"
export * as blogAutoConfig from "./blogAutoConfig"
export * as blogAutoUsage from "./blogAutoUsage"
export {
  checkAutoBlogAccess,
  checkImageGenerationAccess,
  checkImageToProductAccess,
  releaseArticleQuota,
  releaseImageQuota,
  releaseImageToProductQuota,
  reserveArticleQuota,
  reserveImageQuota,
  reserveImageToProductQuota,
  resolveApprovalMode,
  validateConfigAgainstPlan,
  normalizeScheduleDays,
} from "./blogAutoGuards"
export * as bidSubscription from "./bidSubscription"
export * as maintenance from "./maintenance"
export * as blogAutoGenerate from "./blogAutoGenerate"
export * as favorites from "./favorites"
export * as contactMessages from "./contactMessages"

// Pure utility functions
export { generateOrderNumber, generateSlug, now } from "./helpers"

// Delivery fee calculation utility (pure math, no Convex dependencies)
export { calculateDeliveryFee, type DeliveryFeeParams, type DeliveryFeeResult } from "./deliveryFee"

// Note: encryption utilities are NOT re-exported from the barrel to avoid
// pulling Node.js crypto into non-"use node" bundles. Import directly:
// import { encrypt, decrypt } from "@be-in-digital/convex-functions/encryption"
