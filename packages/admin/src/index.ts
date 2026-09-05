/**
 * @be-in-digital/admin
 *
 * Shared admin dashboard package.
 * Provides auth guard, RBAC sidebar, header, page components, and utilities.
 */

// Components
export {
  AuthGuard,
  AppSidebar,
  AdminHeader,
  ForgotPasswordForm,
  ResetPasswordForm,
  ComingSoon,
  LoadingState,
  StatusBadge,
  DateDisplay,
  DeleteConfirmDialog,
  StoreSelector,
  SidebarUserMenu,
  StoreGuard,
  OnboardingTourProvider,
  ReplayTourButton,
} from "./components"

// Stores
export { useAdminAuthStore } from "./stores/admin-auth-store"
export type { AdminAuthStore } from "./stores/admin-auth-store"
export { useAdminApiStore } from "./stores/admin-api-store"

// Hooks
export {
  useAdminStoreId,
  useAdminStore,
  useSelectAdminStore,
  useAdminApi,
  useDebounce,
} from "./hooks/admin-hooks"

// Config
export { adminRoutes } from "./config/admin-routes"

// Lib
export {
  formatPrice,
  formatDate,
  formatShortDate,
  formatOrderNumber,
  slugify,
  eurosToCents,
  centsToEuros,
} from "./lib/formatters"
export { ADMIN_PAGE_SIZE, APP_VERSION } from "./lib/constants"
// The kitchen display's alert catalogue, shared with the editor that writes it
// so the two cannot drift.
export {
  KITCHEN_ALERTS,
  DEFAULT_SOUND_CONFIG,
  resolveSoundConfig,
  clampVolume,
  playAlertBeep,
} from "./lib/kitchen-alerts"
export type {
  KitchenAlert,
  KitchenAlertKey,
  KitchenAlertSetting,
  KitchenSoundConfig,
} from "./lib/kitchen-alerts"

// Sidebar UI primitives (for layout composition)
export {
  SidebarProvider,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@be-in-digital/ui"

// Pages (lazy loaded by consuming apps)
export { DashboardPage } from "./pages/dashboard"
export { OrdersPage, OrderDetailPage } from "./pages/orders"
export { ProductsPage, NewProductPage, EditProductPage, ImageToProductPage } from "./pages/products"
export { InventoryPage } from "./pages/inventory"
export { StoresPage, StoreDetailPage, StoresTable, StoresPagination } from "./pages/stores"
export { TeamPage } from "./pages/team"
export { SettingsPage } from "./pages/settings"
export {
  GamesPage,
  GameWinnersPage,
  GameActionsPage,
  GameCatalogPage,
  GameQrCodesPage,
} from "./pages/games"
export { KitchenPage } from "./pages/kitchen"
export { CategoriesPage } from "./pages/categories"
export { LanguagesPage } from "./pages/languages"
export { MessagesPage } from "./pages/messages"
export { DesignPage } from "./pages/design"
export { PaymentsPage } from "./pages/payments"
export { PromotionsPage } from "./pages/promotions"
export {
  EmailDashboardPage,
  EmailCampaignsPage,
  EmailTemplatesPage,
  EmailSubscribersPage,
  EmailSegmentsPage,
  EmailConfigPage,
} from "./pages/email"
export { SystemPage } from "./pages/system"
