import { query, mutation, internalMutation } from "./_generated/server";
import * as defs from "@be-in-digital/convex-functions/userProfiles";
import { getAuthUser } from "@be-in-digital/convex-functions/auth";
import {
  assertCanAssignProfile,
  canClaimFirstAdmin,
} from "@be-in-digital/convex-functions/profileProvisioning";
import { Role } from "@be-in-digital/core/auth/rbac";

// === Queries ===
//
// NOTE: `getByUserId` used to be exported here as a bare `query(defs.getByUserId)`.
// Its core performs no identity check at all, so anyone could read any user's
// role, permissions and store list by guessing a user id. Its only caller —
// `AdminAuthSync` — was reading the *current* user's own profile, which is what
// `getMyProfile` below does safely.

/**
 * Get the authenticated user's own profile.
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();
  },
});

// === Mutations ===

/**
 * Create or update another user's profile.
 *
 * The previous guard only rejected the literal strings "super_admin" and
 * "client_admin", so `manager` — which carries products, orders and customers
 * write access — passed straight through, on any store id the caller chose.
 * The whole policy now lives in `assertCanAssignProfile`.
 */
export const upsert = mutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    const actor = await getAuthUser(ctx);

    assertCanAssignProfile({
      actor: {
        userId: actor.userId,
        role: actor.role,
        storeIds: actor.storeIds,
      },
      target: {
        userId: args.userId,
        role: args.role as Role,
        storeIds: args.storeIds,
        permissions: args.permissions,
      },
    });

    return defs.upsert.handler(ctx, args);
  },
});

/**
 * Claim the first super-admin seat on a deployment that has none.
 *
 * Provisioning requires a super admin, and a fresh deployment starts without
 * one — previously there was no way to appoint the first administrator short of
 * editing the database directly. The claim is self-closing: once a super admin
 * exists this always throws, so it cannot be replayed.
 */
export const claimFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const superAdmins = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("role"), Role.SUPER_ADMIN))
      .collect();

    if (!canClaimFirstAdmin({ existingSuperAdminCount: superAdmins.length })) {
      throw new Error(
        "Un super administrateur existe déjà sur ce déploiement."
      );
    }

    // Reuse the shared upsert so the profile is built with every field the
    // schema requires, rather than a second hand-rolled insert that drifts.
    return defs.upsert.handler(ctx, {
      userId: identity.subject,
      role: Role.SUPER_ADMIN,
      storeIds: [],
      permissions: [],
    });
  },
});

/**
 * Update own profile (customer-facing: phones, language, avatar)
 */
export const updateMyProfile = mutation({
  args: {
    phones: defs.updateProfile.args.phones,
    language: defs.updateProfile.args.language,
    avatarUrl: defs.updateProfile.args.avatarUrl,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return defs.updateProfile.handler(ctx, {
      userId: identity.subject,
      ...args,
    });
  },
});

// === Internal ===

/**
 * Provision a profile without an authenticated actor.
 *
 * Internal only — reachable from seed scripts and server-side flows through the
 * deploy key, never from a browser.
 */
export const internalUpsert = internalMutation(defs.upsert);
