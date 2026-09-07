import { v } from "convex/values";
import {
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { mintCodeFor } from "./referralCodes";

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

/* ── No public `createSignatureRequest` here, on purpose ──
   It was a public mutation, reachable by any signed-in account (and
   `affiliateUsers.createAfterSignup` lets any account give itself an affiliate
   profile), that inserted a `contractSignatures` row from caller-supplied
   `contractSnapshotContent` and `contractSnapshotHash` — arbitrary text, stored
   as the contract someone signed, in the table `getMySignatures` renders and
   the eIDAS art. 25 claim rests on. It carried no document either, which is the
   invariant `recordInAppSignature` below exists to hold.

   It was written for the Yousign flow, which was removed, and had no caller.
   The in-app path mints its snapshot server-side from the active contract
   version. */

/* ── Internal queries ── */

export const getById = internalQuery({
  args: { id: v.id("contractSignatures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/* ── Internal mutations ── */

/* ── No `updateStatus` here either, on purpose ──
   It took `signedAt` and `signerIp` from its caller and patched them straight
   onto the row — the two fields the eIDAS art. 25 trail rests on, taken from
   whoever asked. It could set `status: "signed"` with no document, undoing the
   invariant `recordInAppSignature` below exists to hold, and it could backdate
   or forward-date a signature to any instant.

   It was the Yousign webhook's writer, it survived the removal of that flow
   with no caller left, and it was the last place in this file where an audit
   value came from outside. The in-app path stamps the timestamp from the
   server's own clock and takes the address only from an attestation the Next
   server signed (lib/security/signer-attestation.ts). If a provider flow ever
   comes back, its writer records what the PROVIDER attested, not what the
   request body said. */

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
 * How far `recordInAppSignature`'s `signedAt` may sit from the server's clock.
 *
 * The action stamps it from the same clock a fraction of a second earlier, so
 * anything outside this is a bug or a caller that should not exist.
 */
export const MAX_SIGNATURE_CLOCK_SKEW_MS = 10 * 60 * 1000;

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
    /* `signedAt` is passed in rather than stamped here because the certificate
       page is drawn BEFORE this transaction and prints the same instant: the
       document and the row have to agree, and only the action knows what it
       drew. It is the action's own `Date.now()` — this mutation is internal, so
       no client reaches it — and this is what keeps that true rather than
       merely conventional. The window is the whole PDF generation and one
       storage write; ten minutes is orders of magnitude more than that, and
       still far too narrow to backdate anything. */
    if (Math.abs(now - args.signedAt) > MAX_SIGNATURE_CLOCK_SKEW_MS) {
      throw new Error(
        "Horodatage de signature hors de l'intervalle admissible : " +
          "il doit être celui du serveur au moment de la signature.",
      );
    }
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

      /* And the referral code, here, because this is where entitlement to one
         begins. `/parrainage/inscription` used to mint it between
         `createAfterSignup` and the redirect to this page — while the
         affiliate was `pending_contract`, which is exactly what
         `referralCodes.assertMayHoldACode` refuses. Gating that mint without
         moving it left every new affiliate signed, activated and holding no
         code, with nothing in the dashboard able to create one.

         In the same transaction as the activation on purpose: an affiliate is
         never activated without their code, and a signature that fails leaves
         neither behind. Idempotent, so re-signing a superseded version keeps
         the code they already publish. */
      await mintCodeFor(ctx, affiliate._id);
    }

    return signatureId;
  },
});
