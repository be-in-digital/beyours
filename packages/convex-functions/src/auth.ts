/**
 * Convex authorization helpers
 *
 * Bridges Better Auth identity with the RBAC system in @beindigital-engine/core.
 * Call these from app-level mutation/query wrappers to enforce permissions.
 */

import { Role, hasPermission, type Permission } from "@beindigital-engine/core/auth/rbac"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AuthUser {
  userId: string
  role: Role
  storeIds: string[]
  profileId: string
}

/* ------------------------------------------------------------------ */
/* getAuthUser                                                         */
/* ------------------------------------------------------------------ */

/**
 * Resolve the authenticated user's profile from Better Auth identity.
 * Throws if not authenticated or if no userProfile exists.
 */
export async function getAuthUser(ctx: any): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Not authenticated")
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", identity.subject))
    .unique()

  if (!profile) {
    throw new Error("User profile not found")
  }

  const role = Object.values(Role).includes(profile.role as Role)
    ? (profile.role as Role)
    : Role.CUSTOMER

  return {
    userId: identity.subject,
    role,
    storeIds: profile.storeIds ?? [],
    profileId: profile._id as string,
  }
}

/* ------------------------------------------------------------------ */
/* requireStoreAccess                                                  */
/* ------------------------------------------------------------------ */

/**
 * Verify the user is authenticated AND has access to the given store.
 * Super admins bypass the storeIds check.
 * In mono-tenant mode (1 Convex instance = 1 restaurant), users with
 * no storeIds assigned yet are granted access to all stores.
 */
export async function requireStoreAccess(
  ctx: any,
  storeId: string,
): Promise<AuthUser> {
  const user = await getAuthUser(ctx)

  if (user.role === Role.SUPER_ADMIN) return user

  // No storeIds restriction = mono-tenant, access all stores
  if (user.storeIds.length === 0) return user

  if (!user.storeIds.includes(storeId)) {
    throw new Error("Access denied: you do not have access to this store")
  }

  return user
}

/* ------------------------------------------------------------------ */
/* requireStorePermission                                              */
/* ------------------------------------------------------------------ */

/**
 * Verify the user is authenticated, has access to the store,
 * AND has the required RBAC permission.
 */
export async function requireStorePermission(
  ctx: any,
  storeId: string,
  permission: Permission,
): Promise<AuthUser> {
  const user = await requireStoreAccess(ctx, storeId)

  if (!hasPermission(user.role, permission)) {
    throw new Error(
      `Access denied: role "${user.role}" lacks permission "${permission}"`,
    )
  }

  return user
}
