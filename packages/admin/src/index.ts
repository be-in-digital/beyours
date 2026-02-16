/**
 * @beindigital-engine/admin
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
  EmptyState,
  LoadingState,
  StatusBadge,
  DateDisplay,
  DeleteConfirmDialog,
  StoreSelector,
  SidebarUserMenu,
  StoreGuard,
} from "./components"

// Stores
export { useAdminAuthStore } from "./stores/admin-auth-store"
export type { AdminAuthStore } from "./stores/admin-auth-store"
export { useAdminApiStore } from "./stores/admin-api-store"

// Hooks
export { useAdminStoreId, useAdminApi, useDebounce } from "./hooks/admin-hooks"

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
export { ADMIN_PAGE_SIZE } from "./lib/constants"

// Sidebar UI primitives (for layout composition)
export {
  SidebarProvider,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/sidebar"

// Pages (lazy loaded by consuming apps)
export { DashboardPage } from "./pages/dashboard"
export { OrdersPage, OrderDetailPage } from "./pages/orders"
export { ProductsPage, NewProductPage, EditProductPage } from "./pages/products"
export { StoresPage, StoreDetailPage, StoresTable, StoresPagination } from "./pages/stores"
export { TeamPage } from "./pages/team"
export { SettingsPage } from "./pages/settings"
export { GamesPage } from "./pages/games"
export { KitchenPage } from "./pages/kitchen"
export { CategoriesPage } from "./pages/categories"
export { LanguagesPage } from "./pages/languages"
export { DesignPage } from "./pages/design"
export { PaymentsPage } from "./pages/payments"
