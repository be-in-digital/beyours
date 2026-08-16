/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  🛡️ Auth Server                                             │
 * │  Server-side auth guards for Next.js Server Components,     │
 * │  API Routes, and Middleware. Role & permission checks.       │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { requireAuth, requireRole }               │      │
 * │  │   from '@repo/core/auth'                          │      │
 * │  │                                                   │      │
 * │  │ export async function GET() {                     │      │
 * │  │   const session = await requireAuth()             │      │
 * │  │   return Response.json({ userId: session.user.id })│     │
 * │  │ }                                                 │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { type Permission, type Role, hasPermission, PermissionDeniedError } from './rbac';
import type { AuthSessionData, AuthUser, AuthSession } from './types';

/**
 * Thrown when a user is not authenticated
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Thrown when a user does not hold the required role
 */
export class ForbiddenError extends Error {
  constructor(
    public requiredRole: Role,
    public userRole?: Role
  ) {
    super(
      userRole
        ? `Role "${requiredRole}" required, you have "${userRole}"`
        : `Role "${requiredRole}" required`
    );
    this.name = 'ForbiddenError';
  }
}

/**
 * Reads the server session from the cookies
 *
 * @returns The session with its user, or null when signed out
 *
 * @example
 * ```ts
 * // In a Server Component
 * export default async function DashboardPage() {
 *   const session = await getServerSession()
 *   if (!session) redirect('/auth/signin')
 *   return <div>Hello {session.user.name}</div>
 * }
 * ```
 *
 * NOTE: once installed, use:
 * - const session = await auth.api.getSession({ headers: headers() })
 */
export async function getServerSession(): Promise<AuthSessionData | null> {
  // TODO: implement with Better Auth once installed
  // const session = await auth.api.getSession({
  //   headers: headers(),
  // })
  // return session

  throw new Error(
    'getServerSession: Better Auth is not installed. Install better-auth'
  );
}

/**
 * Reads the server user from the session
 *
 * @returns The signed-in user, or null
 *
 * @example
 * ```ts
 * export default async function ProfilePage() {
 *   const user = await getServerUser()
 *   if (!user) redirect('/auth/signin')
 *   return <UserProfile user={user} />
 * }
 * ```
 */
export async function getServerUser(): Promise<AuthUser | null> {
  const session = await getServerSession();
  return session?.user ?? null;
}

/**
 * Requires authentication.
 * Throws when the user is not signed in.
 *
 * @returns A session guaranteed to be non-null
 * @throws {UnauthorizedError} When not authenticated
 *
 * @example
 * ```ts
 * // In an API Route
 * export async function GET() {
 *   const session = await requireAuth()
 *   // session is guaranteed non-null here
 *   return Response.json({ userId: session.user.id })
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthSessionData> {
  const session = await getServerSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}

/**
 * Requires a specific role.
 * Throws when the user does not hold it.
 *
 * @param role - The required role
 * @returns The session, with a user holding that role
 * @throws {UnauthorizedError} When not authenticated
 * @throws {ForbiddenError} When the role does not match
 *
 * @example
 * ```ts
 * // API Route restricted to managers
 * export async function POST() {
 *   await requireRole(Role.MANAGER)
 *   // Manager-only code
 * }
 * ```
 */
export async function requireRole(role: Role): Promise<AuthSessionData> {
  const session = await requireAuth();

  // Super admin bypasses all role checks
  if (session.user.role === 'super_admin') {
    return session;
  }

  if (session.user.role !== role) {
    throw new ForbiddenError(role, session.user.role);
  }

  return session;
}

/**
 * Requires at least one of the given roles.
 * Throws when the user holds none of them.
 *
 * @param roles - The accepted roles
 * @returns The session, with a user holding one of them
 * @throws {UnauthorizedError} When not authenticated
 * @throws {ForbiddenError} When no role matches
 *
 * @example
 * ```ts
 * // API Route for staff
 * export async function GET() {
 *   await requireAnyRole([Role.MANAGER, Role.WAITER, Role.KITCHEN])
 *   // Staff-only code
 * }
 * ```
 */
export async function requireAnyRole(roles: Role[]): Promise<AuthSessionData> {
  const session = await requireAuth();

  // Super admin bypasses all role checks
  if (session.user.role === 'super_admin') {
    return session;
  }

  if (!roles.includes(session.user.role)) {
    const firstRole = roles[0];
    if (!firstRole) {
      throw new ForbiddenError('super_admin' as Role, session.user.role);
    }
    throw new ForbiddenError(firstRole, session.user.role);
  }

  return session;
}

/**
 * Requires a specific permission.
 * Throws when the user does not hold it.
 *
 * @param permission - The required permission
 * @returns The session, with a user holding that permission
 * @throws {UnauthorizedError} When not authenticated
 * @throws {PermissionDeniedError} When the permission is missing
 *
 * @example
 * ```ts
 * // API Route deleting a product
 * export async function DELETE() {
 *   await requirePermission('products:delete')
 *   // Deletion code
 * }
 * ```
 */
export async function requirePermissionGuard(
  permission: Permission
): Promise<AuthSessionData> {
  const session = await requireAuth();

  if (!hasPermission(session.user.role, permission)) {
    throw new PermissionDeniedError(permission, session.user.role);
  }

  return session;
}

