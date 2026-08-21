// Barrel export for all table definitions
export { userProfilesTable } from "./userProfiles"
export { globalSettingsTable } from "./globalSettings"
export { storesTable } from "./stores"
export { storeIntegrationsTable } from "./storeIntegrations"
export { externalProductMappingsTable } from "./externalProductMappings"
export { orphanProductsTable } from "./orphanProducts"
export { teamMembersTable } from "./teamMembers"
export { categoriesTable, productsTable, menuSectionValidator, menusTable } from "./catalog"
export { ordersTable } from "./orders"
export { kitchenTicketsTable, printerSettingsTable } from "./kitchen"
export { paymentsTable } from "./payments"
export { paymentConnectionsTable } from "./paymentConnections"
export { uberEatsConnectionsTable } from "./uberEatsConnections"
export { oauthStatesTable } from "./oauthStates"
export { deliveryQuotesTable } from "./deliveryQuotes"
export { languagesTable, translationsTable, translationJobsTable } from "./i18n"
export {
  gameQRCodesTable,
  requiredActionsTable,
  gamesTable,
  prizesTable,
  gamePlaysTable,
  prizeRedemptionsTable,
  gameReferralsTable,
} from "./gamification"
export { promotionsTable, promotionUsagesTable } from "./promotions"
export { favoritesTable } from "./favorites"
export { contactMessagesTable } from "./contactMessages"
export {
  emailBlockValidator,
  emailSubscribersTable,
  emailTemplatesTable,
  emailCampaignsTable,
  emailSegmentsTable,
  emailAutomationsTable,
  emailEventsTable,
  emailConfigTable,
} from "./emailMarketing"
// CMS block-based system (admin)
export { cmsPagesTable, cmsBlocksTable, cmsMediaTable } from "./cms"
// Blog system (admin)
export {
  blogCategoriesTable,
  blogTagsTable,
  blogArticlesTable,
  blogArticleTagsTable,
} from "./cms"
// Auto blog
export {
  ownerEntitlementsTable,
  blogAutoConfigTable,
  blogAutoQueueTable,
  blogAutoUsageTable,
} from "./autoBlog"
// System
export { systemAuditLogTable } from "./systemAuditLog"
// Maintenance & migration
export {
  maintenanceContractsTable,
  platformReleasesTable,
  migrationRequestsTable,
  migrationRequestStatusValidator,
  migrationScopeValidator,
} from "./maintenance"
// CMS storefront page tables & validators
export {
  // CMS validators
  localizedText,
  localizedRichText,
  localizedSeo,
  media as cmsMedia,
  pageMetadata,
  // CMS tables
  cmsTable,
  cmsHomeTable,
  cmsMenuTable,
  cmsAboutTable,
  cmsContactTable,
  cmsBlogPostsTable,
  cmsCartTable,
  cmsCheckoutTable,
  cmsTrackingTable,
  cmsSigninTable,
  cmsSignupTable,
  cmsPrivacyTable,
  cmsTermsTable,
  cms404Table,
  cmsMaintenanceTable,
  cmsAccountTable,
} from "./cms"
