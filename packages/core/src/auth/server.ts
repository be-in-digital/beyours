/**
 * Utilitaires auth côté serveur (Next.js Server Components, API Routes, Middleware)
 *
 * NOTE: Après installation de better-auth, importer:
 * - import { auth } from './config' // Instance Better Auth
 * - import { headers, cookies } from 'next/headers'
 */

import { type Permission, type Role, hasPermission, PermissionDeniedError } from './rbac';
import type { AuthSessionData, AuthUser, AuthSession } from './types';

/**
 * Erreur levée lorsqu'un utilisateur n'est pas authentifié
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Authentification requise') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Erreur levée lorsqu'un utilisateur n'a pas le rôle requis
 */
export class ForbiddenError extends Error {
  constructor(
    public requiredRole: Role,
    public userRole?: Role
  ) {
    super(
      userRole
        ? `Rôle "${requiredRole}" requis, vous avez le rôle "${userRole}"`
        : `Rôle "${requiredRole}" requis`
    );
    this.name = 'ForbiddenError';
  }
}

/**
 * Récupère la session serveur depuis les cookies
 *
 * @returns Session avec utilisateur ou null si non connecté
 *
 * @example
 * ```ts
 * // Dans un Server Component
 * export default async function DashboardPage() {
 *   const session = await getServerSession()
 *   if (!session) redirect('/auth/signin')
 *   return <div>Bonjour {session.user.name}</div>
 * }
 * ```
 *
 * NOTE: Après installation, utiliser:
 * - const session = await auth.api.getSession({ headers: headers() })
 */
export async function getServerSession(): Promise<AuthSessionData | null> {
  // TODO: Implémenter avec Better Auth après installation
  // const session = await auth.api.getSession({
  //   headers: headers(),
  // })
  // return session

  throw new Error(
    'getServerSession: Better Auth non installé. Installez better-auth'
  );
}

/**
 * Récupère l'utilisateur serveur depuis la session
 *
 * @returns Utilisateur connecté ou null
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
 * Middleware qui requiert l'authentification
 * Throw une erreur si l'utilisateur n'est pas connecté
 *
 * @returns Session garantie non-null
 * @throws {UnauthorizedError} Si non authentifié
 *
 * @example
 * ```ts
 * // Dans une API Route
 * export async function GET() {
 *   const session = await requireAuth()
 *   // session est garanti non-null ici
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
 * Middleware qui requiert un rôle spécifique
 * Throw une erreur si l'utilisateur n'a pas le rôle
 *
 * @param role - Rôle requis
 * @returns Session avec utilisateur du bon rôle
 * @throws {UnauthorizedError} Si non authentifié
 * @throws {ForbiddenError} Si rôle incorrect
 *
 * @example
 * ```ts
 * // API Route réservée aux managers
 * export async function POST() {
 *   await requireRole(Role.MANAGER)
 *   // Code réservé aux managers
 * }
 * ```
 */
export async function requireRole(role: Role): Promise<AuthSessionData> {
  const session = await requireAuth();

  if (session.user.role !== role) {
    throw new ForbiddenError(role, session.user.role);
  }

  return session;
}

/**
 * Middleware qui requiert au moins un des rôles
 * Throw une erreur si l'utilisateur n'a aucun des rôles
 *
 * @param roles - Liste des rôles acceptés
 * @returns Session avec utilisateur ayant un des rôles
 * @throws {UnauthorizedError} Si non authentifié
 * @throws {ForbiddenError} Si aucun rôle ne correspond
 *
 * @example
 * ```ts
 * // API Route pour le staff
 * export async function GET() {
 *   await requireAnyRole([Role.MANAGER, Role.WAITER, Role.KITCHEN])
 *   // Code pour le staff
 * }
 * ```
 */
