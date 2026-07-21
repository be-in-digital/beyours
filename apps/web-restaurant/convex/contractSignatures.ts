import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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

    const signatures = await ctx.db
      .query("contractSignatures")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .order("desc")
      .take(10);

    const signed = signatures.find(
      (s) => s.status === "signed" && s.signedDocumentFileId,
    );
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

export const getByYousignRequestId = internalQuery({
  args: { yousignSignatureRequestId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contractSignatures")
      .withIndex("by_yousignSignatureRequestId", (q) =>
        q.eq(
          "yousignSignatureRequestId",
          args.yousignSignatureRequestId,
        ),
      )
      .unique();
  },
});

export const getById = internalQuery({
  args: { id: v.id("contractSignatures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/* ── Internal mutations ── */

export const updateYousignData = internalMutation({
  args: {
    signatureId: v.id("contractSignatures"),
    yousignSignatureRequestId: v.string(),
    yousignSignerUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.signatureId, {
      yousignSignatureRequestId: args.yousignSignatureRequestId,
      yousignSignerUrl: args.yousignSignerUrl,
      updatedAt: Date.now(),
    });
  },
});

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

/** Activate affiliate after successful signature (webhook handler) */
export const activateAfterSignature = internalMutation({
  args: {
    signatureId: v.id("contractSignatures"),
    signedAt: v.number(),
    signerIp: v.optional(v.string()),
    signedDocumentFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const signature = await ctx.db.get(args.signatureId);
    if (!signature) throw new Error("Signature introuvable");

    const affiliate = await ctx.db.get(signature.affiliateUserId);
    if (!affiliate) throw new Error("Affilié introuvable");

    // Update signature
    await ctx.db.patch(args.signatureId, {
      status: "signed",
      signedAt: args.signedAt,
      signerIp: args.signerIp,
      signedDocumentFileId: args.signedDocumentFileId,
      updatedAt: Date.now(),
    });

    // Only activate if this signature matches the required version
    if (
      signature.contractVersionId === affiliate.requiredContractVersionId
    ) {
      await ctx.db.patch(affiliate._id, {
        contractStatus: "active",
        acceptedContractVersionId: signature.contractVersionId,
      });
    }
    // If version mismatch → signature is recorded but user stays blocked
  },
});

/**
 * Record an in-app SES signature (status "signed" + audit trail).
 * The signed PDF is attached and the affiliate activated afterwards via
 * `activateAfterSignature`. Called by the `signAffiliateContract` action.
 */
export const createInAppSignatureRecord = internalMutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    contractVersionId: v.id("contractVersions"),
    contractSnapshotContent: v.string(),
    contractSnapshotHash: v.string(),
    signerName: v.string(),
    signerUserAgent: v.optional(v.string()),
    signerIp: v.optional(v.string()),
    signedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("contractSignatures", {
      affiliateUserId: args.affiliateUserId,
      contractVersionId: args.contractVersionId,
      status: "signed",
      contractSnapshotContent: args.contractSnapshotContent,
      contractSnapshotHash: args.contractSnapshotHash,
      signerName: args.signerName,
      signerUserAgent: args.signerUserAgent,
      signerIp: args.signerIp,
      signatureMethod: "in_app_ses",
      signedAt: args.signedAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});
