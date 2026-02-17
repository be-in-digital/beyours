import { defineSchema } from "convex/server"
import {
  userProfilesTable,
  globalSettingsTable,
  storesTable,
  storeIntegrationsTable,
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
} from "./tables"

/**
 * BeInDigital Engine - Convex Database Schema
 *
 * Auth tables (user, session, account, verification, jwks) are managed
 * by the Better Auth component and are NOT defined here.
 *
 * This schema defines only business-specific tables.
 */
export default defineSchema({
  userProfiles: userProfilesTable,
  globalSettings: globalSettingsTable,
  stores: storesTable,
  storeIntegrations: storeIntegrationsTable,
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
})
