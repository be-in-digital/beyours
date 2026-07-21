import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

/**
 * `viewer` — l'utilisateur courant (ou null). Sert au shell back-office pour
 * afficher l'identité et décider de l'affichage. Le contrôle d'accès DUR reste
 * server-side dans chaque fonction via `authz.requireBackOfficeAccess`.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role ?? null,
      hasAccess: Boolean(user.role) && user.active === true,
    };
  },
});

/**
 * `grantAccess` — bootstrap / gestion des accès. INTERNE : à appeler depuis le
 * dashboard/CLI Convex pour activer le premier owner :
 *   npx convex run users:grantAccess '{"email":"hello@beindigital.fr","role":"owner"}'
 * L'utilisateur doit d'abord avoir créé son compte (sign-up) pour exister.
 * Ensuite la gestion d'équipe se fera depuis l'UI (owner/admin).
 */
export const grantAccess = internalMutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) {
      throw new Error(
        `Aucun utilisateur avec l'email ${args.email}. Il doit d'abord créer son compte.`,
      );
    }
    await ctx.db.patch("users", user._id, { role: args.role, active: true });
    return user._id;
  },
});
