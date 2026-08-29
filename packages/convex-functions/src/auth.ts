/**
 * Convex authorization helpers
 *
 * Bridges Better Auth identity with the RBAC system in @be-in-digital/core.
 * Call these from app-level mutation/query wrappers to enforce permissions.
 */

import { Role, hasPermission, type Permission } from "@be-in-digital/core/auth/rbac"
import { creatorAdministersNewStore } from "./profileProvisioning"

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
 */
export async function requireStoreAccess(
  ctx: any,
  storeId: string,
): Promise<AuthUser> {
  const user = await getAuthUser(ctx)

  if (user.role === Role.SUPER_ADMIN) return user

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

/* ------------------------------------------------------------------ */
/* requireStaff                                                        */
/* ------------------------------------------------------------------ */

/**
 * Verify the caller belongs in the administration at all.
 *
 * A few admin reads span every establishment and so have no store to scope to —
 * the list `StoreGuard` and the sidebar selector are built from, for one. The
 * admin's `AuthGuard` only checks that somebody is signed in, so
 * "authenticated" on its own would let any customer account read them.
 *
 * The gate is deliberately not `stores:read`: the kitchen and delivery roles do
 * not hold that permission and still have to reach the KDS, which renders
 * behind `StoreGuard`. Every role but `customer` has a dashboard to look at.
 */
export async function requireStaff(ctx: any): Promise<AuthUser> {
  const user = await getAuthUser(ctx)

  if (user.role === Role.CUSTOMER) {
    throw new Error("Access denied: staff only")
  }

  return user
}

/**
 * The same question, asked without demanding an answer.
 *
 * `requireStaff` throws, which is right for a query that belongs to the
 * administration. It is wrong for a query the storefront and the administration
 * *share* — `stores.getById` is read by an anonymous visitor's checkout page and
 * by the KDS, and it has to answer both without refusing either. Being a
 * customer, or nobody at all, is a legitimate answer here rather than an error.
 */
export async function isStaff(ctx: any): Promise<boolean> {
  try {
    const user = await getAuthUser(ctx)
    return user.role !== Role.CUSTOMER
  } catch {
    // Not signed in, or signed in with no profile yet. Neither is staff.
    return false
  }
}

/* ------------------------------------------------------------------ */
/* grantCreatedStoreAccess                                             */
/* ------------------------------------------------------------------ */

/**
 * Make the creator of an establishment an administrator of it.
 *
 * Call it from inside `stores.create`, with the id the insert just returned.
 * `creatorAdministersNewStore` (./profileProvisioning) holds the rule and the
 * reasoning; this only carries it out.
 *
 * It resolves the caller softly rather than through `getAuthUser`, which throws
 * on a missing session or profile. `stores.create` is reachable from seeds,
 * imports and restores that legitimately run without one, and refusing to
 * create the establishment because nobody could be granted it would be a
 * strictly worse failure than creating it unassigned.
 *
 * Returns whether the profile was changed, which is what the tests assert on.
 */
export async function grantCreatedStoreAccess(
  ctx: any,
  storeId: string,
): Promise<boolean> {
  const identity = await ctx.auth?.getUserIdentity?.()
  if (!identity?.subject) return false

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", identity.subject))
    .unique()
  if (!profile) return false

  const role = Object.values(Role).includes(profile.role as Role)
    ? (profile.role as Role)
    : Role.CUSTOMER
  if (!creatorAdministersNewStore(role)) return false

  const storeIds: string[] = profile.storeIds ?? []
  if (storeIds.includes(storeId)) return false

  await ctx.db.patch(profile._id, {
    storeIds: [...storeIds, storeId],
    updatedAt: Date.now(),
  })
  return true
}
