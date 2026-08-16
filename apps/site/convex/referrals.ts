import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ── Internal queries ── */

export const getByOrderId = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();
  },
});

/* ── Internal mutations ── */

export const createFromCheckout = internalMutation({
  args: {
    referrerId: v.id("affiliateUsers"),
    referralCodeId: v.id("referralCodes"),
    orderId: v.id("orders"),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    commissionCents: v.number(),
    discountPercent: v.number(),
    discountAmountCents: v.number(),
  },
  handler: async (ctx, args) => {
    // Idempotent: one referral per order
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .unique();
    if (existing) return existing._id;

    // « Nouveau Client » dedup (art. 3.2): if the email is already a customer (an
    // earlier paid order) or an already-known contact, hold it for human review
    // instead of letting the commission through.
    const priorOrders = await ctx.db
      .query("orders")
      .withIndex("by_email", (q) => q.eq("customerEmail", args.customerEmail))
      .take(10);
    const hadPriorPaidOrder = priorOrders.some(
      (o) => o._id !== args.orderId && o.status === "paid",
    );
    const knownLead = await ctx.db
      .query("contactLeads")
      .withIndex("by_email", (q) => q.eq("email", args.customerEmail))
      .take(1);
    const alreadyKnown = hadPriorPaidOrder || knownLead.length > 0;

    const now = Date.now();
    const flagged = alreadyKnown
      ? {
          status: "blocked" as const,
          blockedAt: now,
          statusReason:
            "Client potentiellement déjà connu — vérifier l'éligibilité « Nouveau Client » (art. 3.2)",
          adminNote: hadPriorPaidOrder
            ? "Commande antérieure payée avec le même email."
            : "Email déjà présent dans les contacts (lead).",
        }
      : { status: "pending" as const };

    return await ctx.db.insert("referrals", {
      referrerId: args.referrerId,
      referralCodeId: args.referralCodeId,
      orderId: args.orderId,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      ...flagged,
      commissionCents: args.commissionCents,
      discountPercent: args.discountPercent,
      discountAmountCents: args.discountAmountCents,
      createdAt: now,
    });
  },
});

export const validatePendingReferrals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("affiliateSettings").take(1);
    const delayDays = settings[0]?.validationDelayDays ?? 14;
    const cutoff = Date.now() - delayDays * 24 * 60 * 60 * 1000;

    const pendingReferrals = await ctx.db
      .query("referrals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(100);

    let validated = 0;
    for (const referral of pendingReferrals) {
      if (referral.createdAt <= cutoff) {
        const order = await ctx.db.get(referral.orderId);
        if (order && order.status === "paid") {
          await ctx.db.patch(referral._id, {
            status: "validated",
            validatedAt: Date.now(),
          });
          validated++;
        } else if (
          order &&
          (order.status === "cancelled" || order.status === "failed")
        ) {
          await ctx.db.patch(referral._id, {
            status: "cancelled",
            cancelledAt: Date.now(),
            statusReason: "Commande annulée ou échouée",
          });
        }
      }
    }

    if (validated > 0) {
      console.log(`Validated ${validated} referrals`);
    }
  },
});

export const getPayableReferrals = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_status", (q) => q.eq("status", "payable"))
      .take(100);
  },
});

export const markValidatedAsPayable = internalMutation({
  args: {},
  handler: async (ctx) => {
    const validated = await ctx.db
      .query("referrals")
      .withIndex("by_status", (q) => q.eq("status", "validated"))
      .take(100);

    let marked = 0;
    for (const referral of validated) {
      const affiliate = await ctx.db.get(referral.referrerId);
      // No payout without a SIRET (professional) and the affiliate's invoice (art. 4.2).
      if (
        affiliate?.stripeConnectStatus === "active" &&
        affiliate.siret &&
        referral.invoiceStorageId
      ) {
        await ctx.db.patch(referral._id, { status: "payable" });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`Marked ${marked} referrals as payable`);
    }
  },
});

export const markPaid = internalMutation({
  args: {
    referralId: v.id("referrals"),
    stripeTransferId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      status: "paid",
      paidAt: Date.now(),
      stripeTransferId: args.stripeTransferId,
    });
  },
});

export const getByIdInternal = internalQuery({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.referralId);
  },
});

/**
 * Cancels a commission (refund, unpaid invoice, dispute). Reversing the Stripe
 * transfer, when needed, happens upstream in the stripeConnect action; here we
 * only freeze the status and the audit trail.
 */
export const cancelReferral = internalMutation({
  args: {
    referralId: v.id("referrals"),
    reason: v.string(),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      status: "cancelled" as const,
      cancelledAt: Date.now(),
      statusReason: args.reason,
      ...(args.adminNote ? { adminNote: args.adminNote } : {}),
    });
  },
});

/* ── Public queries ── */

export const getMyReferrals = query({
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
      .query("referrals")
      .withIndex("by_referrerId", (q) => q.eq("referrerId", affiliate._id))
      .order("desc")
      .take(50);
  },
});

export const getMyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrerId", (q) => q.eq("referrerId", affiliate._id))
      .take(200);

    const totalReferrals = referrals.length;
    const pendingCount = referrals.filter(
      (r) => r.status === "pending",
    ).length;
    const validatedCount = referrals.filter(
      (r) =>
        r.status === "validated" ||
        r.status === "payable" ||
        r.status === "paid",
    ).length;
    const paidCount = referrals.filter((r) => r.status === "paid").length;
    const totalEarned = referrals
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.commissionCents, 0);
    const totalPending = referrals
      .filter(
        (r) =>
          r.status === "pending" ||
          r.status === "validated" ||
          r.status === "payable",
      )
      .reduce((sum, r) => sum + r.commissionCents, 0);

    return {
      totalReferrals,
      pendingCount,
      validatedCount,
      paidCount,
      totalEarned,
      totalPending,
    };
  },
});

/* ── Affiliate invoicing (invoice mandatory before payout, art. 4.2) ── */

/** Signed upload URL for attaching an invoice (the file is POSTed to it). */
export const generateInvoiceUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attaches the uploaded invoice to a commission of the signed-in affiliate. */
export const attachReferralInvoice = mutation({
  args: {
    referralId: v.id("referrals"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    const referral = await ctx.db.get(args.referralId);
    if (!referral || referral.referrerId !== affiliate._id) {
      throw new Error("Commission introuvable");
    }
    if (referral.status === "paid" || referral.status === "cancelled") {
      throw new Error("Cette commission n'accepte plus de facture");
    }

    await ctx.db.patch(args.referralId, {
      invoiceStorageId: args.storageId,
      invoiceUploadedAt: Date.now(),
    });
  },
});

/** Read URL for the invoice — available to its owner or to an admin. */
export const getReferralInvoiceUrl = query({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    const referral = await ctx.db.get(args.referralId);
    if (!referral || !referral.invoiceStorageId) return null;
    if (referral.referrerId !== affiliate._id && affiliate.role !== "admin") {
      return null;
    }

    return await ctx.storage.getUrl(referral.invoiceStorageId);
  },
});