/**
 * Requires at least one of the given permissions.
 *
 * @param permissions - The permissions, at least one of which is required
 * @returns The session, with a user holding at least one
 * @throws {UnauthorizedError} When not authenticated
 * @throws {PermissionDeniedError} When none is held
 *
 * @example
 * ```ts
 * export async function GET() {
 *   await requireAnyPermissionGuard(['orders:read', 'orders:write'])
 *   // Code needing read or write access
 * }
 * ```
 */
export async function requireAnyPermissionGuard(
  permissions: Permission[]
): Promise<AuthSessionData> {
  const session = await requireAuth();

  const hasAny = permissions.some((perm) =>
    hasPermission(session.user.role, perm)
  );

  if (!hasAny) {
    const firstPermission = permissions[0];
    if (!firstPermission) {
      throw new PermissionDeniedError('stores:read', session.user.role);
    }
    throw new PermissionDeniedError(firstPermission, session.user.role);
  }

  return session;
}

/**
 * Requires every one of the given permissions.
 *
 * @param permissions - The permissions, all of which are required
 * @returns The session, with a user holding all of them
 * @throws {UnauthorizedError} When not authenticated
 * @throws {PermissionDeniedError} When the permission is missing
 *
 * @example
 * ```ts
 * export async function PUT() {
 *   await requireAllPermissionsGuard(['products:read', 'products:write'])
 *   // Code needing full access
 * }
 * ```
 */
export async function requireAllPermissionsGuard(
  permissions: Permission[]
): Promise<AuthSessionData> {
  const session = await requireAuth();

  for (const permission of permissions) {
    if (!hasPermission(session.user.role, permission)) {
      throw new PermissionDeniedError(permission, session.user.role);
    }
  }

  return session;
}

/**
 * Whether the user may access a given restaurant
 *
 * @param session - The user's session
 * @param restaurantId - The restaurant to check
 * @returns `true` when access is allowed
 *
 * @example
 * ```ts
 * const session = await requireAuth()
 * if (!canAccessRestaurant(session, restaurantId)) {
 *   throw new ForbiddenError('Access denied to this restaurant')
 * }
 * ```
 */
export function canAccessRestaurant(
  session: AuthSessionData,
  restaurantId: string
): boolean {
  // Super admin has access to everything
  if (session.user.role === 'super_admin') {
    return true;
  }

  // Customers have no restaurant access
  if (session.user.role === 'customer') {
    return false;
  }

  // Other roles: check the restaurantId
  return session.user.restaurantId === restaurantId;
}

/**
 * Requires access to a given restaurant.
 *
 * @param restaurantId - The restaurant
 * @returns The session, with access to that restaurant
 * @throws {UnauthorizedError} When not authenticated
 * @throws {ForbiddenError} When access is denied
 *
 * @example
 * ```ts
 * export async function GET(
 *   req: Request,
 *   { params }: { params: { restaurantId: string } }
 * ) {
 *   const session = await requireRestaurantAccess(params.restaurantId)
 *   // Code needing restaurant access
 * }
 * ```
 */
export async function requireRestaurantAccess(
  restaurantId: string
): Promise<AuthSessionData> {
  const session = await requireAuth();

  if (!canAccessRestaurant(session, restaurantId)) {
    throw new ForbiddenError(
      session.user.role === 'customer' ? 'manager' as Role : 'super_admin' as Role,
      session.user.role
    );
  }

  return session;
}

/**
 * Maps auth errors onto HTTP responses, for use in API Routes
 *
 * @param error - The error to map
 * @returns A Response carrying the right status code
 *
 * @example
 * ```ts
 * export async function GET() {
 *   try {
 *     const session = await requireAuth()
 *     return Response.json({ data: '...' })
 *   } catch (error) {
 *     return handleAuthError(error)
 *   }
 * }
 * ```
 */
export function handleAuthError(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      { error: error.message },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return Response.json(
      { error: error.message },
      { status: 403 }
    );
  }

  if (error instanceof PermissionDeniedError) {
    return Response.json(
      { error: error.message },
      { status: 403 }
    );
  }

  // Unknown error
  console.error('Auth error:', error);
  return Response.json(
    { error: 'Something went wrong' },
    { status: 500 }
  );
}

/**
 * Higher-order function wrapping an API Route with authentication
 *
 * @param handler - The API Route handler
 * @param options - Protection options
 * @returns The protected handler
 *
 * @example
 * ```ts
 * export const GET = withAuthRoute(
 *   async (req, session) => {
 *     return Response.json({ userId: session.user.id })
 *   },
 *   { requireRole: Role.MANAGER }
 * )
 * ```
 */
export function withAuthRoute<T extends unknown[]>(
  handler: (
    request: Request,
    session: AuthSessionData,
    ...args: T
  ) => Promise<Response>,
  options?: {
    requireRole?: Role;
    requirePermission?: Permission;
  }
) {
  return async (request: Request, ...args: T): Promise<Response> => {
    try {
      // Check authentication
      const session = await requireAuth();

      // Check the role if required (super_admin bypasses)
      if (options?.requireRole && session.user.role !== 'super_admin' && session.user.role !== options.requireRole) {
        throw new ForbiddenError(options.requireRole, session.user.role);
      }

      // Check the permission if required
      if (
        options?.requirePermission &&
        !hasPermission(session.user.role, options.requirePermission)
      ) {
        throw new PermissionDeniedError(
          options.requirePermission,
          session.user.role
        );
      }

      // Call the handler
      return await handler(request, session, ...args);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}
