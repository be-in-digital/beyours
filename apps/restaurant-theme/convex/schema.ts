import { defineSchema } from "convex/server";
import {
  userProfilesTable,
  globalSettingsTable,
  storeIntegrationsTable,
  storesTable,
  teamMembersTable,
  categoriesTable,
  productsTable,
  menusTable,
  ordersTable,
  kitchenTicketsTable,
  printerSettingsTable,
  paymentsTable,
  languagesTable,
  translationsTable,
  translationJobsTable,
  gameQRCodesTable,
  requiredActionsTable,
  gamesTable,
  prizesTable,
  gamePlaysTable,
  prizeRedemptionsTable,
} from "@beindigital-engine/convex-schema";

/**
 * BeInDigital Engine - App Schema
 *
 * Auth tables (user, session, account, verification, jwks) are managed
 * by the Better Auth component and are NOT defined here.
 *
 * Business tables are imported from @beindigital-engine/convex-schema.
 */
export default defineSchema({
  userProfiles: userProfilesTable,
  globalSettings: globalSettingsTable,
  storeIntegrations: storeIntegrationsTable,
  stores: storesTable,
  teamMembers: teamMembersTable,
  categories: categoriesTable,
  products: productsTable,
  menus: menusTable,
  orders: ordersTable,
  kitchenTickets: kitchenTicketsTable,
  printerSettings: printerSettingsTable,
  payments: paymentsTable,
  languages: languagesTable,
  translations: translationsTable,
  translationJobs: translationJobsTable,
  gameQRCodes: gameQRCodesTable,
  requiredActions: requiredActionsTable,
  games: gamesTable,
  prizes: prizesTable,
  gamePlays: gamePlaysTable,
  prizeRedemptions: prizeRedemptionsTable,
});
