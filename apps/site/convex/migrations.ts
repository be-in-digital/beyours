import { internalMutation, internalQuery } from "./_generated/server";

/** Debug: list all affiliate users with their emails */
export const listAffiliateEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const affiliates = await ctx.db.query("affiliateUsers").take(200);
    const result = [];
    for (const a of affiliates) {
      const user = await ctx.db.get(a.userId);
      result.push({
        id: a._id,
        userId: a.userId,
        email: (user as Record<string, unknown>)?.email ?? "unknown",
        contractStatus: a.contractStatus,
        firstName: a.firstName,
        lastName: a.lastName,
      });
    }
    return result;
  },
});

/**
 * Migration: Add contractStatus to existing affiliateUsers.
 * Existing active affiliates get "active" contractStatus (grandfathered in).
 * Run once via dashboard: internal.migrations.addContractStatusToAffiliates
 */
export const addContractStatusToAffiliates = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Use raw query since existing docs may not match new schema
    const affiliates = await ctx.db.query("affiliateUsers").take(500);
    let patched = 0;

    for (const affiliate of affiliates) {
      const doc = affiliate as Record<string, unknown>;
      if (!doc.contractStatus) {
        await ctx.db.patch(affiliate._id, {
          contractStatus: "active" as const,
        });
        patched++;
      }
    }

    return { patched, total: affiliates.length };
  },
});

/**
 * Cleanup: supprime les documents `payments` d'un ancien schéma (pré-orderId),
 * orphelins et non migrables (données Stripe TEST d'une version antérieure —
 * champs amountMinor/provider/providerEventId, sans orderId). À lancer une fois
 * pendant que schemaValidation est temporairement désactivé, puis re-déployer
 * avec la validation réactivée.
 *   npx convex run migrations:deleteLegacyPayments
 */
export const deleteLegacyPayments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("payments").take(5000);
    let deleted = 0;
    for (const row of rows) {
      // Marqueur legacy : le schéma courant impose orderId (v.id("orders")).
      if ((row as Record<string, unknown>).orderId === undefined) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted, kept: rows.length - deleted, total: rows.length };
  },
});

/**
 * Cleanup: normalise la table `users` héritée d'un ancien schéma (champs
 * createdAt/fullName/planTier/role/locale/lastSeenAt absents du modèle
 * Convex-Auth actuel). Supprime les users de test (email en `.test` ou vide),
 * ramène les comptes réels à la forme auth (email/name/phone conservés).
 *   npx convex run migrations:cleanupLegacyUsers --prod
 */
export const cleanupLegacyUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("users").take(5000);
    const EXTRA = [
      "createdAt",
      "fullName",
      "lastSeenAt",
      "locale",
      "planTier",
      "role",
    ];
    let deleted = 0;
    let normalized = 0;
    for (const row of rows) {
      const doc = row as Record<string, unknown>;
      if (!EXTRA.some((k) => k in doc)) continue; // déjà au bon schéma
      const email = typeof doc.email === "string" ? doc.email : "";
      if (email === "" || email.endsWith(".test")) {
        await ctx.db.delete(row._id);
        deleted++;
      } else {
        await ctx.db.replace(row._id, {
          email,
          name:
            typeof doc.name === "string"
              ? doc.name
              : typeof doc.fullName === "string"
                ? doc.fullName
                : undefined,
          phone: typeof doc.phone === "string" ? doc.phone : undefined,
        });
        normalized++;
      }
    }
    return { deleted, normalized, total: rows.length };
  },
});
