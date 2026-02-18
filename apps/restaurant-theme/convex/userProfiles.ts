import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/userProfiles";

// === Queries ===

export const getByUserId = query(defs.getByUserId);

// === Mutations ===

export const upsert = mutation({
  args: defs.upsert.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Role escalation protection: prevent non-admin from setting admin roles
    const ADMIN_ROLES = ["super_admin", "client_admin"];
    if (ADMIN_ROLES.includes(args.role)) {
      // Check if current user is a super_admin
      const currentProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .first();

      if (!currentProfile || currentProfile.role !== "super_admin") {
        throw new Error("Only super_admin can assign admin roles");
      }
    }

    return defs.upsert.handler(ctx, args);
  },
});
