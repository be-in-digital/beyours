import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

/* ── Public queries ── */

/** Get the current user's pending or latest signature for a contract version */
export const getMyPendingSignature = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate || !affiliate.requiredContractVersionId) return null;

    // Find pending signature for the required version
    const signatures = await ctx.db
      .query("contractSignatures")
      .withIndex("by_affiliateUserId_and_contractVersionId", (q) =>
        q
          .eq("affiliateUserId", affiliate._id)
          .eq("contractVersionId", affiliate.requiredContractVersionId!),
      )
      .order("desc")
      .take(5);

    // Return the pending one if it exists, otherwise the latest
    const pending = signatures.find((s) => s.status === "pending");
    return pending ?? signatures[0] ?? null;
  },
});

/** Get all my signatures (history) */
export const getMySignatures = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return [];

    return await ctx.db
      .query("contractSignatures")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .order("desc")
      .take(20);
  },
});

/** Download URL for the current user's latest signed contract (in-app SES). */
export const getSignedContractUrl = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    /* Same reason as `findSignedSignature` below: on a deployment that ran the
       old ordering, ten legacy orphans would fill a ten-row window and hide the
       affiliate's real contract from them. The conditions belong in the query. */
    const signed = await ctx.db
      .query("contractSignatures")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "signed"),
          q.neq(q.field("signedDocumentFileId"), undefined),
        ),
      )
      .order("desc")
      .first();
    if (!signed?.signedDocumentFileId) return null;

    const url = await ctx.storage.getUrl(
      signed.signedDocumentFileId as Id<"_storage">,
    );
    return url ? { url, signedAt: signed.signedAt ?? null } : null;
  },
});

/* ── Public mutations ── */

/** Create a signature request (called before Yousign API) */
export const createSignatureRequest = mutation({
  args: {
    contractVersionId: v.id("contractVersions"),
    contractSnapshotContent: v.string(),
    contractSnapshotHash: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    // Check if a pending signature already exists for this version
    const existing = await ctx.db
      .query("contractSignatures")
      .withIndex("by_affiliateUserId_and_contractVersionId", (q) =>
        q
          .eq("affiliateUserId", affiliate._id)
          .eq("contractVersionId", args.contractVersionId),
      )
      .order("desc")
      .take(5);

    const pending = existing.find((s) => s.status === "pending");
    if (pending) {
      return pending._id;
    }

    const now = Date.now();
    return await ctx.db.insert("contractSignatures", {
      affiliateUserId: affiliate._id,
      contractVersionId: args.contractVersionId,
      status: "pending",
      contractSnapshotContent: args.contractSnapshotContent,
      contractSnapshotHash: args.contractSnapshotHash,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/* ── Internal queries ── */

export const getById = internalQuery({
  args: { id: v.id("contractSignatures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/* ── Internal mutations ── */

export const updateStatus = internalMutation({
  args: {
    signatureId: v.id("contractSignatures"),
    status: v.union(
      v.literal("pending"),
      v.literal("signed"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("canceled"),
      v.literal("failed"),
    ),
    signedAt: v.optional(v.number()),
    signerIp: v.optional(v.string()),
    signedDocumentFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.signedAt) patch.signedAt = args.signedAt;
    if (args.signerIp) patch.signerIp = args.signerIp;
    if (args.signedDocumentFileId)
      patch.signedDocumentFileId = args.signedDocumentFileId;
    await ctx.db.patch(args.signatureId, patch);
  },
});

/**
 * Find the signature already on file for this affiliate and contract version,
 * or `null`. A signature counts only when it carries its signed document: a row
 * without one is not evidence of anything.
 *
 * Read by the action BEFORE it spends time generating a PDF, and again inside
 * `recordInAppSignature` — a check outside a transaction is a hint, not a
 * guard, and only the one inside the mutation decides.
 *
 * NOT `.take(n).find(…)`. A deployment that ran the old ordering carries one
 * orphan — `status: "signed"`, no document — per failed attempt, and they sort
 * ahead of the real signature. A window of any size is a window the orphans can
 * fill, so the two conditions go into the query and the database walks past
 * them.
 */
async function findSignedSignature(
  ctx: QueryCtx,
  affiliateUserId: Id<"affiliateUsers">,
  contractVersionId: Id<"contractVersions">,
): Promise<Doc<"contractSignatures"> | null> {
  return await ctx.db
    .query("contractSignatures")
    .withIndex("by_affiliateUserId_and_contractVersionId", (q) =>
      q
        .eq("affiliateUserId", affiliateUserId)
        .eq("contractVersionId", contractVersionId),
    )
    .filter((q) =>
      q.and(
        q.eq(q.field("status"), "signed"),
        q.neq(q.field("signedDocumentFileId"), undefined),
      ),
    )
    .order("desc")
    .first();
}

export const findSignedSignatureInternal = internalQuery({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    contractVersionId: v.id("contractVersions"),
  },
  handler: async (ctx, args) =>
    await findSignedSignature(
      ctx,
      args.affiliateUserId,
      args.contractVersionId,
    ),
});

/**
 * Write an in-app SES signature — row, document and activation, atomically.
 *
 * Called by `signAffiliateContract` ONLY after the PDF has been generated and
 * stored, which is why `signedDocumentFileId` is required here and optional on
 * the table: a row this mutation writes always has its document. The action
 * that used to insert `status: "signed"` first left one orphan per failed
 * attempt, for ever, because nothing deduplicated them either.
 *
 * Idempotent. A retry — a double click, a dropped response, a client that
 * resends — finds the signature already on file and returns it instead of
 * adding a second one. The freshly stored PDF of that retry is then unreferenced
 * and `storageSweep` reclaims it after the TTL.
 */
export const recordInAppSignature = internalMutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    contractVersionId: v.id("contractVersions"),
    contractSnapshotContent: v.string(),
    contractSnapshotHash: v.string(),
    signerName: v.string(),
    signerUserAgent: v.optional(v.string()),
    signerIp: v.optional(v.string()),
    signatureRef: v.string(),
    signedDocumentFileId: v.string(),
    signedAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"contractSignatures">> => {
    const affiliate = await ctx.db.get(args.affiliateUserId);
    if (!affiliate) throw new Error("Affilié introuvable");

    const existing = await findSignedSignature(
      ctx,
      args.affiliateUserId,
      args.contractVersionId,
    );
    if (existing) return existing._id;

    const now = Date.now();
    const signatureId = await ctx.db.insert("contractSignatures", {
      affiliateUserId: args.affiliateUserId,
      contractVersionId: args.contractVersionId,
      status: "signed",
      contractSnapshotContent: args.contractSnapshotContent,
      contractSnapshotHash: args.contractSnapshotHash,
      signerName: args.signerName,
      signerUserAgent: args.signerUserAgent,
      signerIp: args.signerIp,
      signatureMethod: "in_app_ses",
      signatureRef: args.signatureRef,
      signedDocumentFileId: args.signedDocumentFileId,
      signedAt: args.signedAt,
      createdAt: now,
      updatedAt: now,
    });

    /* Activate only against the version the affiliate is actually required to
       sign. On a mismatch the signature is kept and the affiliate stays
       blocked — the same rule the Yousign path enforced. */
    if (args.contractVersionId === affiliate.requiredContractVersionId) {
      await ctx.db.patch(affiliate._id, {
        contractStatus: "active",
        acceptedContractVersionId: args.contractVersionId,
      });
    }

    return signatureId;
  },
});
