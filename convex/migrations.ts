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