export async function requireAnyRole(roles: Role[]): Promise<AuthSessionData> {
  const session = await requireAuth();

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
 * Middleware qui requiert une permission spécifique
 * Throw une erreur si l'utilisateur n'a pas la permission
 *
 * @param permission - Permission requise
 * @returns Session avec utilisateur ayant la permission
 * @throws {UnauthorizedError} Si non authentifié
 * @throws {PermissionDeniedError} Si permission manquante
 *
 * @example
 * ```ts
 * // API Route pour supprimer un produit
 * export async function DELETE() {
 *   await requirePermission('products:delete')
 *   // Code de suppression
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
 * Middleware qui requiert au moins une des permissions
 *
 * @param permissions - Liste des permissions (au moins une requise)
 * @returns Session avec utilisateur ayant au moins une permission
 * @throws {UnauthorizedError} Si non authentifié
 * @throws {PermissionDeniedError} Si aucune permission
 *
 * @example
 * ```ts
 * export async function GET() {
 *   await requireAnyPermissionGuard(['orders:read', 'orders:write'])
 *   // Code avec accès lecture ou écriture
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
 * Middleware qui requiert toutes les permissions
 *
 * @param permissions - Liste des permissions (toutes requises)
 * @returns Session avec utilisateur ayant toutes les permissions
 * @throws {UnauthorizedError} Si non authentifié
 * @throws {PermissionDeniedError} Si permission manquante
 *
 * @example
 * ```ts
 * export async function PUT() {
 *   await requireAllPermissionsGuard(['products:read', 'products:write'])
 *   // Code avec accès complet
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
 * Vérifie si l'utilisateur a accès à un restaurant spécifique
 *
 * @param session - Session de l'utilisateur
 * @param restaurantId - ID du restaurant à vérifier
 * @returns `true` si accès autorisé
 *
 * @example
 * ```ts
 * const session = await requireAuth()
 * if (!canAccessRestaurant(session, restaurantId)) {
 *   throw new ForbiddenError('Accès refusé à ce restaurant')
 * }
 * ```
 */
export function canAccessRestaurant(
  session: AuthSessionData,
  restaurantId: string
): boolean {
  // Super admin a accès à tout
  if (session.user.role === 'super_admin') {
    return true;
  }

  // Customer n'a pas accès aux restaurants
  if (session.user.role === 'customer') {
    return false;
  }

  // Autres rôles : vérifier le restaurantId
  return session.user.restaurantId === restaurantId;
}

/**
 * Middleware qui requiert l'accès à un restaurant
 *
 * @param restaurantId - ID du restaurant
 * @returns Session avec accès au restaurant
 * @throws {UnauthorizedError} Si non authentifié
 * @throws {ForbiddenError} Si pas d'accès au restaurant
 *
 * @example
 * ```ts
 * export async function GET(
 *   req: Request,
 *   { params }: { params: { restaurantId: string } }
 * ) {
 *   const session = await requireRestaurantAccess(params.restaurantId)
 *   // Code avec accès au restaurant
 * }
 * ```
 */
export async function requireRestaurantAccess(
  restaurantId: string
): Promise<AuthSessionData> {
  const session = await requireAuth();

  if (!canAccessRestaurant(session, restaurantId)) {
    throw new ForbiddenError(
      session.user.role,
      session.user.role
    );
  }

  return session;
}

/**
 * Helper pour gérer les erreurs auth dans les API Routes
 *
 * @param error - Erreur à gérer
 * @returns Response avec le bon status code
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

  // Erreur inconnue
  console.error('Auth error:', error);
  return Response.json(
    { error: 'Une erreur est survenue' },
    { status: 500 }
  );
}

/**
 * HOF pour wrapper une API Route avec authentification
 *
 * @param handler - Handler de l'API Route
 * @param options - Options de protection
 * @returns Handler protégé
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
export function withAuthRoute<T extends any[]>(
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
      // Vérifier authentification
      const session = await requireAuth();

      // Vérifier rôle si requis
      if (options?.requireRole && session.user.role !== options.requireRole) {
        throw new ForbiddenError(options.requireRole, session.user.role);
      }

      // Vérifier permission si requise
      if (
        options?.requirePermission &&
        !hasPermission(session.user.role, options.requirePermission)
      ) {
        throw new PermissionDeniedError(
          options.requirePermission,
          session.user.role
        );
      }

      // Appeler le handler
      return await handler(request, session, ...args);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}
