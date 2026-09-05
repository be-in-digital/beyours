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
 * Cleanup: deletes `payments` documents from an older schema (pre-orderId),
 * orphaned and impossible to migrate (TEST Stripe data from an earlier version —
 * amountMinor/provider/providerEventId fields, no orderId). Run it once while
 * schemaValidation is temporarily disabled, then redeploy with validation
 * turned back on.
 *   npx convex run migrations:deleteLegacyPayments
 */
export const deleteLegacyPayments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("payments").take(5000);
    let deleted = 0;
    for (const row of rows) {
      // Legacy marker: the current schema requires orderId (v.id("orders")).
      if ((row as Record<string, unknown>).orderId === undefined) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted, kept: rows.length - deleted, total: rows.length };
  },
});

/**
 * Cleanup: normalises the `users` table inherited from an older schema
 * (createdAt/fullName/planTier/role/locale/lastSeenAt fields absent from the
 * current Convex-Auth model). Deletes test users (email ending in `.test`, or
 * empty), and brings real accounts back to the auth shape (email/name/phone
 * are kept).
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
      if (!EXTRA.some((k) => k in doc)) continue; // already on the right schema
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


/**
 * Repair: reclassify orphaned in-app signature rows left by the old ordering.
 *
 * `signAffiliateContract` used to commit `status: "signed"` BEFORE generating
 * the PDF, with no duplicate guard, so a signatory whose name left
 * Windows-1252 produced one signed-looking row per attempt and never a
 * document. Those rows say a contract was signed that does not exist, which is
 * exactly the audit trail the eIDAS art. 25 claim in ./affiliateSignature.ts
 * rests on.
 *
 * They are marked `failed`, not deleted. An audit trail is repaired by making
 * it say what happened, not by removing the evidence that it went wrong — and
 * `contractSignatures.status` already has the literal for it.
 *
 * Safe to run more than once: a signed row WITH a document is never touched.
 *   npx convex run migrations:markOrphanSignaturesFailed
 */
export const markOrphanSignaturesFailed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CAP = 5000;
    const rows = await ctx.db.query("contractSignatures").take(CAP + 1);
    /* Says so rather than stopping quietly: a deployment past the cap would
       otherwise be told the repair is complete while orphans remain. */
    const truncated = rows.length > CAP;
    let marked = 0;
    for (const row of rows.slice(0, CAP)) {
      if (row.status !== "signed") continue;
      if (row.signedDocumentFileId !== undefined) continue;
      await ctx.db.patch(row._id, {
        status: "failed" as const,
        updatedAt: Date.now(),
      });
      marked++;
    }
    if (truncated) {
      console.warn(
        `[markOrphanSignaturesFailed] more than ${CAP} rows: run again, the repair is incomplete`,
      );
    }
    return { marked, scanned: Math.min(rows.length, CAP), truncated };
  },
});
