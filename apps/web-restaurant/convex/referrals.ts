import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
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

    return await ctx.db.insert("referrals", {
      referrerId: args.referrerId,
      referralCodeId: args.referralCodeId,
      orderId: args.orderId,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      status: "pending",
      commissionCents: args.commissionCents,
      discountPercent: args.discountPercent,
      discountAmountCents: args.discountAmountCents,
      createdAt: Date.now(),
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
      if (affiliate?.stripeConnectStatus === "active") {
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
