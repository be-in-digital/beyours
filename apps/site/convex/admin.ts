import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  REFERRAL_SCAN_LIMIT,
  summariseReferrals,
} from "./referralTotals";

/**
 * The most affiliate rows the console reads in one transaction.
 *
 * Its own constant rather than the referral one: they bound different tables
 * and there is no reason for a change to one to move the other.
 */
const AFFILIATE_SCAN_LIMIT = 200;

/* ── Helper: check that the user is an admin ── */

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
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

/* The same gate, reachable from an action.
   `requireAdmin` takes a `QueryCtx | MutationCtx` and reads the database, so an
   `ActionCtx` cannot call it. Rather than let actions carry a looser check of
   their own, they run this through `ctx.runQuery`, which forwards the caller's
   identity — one implementation of "is an admin", not two. */
export const assertAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    return { actorName: admin.firstName ?? "Admin" };
  },
});

/* ── Queries ── */

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const affiliates = await ctx.db
      .query("affiliateUsers")
      .take(AFFILIATE_SCAN_LIMIT + 1);
    /* The same bound and the same sums the affiliate's own portal uses — see
       convex/referralTotals.ts. This read stopped at 500 while theirs stopped
       at 200, and the status sets were retyped in both, so one set of
       commissions produced two totals and the smaller was shown to the person
       owed the money. */
    const referrals = await ctx.db
      .query("referrals")
      .take(REFERRAL_SCAN_LIMIT + 1);

    const totals = summariseReferrals(referrals);
    const affiliatesTruncated = affiliates.length > AFFILIATE_SCAN_LIMIT;
    const countedAffiliates = affiliatesTruncated
      ? affiliates.slice(0, AFFILIATE_SCAN_LIMIT)
      : affiliates;

    return {
      totalAffiliates: countedAffiliates.length,
      activeAffiliates: countedAffiliates.filter((a) => a.status === "active")
        .length,
      totalReferrals: totals.totalReferrals,
      pendingReferrals: totals.pendingCount,
      /* Counted WITHOUT `paid`, unlike the affiliate portal's `validatedCount`
         — this dashboard shows the four states as a partition, and the paid
         ones have their own counter beside it. */
      validatedReferrals: totals.validatedCount - totals.paidCount,
      paidReferrals: totals.paidCount,
      totalCommissions: totals.totalEarned,
      pendingCommissions: totals.totalPending,
      /* Either read hit its cap, so every figure above is a floor. The console
         renders it; a silently short money total is the whole of #P2-16. */
      truncated: totals.truncated || affiliatesTruncated,
    };
  },
});

export const listAffiliates = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const affiliates = await ctx.db
      .query("affiliateUsers")
      .take(AFFILIATE_SCAN_LIMIT);

    const result = [];
    for (const affiliate of affiliates) {
      const user = await ctx.db.get(affiliate.userId);
      /* One affiliate's rows, on the shared bound and through the shared sums,
         so this row and that same affiliate's own portal cannot report two
         different earnings for the same commissions. */
      const referrals = await ctx.db
        .query("referrals")
        .withIndex("by_referrerId", (q) =>
          q.eq("referrerId", affiliate._id),
        )
        .take(REFERRAL_SCAN_LIMIT + 1);

      const totals = summariseReferrals(referrals);

      result.push({
        ...affiliate,
        email: user?.email ?? null,
        referralCount: totals.totalReferrals,
        totalEarned: totals.totalEarned,
        pendingEarnings: totals.totalPending,
        /** This affiliate has more commissions than one read returns. */
        truncated: totals.truncated,
      });
    }

    return result;
  },
});

/**
 * The referral states the console may filter on.
 *
 * Exported, and named, so `tests/referral-status-vocabulary.test.ts` can check
 * it against the schema's own union. #384 added `paying` to the schema and to
 * three arithmetic call sites and to none of the reading surfaces, so a
 * commission in flight could not be listed here at all — not even by editing
 * the URL by hand — and rendered as a raw English literal where it did appear
 * (#411).
 */
export const REFERRAL_STATUS_VALIDATOR = v.union(
  v.literal("pending"),
  v.literal("validated"),
  v.literal("payable"),
  v.literal("paying"),
  v.literal("paid"),
  v.literal("cancelled"),
  v.literal("blocked"),
);

export const listReferrals = query({
  args: {
    status: v.optional(REFERRAL_STATUS_VALIDATOR),
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
      await ctx.db.patch(existing[0]!._id, {
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

/* ── Internal: reset an affiliate's contract (for tests) ── */

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

/* ── Internal: promote to admin (run it from the Convex dashboard) ── */

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
