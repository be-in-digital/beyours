/**
 * @be-in-digital/core - Authentification et RBAC
 *
 * Ce module fournit une solution complète d'authentification avec Better Auth
 * et un système RBAC (Role-Based Access Control) pour BeYours Engine.
 *
 * @module auth
 *
 * @example
 * ```ts
 * // Import RBAC
 * import { Role, hasPermission } from '@be-in-digital/core/auth'
 *
 * // Import hooks React
 * import { useAuth, usePermission } from '@be-in-digital/core/auth'
 *
 * // Import utilitaires serveur
 * import { requireAuth, requirePermission } from '@be-in-digital/core/auth'
 * ```
 */

// ============================================================================
// RBAC - Role-Based Access Control
// ============================================================================
export {
  Role,
  Resource,
  Action,
  type Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  parseRole,
  isValidRole,
  PermissionDeniedError,
} from './rbac';

// ============================================================================
// Types et interfaces
// ============================================================================
export type {
  AuthUser,
  AuthSession,
  AuthSessionData,
  EmailPasswordCredentials,
  SignUpData,
  OAuthProvider,
  PasswordResetData,
  EmailVerificationData,
  ChangePasswordData,
  TwoFactorConfig,
  TwoFactorVerification,
  SignInResult,
  SignUpResult,
  BetterAuthConfig,
  AuthContextValue,
} from './types';

// ============================================================================
// Configuration
// ============================================================================
export {
  createAuthConfig,
  authHooks,
  emailTemplates,
  authRoutes,
  authErrors,
  validatePassword,
  validateEmail,
  DEFAULT_SESSION_EXPIRY,
  DEFAULT_SESSION_REFRESH,
  MIN_PASSWORD_LENGTH,
} from './config';

// ============================================================================
// Client React (hooks et composants)
// ============================================================================
export {
  useAuth,
  useUser,
  useSession,
  usePermission,
  useAnyPermission,
  useAllPermissions,
  useRole,
  useAnyRole,
  createAuthClient,
  AuthProvider,
} from './client';

export type {
  WithAuthOptions,
  WithAuthFactory,
  CanAccessProps,
  CanAccessComponent,
  RoleGateProps,
  RoleGateComponent,
} from './client';

// ============================================================================
// Serveur (Server Components, API Routes, Middleware)
// ============================================================================
export {
  getServerSession,
  getServerUser,
  requireAuth,
  requireRole,
  requireAnyRole,
  requirePermissionGuard,
  requireAnyPermissionGuard,
  requireAllPermissionsGuard,
  canAccessRestaurant,
  requireRestaurantAccess,
  handleAuthError,
  withAuthRoute,
  UnauthorizedError,
  ForbiddenError,
} from './server';
