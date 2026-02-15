/**
 * Client auth pour le frontend React
 *
 * NOTE: Après installation de better-auth, importer:
 * - import { createAuthClient } from 'better-auth/react'
 *
 * Ce fichier fournit les hooks et fonctions pour gérer l'auth côté client
 */

import { type Permission, type Role, hasPermission } from './rbac';

/**
 * Type générique pour les enfants React
 * Utilisé pour éviter la dépendance à React dans ce package
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactNode = any;

/**
 * Type générique pour un composant React
 * Utilisé pour éviter la dépendance à React dans ce package
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentType<P = any> = any;
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
 * Hook React pour l'authentification
 *
 * @returns Contexte d'authentification complet
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isLoading, signIn, signOut } = useAuth()
 *
 *   if (isLoading) return <div>Chargement...</div>
 *   if (!user) return <div>Non connecté</div>
 *
 *   return <div>Bonjour {user.name}</div>
 * }
 * ```
 *
 * NOTE: Après installation, implémenter avec:
 * - const { data: session, isLoading } = useSession()
 * - const { signIn, signOut, ... } = useAuthClient()
 */
export function useAuth(): AuthContextValue {
  // TODO: Implémenter avec Better Auth React hooks après installation
  throw new Error(
    'useAuth: Better Auth non installé. Installez better-auth et @better-auth/react'
  );
}

/**
 * Hook pour obtenir l'utilisateur courant
 *
 * @returns Utilisateur connecté ou null
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
 * Hook pour obtenir la session courante
 *
 * @returns Session active ou null
 *
 * @example
 * ```tsx
 * function SessionInfo() {
 *   const session = useSession()
 *   if (!session) return null
 *   return <div>Session expire le {session.expiresAt}</div>
 * }
 * ```
 */
export function useSession() {
  const { session } = useAuth();
  return session;
}

/**
 * Hook pour vérifier une permission
 *
 * @param permission - Permission à vérifier
 * @returns Objet avec `allowed` et `loading`
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
 * Hook pour vérifier plusieurs permissions (ANY)
 *
 * @param permissions - Liste de permissions (au moins une requise)
 * @returns Objet avec `allowed` et `loading`
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
 * Hook pour vérifier plusieurs permissions (ALL)
 *
 * @param permissions - Liste de permissions (toutes requises)
 * @returns Objet avec `allowed` et `loading`
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
 * Hook pour vérifier un rôle spécifique
 *
 * @param role - Rôle à vérifier
 * @returns `true` si l'utilisateur a le rôle
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
 * Hook pour vérifier plusieurs rôles (ANY)
 *
 * @param roles - Liste de rôles (au moins un requis)
 * @returns `true` si l'utilisateur a au moins un des rôles
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
 * Factory pour créer le client auth
 *
 * @param options - Options de configuration
 * @returns Client auth configuré
 *
 * @example
 * ```ts
 * // Dans app/providers.tsx
 * const authClient = createAuthClient({
 *   baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
 * })
 *
 * export function Providers({ children }) {
 *   return <AuthProvider client={authClient}>{children}</AuthProvider>
 * }
 * ```
 *
 * NOTE: Après installation, utiliser:
 * - import { createAuthClient } from 'better-auth/react'
 */
export function createAuthClient(options: { baseUrl: string }) {
  // TODO: Implémenter avec Better Auth après installation
  // return createAuthClient({ baseURL: options.baseUrl })

  return {
    baseUrl: options.baseUrl,
    // Placeholder pour éviter les erreurs TypeScript
    _placeholder: true,
  };
}

/**
 * Provider React pour l'authentification
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { AuthProvider } from '@beindigital-engine/core/auth'
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
 * NOTE: Après installation, utiliser le provider de better-auth/react
 */
export function AuthProvider(_props: { children: ReactNode }): ReactNode {
  // TODO: Implémenter avec Better Auth Provider après installation
  throw new Error(
    'AuthProvider: Better Auth non installé. Installez better-auth et @better-auth/react'
  );
}

/**
 * Type pour un composant protégé par authentification
 *
 * NOTE: L'implémentation de ce HOC doit être faite dans l'application
 * après installation de better-auth/react, car elle nécessite JSX
 */
export type WithAuthOptions = {
  requireRole?: Role;
  requirePermission?: Permission;
  redirectTo?: string;
};

/**
 * Type pour créer un HOC d'authentification
 *
 * @example
 * ```tsx
 * // Dans votre app après installation de better-auth
 * export function withAuth<P extends object>(
 *   Component: ComponentType<P>,
 *   options?: WithAuthOptions
 * ) {
 *   return function ProtectedComponent(props: P) {
 *     const { user, isLoading } = useAuth()
 *     // ... logique de protection
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
 * Props pour le composant CanAccess
 *
 * NOTE: L'implémentation de ce composant doit être faite dans l'application
 * après installation de better-auth/react, car elle nécessite JSX
 */
export type CanAccessProps = {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Type pour le composant CanAccess
 *
 * @example
 * ```tsx
 * // Dans votre app après installation de better-auth
 * export function CanAccess({ permission, children, fallback }: CanAccessProps) {
 *   const { allowed, loading } = usePermission(permission)
 *   if (loading) return null
 *   return allowed ? <>{children}</> : fallback ? <>{fallback}</> : null
 * }
 * ```
 */
export type CanAccessComponent = (props: CanAccessProps) => ReactNode;

/**
 * Props pour le composant RoleGate
 *
 * NOTE: L'implémentation de ce composant doit être faite dans l'application
 * après installation de better-auth/react, car elle nécessite JSX
 */
export type RoleGateProps = {
  role: Role;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Type pour le composant RoleGate
 *
 * @example
 * ```tsx
 * // Dans votre app après installation de better-auth
 * export function RoleGate({ role, children, fallback }: RoleGateProps) {
 *   const hasRole = useRole(role)
 *   return hasRole ? <>{children}</> : fallback ? <>{fallback}</> : null
 * }
 * ```
 */
export type RoleGateComponent = (props: RoleGateProps) => ReactNode;
