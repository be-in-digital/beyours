/**
 * @be-in-digital/core - Authentication and RBAC
 *
 * A complete authentication solution built on Better Auth, plus a
 * role-based access control system, for the BeYours engine.
 *
 * @module auth
 *
 * `@be-in-digital/core/auth` is NOT a resolvable specifier. The package's
 * `exports` map is the list of what is, and it has grown since this note said
 * six: it now publishes twelve — `.`, `./env`, `./email`, `./sentry`,
 * `./allergens`, `./status-labels`, `./dining`, `./auth/rbac`,
 * `./aws/ses/order-confirmation`, `./aws/media-url`, `./aws/folders` and
 * `./email/providers`. Import RBAC from the `./auth/rbac` subpath (what every
 * call site in the repo does) and the rest from the package root.
 *
 * Count it in `package.json` before quoting a number here; the map is the
 * truth, this sentence is a copy of it.
 *
 * @example
 * ```ts
 * // RBAC — the subpath, resolved straight from source
 * import { Role, hasPermission } from '@be-in-digital/core/auth/rbac'
 *
 * // Everything else — the package root
 * import { useAuth, usePermission } from '@be-in-digital/core'
 * import { requireAuth, requirePermission } from '@be-in-digital/core'
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
// Types and interfaces
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
//
// There is none here any more, and there never was one that ran. `./config.ts`
// exported `createAuthConfig`, `authHooks`, `emailTemplates`, `authErrors`,
// `validatePassword`, `validateEmail` and three constants; every one of them
// had zero call sites in the whole repository, and it had been shipped on this
// package's public API throughout.
//
// It was not merely unused, it was WRONG, which is the reason it is gone rather
// than kept "for later". It declared `MIN_PASSWORD_LENGTH = 8` while the auth
// that actually runs — `apps/*/convex/auth.ts`, Better Auth through its Convex
// component — sets `minPasswordLength: 12`; its `authHooks` were five async
// functions whose entire bodies were a `console.info` and a list of TODOs, over
// names like "lock the account after N attempts" and "alert on brute-force
// attacks" that read as though something enforced them. A second, contradictory
// auth configuration on a published package is a trap for whoever reads it
// first and believes it.
//
// The session lifetime, the password rule and the OAuth providers are Better
// Auth's, configured where it is instantiated. Do not reintroduce a copy here.

// ============================================================================
// React client (hooks and components)
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
