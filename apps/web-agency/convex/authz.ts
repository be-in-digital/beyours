import { getAuthUserId } from "@convex-dev/auth/server";

import { Doc } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Gardes d'autorisation back-office. L'identité est TOUJOURS dérivée
 * server-side (`getAuthUserId`) — on n'accepte jamais un userId en argument.
 */

/** Retourne l'utilisateur authentifié, ou lève si non connecté. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Non authentifié");
  const user = await ctx.db.get("users", userId);
  if (!user) throw new Error("Utilisateur introuvable");
  return user;
}

/**
 * Garde d'accès back-office : exige un utilisateur avec un rôle ET actif.
 * À appeler en tête de CHAQUE query/mutation du back-office.
 */
export async function requireBackOfficeAccess(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.role || user.active !== true) {
    throw new Error("Accès non autorisé au back-office");
  }
  return user;
}

/** Exige un rôle owner/admin (gestion d'équipe, réglages sensibles). */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireBackOfficeAccess(ctx);
  if (user.role !== "owner" && user.role !== "admin") {
    throw new Error("Réservé aux administrateurs");
  }
  return user;
}
