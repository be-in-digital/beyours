/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  🔑 Auth Client                                             │
 * │  React hooks and utilities for client-side authentication   │
 * │  Permission checks, role gates, and session management      │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { useAuth, usePermission }                 │      │
 * │  │   from '@repo/core/auth'                          │      │
 * │  │                                                   │      │
 * │  │ const { user, signIn } = useAuth()                │      │
 * │  │ const { allowed } = usePermission('orders:write') │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { type Permission, type Role, hasPermission } from './rbac';

/**
 * Lightweight React type stand-ins to avoid a hard dependency on React
 */
type ReactNode = unknown;

type ComponentType<P = Record<string, unknown>> = (props: P) => ReactNode;
import type {
  AuthContextValue,
  AuthUser,
  EmailPasswordCredentials,
  SignUpData,
  PasswordResetData,
  ChangePasswordData,
  TwoFactorVerification,
  OAuthProvider,
} from './types';

/**
 * React hook for authentication
 *
 * @returns The full authentication context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isLoading, signIn, signOut } = useAuth()
 *
 *   if (isLoading) return <div>Loading...</div>
 *   if (!user) return <div>Signed out</div>
 *
 *   return <div>Hello {user.name}</div>
 * }
 * ```
 *
 * NOTE: once installed, implement with:
 * - const { data: session, isLoading } = useSession()
 * - const { signIn, signOut, ... } = useAuthClient()
 */
export function useAuth(): AuthContextValue {
  // TODO: implement with the Better Auth React hooks once installed
  throw new Error(
    'useAuth: Better Auth non installé. Installez better-auth et @better-auth/react'
  );
}

/**
 * Hook returning the current user
 *
 * @returns The signed-in user, or null
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useUser()
 *   if (!user) return null
 *   return <div>{user.email}</div>
 * }
 * ```
 */
export function useUser(): AuthUser | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook returning the current session
 *
 * @returns The active session, or null
 *
 * @example
 * ```tsx
 * function SessionInfo() {
 *   const session = useSession()
 *   if (!session) return null
 *   return <div>Session expires on {session.expiresAt}</div>
 * }
 * ```
 */
export function useSession() {
  const { session } = useAuth();
  return session;
}

/**
 * Hook checking a single permission
 *
 * @param permission - The permission to check
 * @returns An object carrying `allowed` and `loading`
 *
 * @example
 * ```tsx
 * function DeleteButton() {
 *   const { allowed, loading } = usePermission('products:delete')
 *
 *   if (loading) return <Spinner />
 *   if (!allowed) return null
 *
 *   return <button>Supprimer</button>
 * }
 * ```
 */
export function usePermission(permission: Permission): {
  allowed: boolean;
  loading: boolean;
} {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return { allowed: false, loading: true };
  }

  if (!user) {
    return { allowed: false, loading: false };
  }

  return {
    allowed: hasPermission(user.role, permission),
    loading: false,
  };
}

/**
 * Hook checking for any one of several permissions
 *
 * @param permissions - The permissions, at least one of which is required
 * @returns An object carrying `allowed` and `loading`
 *
 * @example
 * ```tsx
 * function OrdersPage() {
 *   const { allowed } = useAnyPermission(['orders:read', 'orders:write'])
 *   if (!allowed) return <AccessDenied />
 *   return <OrdersList />
 * }
 * ```
 */
export function useAnyPermission(permissions: Permission[]): {
  allowed: boolean;
  loading: boolean;
} {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return { allowed: false, loading: true };
  }

  if (!user) {
    return { allowed: false, loading: false };
  }

  return {
    allowed: permissions.some((perm) => hasPermission(user.role, perm)),
    loading: false,
  };
}

/**
 * Hook checking for every one of several permissions
 *
 * @param permissions - The permissions, all of which are required
 * @returns An object carrying `allowed` and `loading`
 *
 * @example
 * ```tsx
 * function ProductEditor() {
 *   const { allowed } = useAllPermissions(['products:read', 'products:write'])
 *   if (!allowed) return <AccessDenied />
 *   return <ProductForm />
 * }
 * ```
 */
export function useAllPermissions(permissions: Permission[]): {
  allowed: boolean;
  loading: boolean;
} {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return { allowed: false, loading: true };
  }

  if (!user) {
    return { allowed: false, loading: false };
  }

  return {
    allowed: permissions.every((perm) => hasPermission(user.role, perm)),
    loading: false,
  };
}

