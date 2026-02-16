/**
 * @beindigital-engine/admin
 *
 * Shared admin dashboard package.
 * Provides auth guard, RBAC sidebar, header, and UI components.
 */

// Components
export {
  AuthGuard,
  AppSidebar,
  AdminHeader,
  ForgotPasswordForm,
  ResetPasswordForm
} from "./components"

// Store
export { useAdminAuthStore } from "./stores/admin-auth-store"
export type { AdminAuthStore } from "./stores/admin-auth-store"

// Sidebar UI primitives (for layout composition)
export {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "./ui/sidebar"
