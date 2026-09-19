/**
 * Convex authorization helpers
 *
 * Bridges Better Auth identity with the RBAC system in @be-yours/core.
 * Call these from app-level mutation/query wrappers to enforce permissions.
 */

import { ConvexError } from "convex/values"
import { Role, hasPermission, type Permission } from "@be-yours/core/auth/rbac"
import { creatorAdministersNewStore } from "./profileProvisioning"
import { profileAllowsPermission } from "./teamAccess"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AuthUser {
  userId: string
  role: Role
  storeIds: string[]
  profileId: string
  /**
   * Module ids from the invite dialog's checkboxes. Empty means unrestricted —
   * see `profileAllowsPermission`, which owns the rule.
   */
  permissions: string[]
}

/* ------------------------------------------------------------------ */
/* Denials                                                             */
/* ------------------------------------------------------------------ */

/** Why a call was refused. The UI switches on these. */
export type DenialCode =
  | "not_authenticated"
  | "no_profile"
  | "store_not_granted"
  | "permission_denied"
  | "module_denied"
  | "staff_only"

/**
 * Refuse, in a way the person on the other end can act on.
 *
 * `ConvexError` appeared NOWHERE in this repository, and every guard here threw
 * a plain `Error`. Convex redacts those in production — the browser receives
 * "Server Error" — while the UI dutifully rendered `error.message`. So a
 * kitchen account opening the settings screen, an owner whose profile was never
 * provisioned, and a genuine backend fault all produced the same two words.
 * Every authorisation answer looked like a bug in the product.
 *
 * `data` survives the redaction. The `message` stays in French because it is
 * shown as-is when a screen has no copy of its own; the `code` is what a screen
 * switches on. `details` carries the machine-readable specifics for logs — it
 * is deliberately not sentence material.
 */
export function denied(
  code: DenialCode,
  message: string,
  details?: Record<string, string>
): ConvexError<{ code: DenialCode; message: string } & Record<string, string>> {
  return new ConvexError({ code, message, ...(details ?? {}) })
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
    throw denied("not_authenticated", "Not authenticated : connectez-vous pour continuer.")
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", identity.subject))
    .unique()

  if (!profile) {
    // Not a fault: it is the state of every account on a deployment whose first
    // administrator was never appointed. `/setup` is the way out, and the UI
    // can only say so if it can tell this apart from a crash.
    throw denied(
      "no_profile",
      "User profile not found : aucun rôle n'est attribué à ce compte."
    )
  }

  const role = Object.values(Role).includes(profile.role as Role)
    ? (profile.role as Role)
    : Role.CUSTOMER

  return {
    userId: identity.subject,
    role,
    storeIds: profile.storeIds ?? [],
    profileId: profile._id as string,
    permissions: profile.permissions ?? [],
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
    throw denied(
      "store_not_granted",
      "Access denied : vous n'avez pas accès à cet établissement.",
      { storeId }
    )
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
    throw denied(
      "permission_denied",
      `Access denied : votre rôle ne permet pas cette action (lacks permission ${permission}).`,
      { role: user.role, permission }
    )
  }

  // The second gate, and the one that was missing entirely. The invite dialog
  // offers eight module checkboxes, stores them, and until now nothing read
  // them: an owner who unticked "Paramètres" for a waiter restricted nothing.
  // Modules can only NARROW what the role already granted, never widen it,
  // which is why this runs after the check above and not instead of it.
  if (!profileAllowsPermission({ role: user.role, permissions: user.permissions }, permission)) {
    throw denied(
      "module_denied",
      `Access denied : ce module ne vous a pas été accordé (${permission}).`,
      { permission }
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
    throw denied(
      "staff_only",
      "Access denied : cet espace est réservé à l'équipe."
    )
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
/* seesEveryStore                                                      */
/* ------------------------------------------------------------------ */

/**
 * Is this role's remit the whole chain, rather than a list of establishments?
 *
 * Only the super admin's is. Everyone else — the client admin included — sees
 * the establishments named on their own profile, which is the same list every
 * other guard already reads (`requireStoreAccess`, `assertCanManageMember`).
 *
 * WHY THIS EXISTS (#94): the administration list was gated on `requireStaff`
 * alone, so ANY staff role got the name, address, phone, email, opening hours
 * and delivery radius of every establishment of the chain — a kitchen account
 * in one restaurant could enumerate the others. The deployment model is one
 * Convex instance per client, so this was never a cross-client leak; it was an
 * employee of one restaurant reading their employer's others.
 *
 * A client admin holding an EMPTY store list therefore now sees nothing, where
 * before they saw everything. That is the intended reading — they administer
 * nothing yet — and the admin already has a screen for it: "Aucun
 * établissement / Créez votre premier établissement". Creating one grants it to
 * them (`grantCreatedStoreAccess`), and a super admin can hand over more.
 */
export function seesEveryStore(role: Role): boolean {
  return role === Role.SUPER_ADMIN
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
