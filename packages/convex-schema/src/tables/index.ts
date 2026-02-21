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
export { languagesTable, translationsTable, translationJobsTable } from "./i18n"
export {
  gameQRCodesTable,
  requiredActionsTable,
  gamesTable,
  prizesTable,
  gamePlaysTable,
  prizeRedemptionsTable,
} from "./gamification"
export { promotionsTable, promotionUsagesTable } from "./promotions"
