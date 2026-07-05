import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ── Helper : vérifier que l'utilisateur est admin ── */

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Non authentifié");

  const affiliate = await ctx.db
    .query("affiliateUsers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!affiliate || affiliate.role !== "admin") {
    throw new Error("Accès non autorisé");
  }

  return affiliate;
}

/* ── Queries ── */

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const affiliates = await ctx.db.query("affiliateUsers").take(200);
    const referrals = await ctx.db.query("referrals").take(500);

    return {
      totalAffiliates: affiliates.length,
      activeAffiliates: affiliates.filter((a) => a.status === "active").length,
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter((r) => r.status === "pending").length,
      validatedReferrals: referrals.filter(
        (r) => r.status === "validated" || r.status === "payable",
      ).length,
      paidReferrals: referrals.filter((r) => r.status === "paid").length,
      totalCommissions: referrals
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + r.commissionCents, 0),
      pendingCommissions: referrals
        .filter(
          (r) =>
            r.status !== "cancelled" &&
            r.status !== "blocked" &&
            r.status !== "paid",
        )
        .reduce((sum, r) => sum + r.commissionCents, 0),
    };
  },
});

export const listAffiliates = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const affiliates = await ctx.db.query("affiliateUsers").take(200);

    const result = [];
    for (const affiliate of affiliates) {
      const user = await ctx.db.get(affiliate.userId);
      const referrals = await ctx.db
        .query("referrals")
        .withIndex("by_referrerId", (q) =>
          q.eq("referrerId", affiliate._id),
        )
        .take(200);

      result.push({
        ...affiliate,
        email: user?.email ?? null,
        referralCount: referrals.length,
        totalEarned: referrals
          .filter((r) => r.status === "paid")
          .reduce((sum, r) => sum + r.commissionCents, 0),
        pendingEarnings: referrals
          .filter(
            (r) =>
              r.status === "pending" ||
              r.status === "validated" ||
              r.status === "payable",
          )
          .reduce((sum, r) => sum + r.commissionCents, 0),
      });
    }

    return result;
  },
});

export const listReferrals = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("validated"),
        v.literal("payable"),
        v.literal("paid"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let referrals;
    if (args.status) {
      referrals = await ctx.db
        .query("referrals")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(100);
    } else {
      referrals = await ctx.db.query("referrals").order("desc").take(100);
    }

    const result = [];
    for (const referral of referrals) {
      const affiliate = await ctx.db.get(referral.referrerId);
      const user = affiliate ? await ctx.db.get(affiliate.userId) : null;
      result.push({
        ...referral,
        affiliateName:
          affiliate?.firstName && affiliate?.lastName
            ? `${affiliate.firstName} ${affiliate.lastName}`
            : null,
        affiliateEmail: user?.email ?? null,
      });
    }

    return result;
  },
});

/* ── Mutations ── */

export const updateAffiliateStatus = mutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.affiliateUserId, { status: args.status });
  },
});

export const updateSettings = mutation({
  args: {
    defaultCommissionCents: v.number(),
    defaultDiscountPercent: v.number(),
    validationDelayDays: v.number(),
    programEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("affiliateSettings").take(1);
    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        ...args,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("affiliateSettings", {
        ...args,
        updatedAt: Date.now(),
      });
    }
  },
});

export const blockReferralPayout = mutation({
  args: {
    referralId: v.id("referrals"),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.referralId, {
      status: "blocked" as const,
      blockedAt: Date.now(),
      adminNote: args.adminNote,
    });
  },
});

export const unblockReferralPayout = mutation({
  args: {
    referralId: v.id("referrals"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral || referral.status !== "blocked") {
      throw new Error("Parrainage non trouvé ou non bloqué");
    }
    await ctx.db.patch(args.referralId, {
      status: "validated" as const,
      blockedAt: undefined,
      adminNote: undefined,
    });
  },
});

export const resetAffiliateStripeConnect = mutation({
  args: { affiliateUserId: v.id("affiliateUsers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.affiliateUserId, {
      stripeConnectStatus: "not_started" as const,
      stripeConnectAccountId: undefined,
    });
  },
});

export const resetAllStripeConnect = internalMutation({
  args: {},
  handler: async (ctx) => {
    const affiliates = await ctx.db.query("affiliateUsers").take(200);
    let count = 0;
    for (const a of affiliates) {
      if (a.stripeConnectAccountId) {
        await ctx.db.patch(a._id, {
          stripeConnectStatus: "not_started" as const,
          stripeConnectAccountId: undefined,
        });
        count++;
      }
    }
    console.log(`Reset Stripe Connect for ${count} affiliate(s)`);
    return count;
  },
});

/* ── Internal : reset contrat affilié (pour tests) ── */

export const resetAffiliateContract = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(200);
    const user = users.find(
      (u) => (u as Record<string, unknown>).email === args.email,
    );
    if (!user) throw new Error(`Utilisateur non trouvé : ${args.email}`);

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    // Delete all contract signatures for this affiliate
    const signatures = await ctx.db
      .query("contractSignatures")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .take(50);
    for (const sig of signatures) {
      await ctx.db.delete(sig._id);
    }

    // Reset contract status to pending
    await ctx.db.patch(affiliate._id, {
      contractStatus: "pending_contract",
      acceptedContractVersionId: undefined,
    });

    console.log(
      `Contract reset for ${args.email}: ${signatures.length} signature(s) deleted`,
    );
  },
});

/* ── Internal : promotion admin (à lancer depuis le dashboard Convex) ── */

export const promoteToAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Scale <50 affiliates, filter acceptable for one-time admin operation
    const users = await ctx.db.query("users").take(200);
    const user = users.find(
      (u) => (u as Record<string, unknown>).email === args.email,
    );
    if (!user) throw new Error(`Utilisateur non trouvé : ${args.email}`);

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    await ctx.db.patch(affiliate._id, { role: "admin" as const });
    console.log(`${args.email} promu admin`);
  },
});
