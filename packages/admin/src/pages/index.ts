/**
 * Admin pages barrel.
 *
 * Backs the `@be-in-digital/admin/pages` subpath declared in `package.json`.
 * That subpath was declared with no file behind it, so every consumer following
 * the export map — `@be-in-digital/mcp-server` advertised ten page components at
 * it — got a module-not-found.
 *
 * The set here mirrors the page components `../index.ts` re-exports, exactly:
 * one surface reached by two paths, so which import a consumer picks cannot
 * change what they get. The other members of the `pages/*` sub-barrels
 * (`DashboardSkeleton`, `MenusTab`, `PropagationModal` and the rest) are pieces
 * those pages are built from and stay internal. `src/__tests__/pages-barrel.test.ts`
 * fails if the two sides drift apart in either direction.
 */

export { CategoriesPage } from "./categories"
export { DashboardPage } from "./dashboard"
export { DesignPage } from "./design"
export {
  EmailCampaignsPage,
  EmailConfigPage,
  EmailDashboardPage,
  EmailSegmentsPage,
  EmailSubscribersPage,
  EmailTemplatesPage,
} from "./email"
export {
  GameActionsPage,
  GameCatalogPage,
  GameQrCodesPage,
  GameWinnersPage,
  GamesPage,
} from "./games"
export { InventoryPage } from "./inventory"
export { KitchenPage } from "./kitchen"
export { LanguagesPage } from "./languages"
export { MessagesPage } from "./messages"
export { OrderDetailPage, OrdersPage } from "./orders"
export { PaymentsPage } from "./payments"
export {
  EditProductPage,
  ImageToProductPage,
  NewProductPage,
  ProductsPage,
} from "./products"
export { PromotionsPage } from "./promotions"
export { SettingsPage } from "./settings"
export {
  StoreDetailPage,
  StoresPage,
  StoresPagination,
  StoresTable,
} from "./stores"
export { SystemPage } from "./system"
export { TeamPage } from "./team"