/**
 * Hook checking a single role
 *
 * @param role - The role to check
 * @returns `true` when the user holds that role
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const isAdmin = useRole(Role.SUPER_ADMIN)
 *   if (!isAdmin) return <AccessDenied />
 *   return <AdminDashboard />
 * }
 * ```
 */
export function useRole(role: Role): boolean {
  const user = useUser();
  return user?.role === role;
}

/**
 * Hook checking for any one of several roles
 *
 * @param roles - The roles, at least one of which is required
 * @returns `true` when the user holds at least one of them
 *
 * @example
 * ```tsx
 * function StaffPanel() {
 *   const isStaff = useAnyRole([Role.MANAGER, Role.WAITER, Role.KITCHEN])
 *   if (!isStaff) return <AccessDenied />
 *   return <StaffDashboard />
 * }
 * ```
 */
export function useAnyRole(roles: Role[]): boolean {
  const user = useUser();
  return user ? roles.includes(user.role) : false;
}

/**
 * Builds the auth client
 *
 * @param options - Configuration options
 * @returns The configured auth client
 *
 * @example
 * ```ts
 * // In app/providers.tsx
 * const authClient = createAuthClient({
 *   baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
 * })
 *
 * export function Providers({ children }) {
 *   return <AuthProvider client={authClient}>{children}</AuthProvider>
 * }
 * ```
 *
 * NOTE: once installed, use:
 * - import { createAuthClient } from 'better-auth/react'
 */
export function createAuthClient(options: { baseUrl: string }) {
  // TODO: implement with Better Auth once installed
  // return createAuthClient({ baseURL: options.baseUrl })

  return {
    baseUrl: options.baseUrl,
    // Placeholder, to keep TypeScript quiet
    _placeholder: true,
  };
}

/**
 * React provider for authentication
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { AuthProvider } from '@be-in-digital/core/auth'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AuthProvider>
 *           {children}
 *         </AuthProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 *
 * NOTE: once installed, use the provider from better-auth/react
 */
export function AuthProvider(_props: { children: ReactNode }): ReactNode {
  // TODO: implement with the Better Auth Provider once installed
  throw new Error(
    'AuthProvider: Better Auth non installé. Installez better-auth et @better-auth/react'
  );
}

/**
 * Type of a component gated behind authentication
 *
 * NOTE: this HOC has to be implemented in the application itself, once
 * better-auth/react is installed, because it needs JSX
 */
export type WithAuthOptions = {
  requireRole?: Role;
  requirePermission?: Permission;
  redirectTo?: string;
};

/**
 * Type of the authentication HOC factory
 *
 * @example
 * ```tsx
 * // In your app, once better-auth is installed
 * export function withAuth<P extends object>(
 *   Component: ComponentType<P>,
 *   options?: WithAuthOptions
 * ) {
 *   return function ProtectedComponent(props: P) {
 *     const { user, isLoading } = useAuth()
 *     // ... guard logic
 *     return <Component {...props} />
 *   }
 * }
 * ```
 */
export type WithAuthFactory = <P extends object>(
  Component: ComponentType<P>,
  options?: WithAuthOptions
) => ComponentType<P>;

/**
 * Props for the CanAccess component
 *
 * NOTE: this component has to be implemented in the application itself,
 * once better-auth/react is installed, because it needs JSX
 */
export type CanAccessProps = {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Type of the CanAccess component
 *
 * @example
 * ```tsx
 * // In your app, once better-auth is installed
 * export function CanAccess({ permission, children, fallback }: CanAccessProps) {
 *   const { allowed, loading } = usePermission(permission)
 *   if (loading) return null
 *   return allowed ? <>{children}</> : fallback ? <>{fallback}</> : null
 * }
 * ```
 */
export type CanAccessComponent = (props: CanAccessProps) => ReactNode;

/**
 * Props for the RoleGate component
 *
 * NOTE: this component has to be implemented in the application itself,
 * once better-auth/react is installed, because it needs JSX
 */
export type RoleGateProps = {
  role: Role;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Type of the RoleGate component
 *
 * @example
 * ```tsx
 * // In your app, once better-auth is installed
 * export function RoleGate({ role, children, fallback }: RoleGateProps) {
 *   const hasRole = useRole(role)
 *   return hasRole ? <>{children}</> : fallback ? <>{fallback}</> : null
 * }
 * ```
 */
export type RoleGateComponent = (props: RoleGateProps) => ReactNode;
