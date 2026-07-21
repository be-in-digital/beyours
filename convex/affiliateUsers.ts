import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/** Valide un SIRET : 14 chiffres + clé de Luhn (formule SIREN/SIRET). */
function isValidSiret(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{14}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(digits[i]!, 10);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/* ── Public queries ── */

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!affiliate) return null;

    const user = await ctx.db.get(userId);
    return {
      ...affiliate,
      email: user?.email ?? null,
    };
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

/* ── Public mutations ── */

export const completeProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    siret: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    // Programme réservé aux professionnels : SIRET obligatoire et valide.
    const siret = args.siret.replace(/\s/g, "");
    if (!isValidSiret(siret)) {
      throw new Error("Numéro SIRET invalide (14 chiffres attendus)");
    }

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    const patch: Record<string, string> = {
      firstName: args.firstName,
      lastName: args.lastName,
      phone: args.phone,
      siret,
    };
    if (args.address) patch.address = args.address;
    if (args.city) patch.city = args.city;
    if (args.postalCode) patch.postalCode = args.postalCode;

    await ctx.db.patch(affiliate._id, patch);
  },
});

export const createAfterSignup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    // Vérifier qu'un affiliateUser n'existe pas déjà
    const existing = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return existing._id;

    // Get the active contract version
    const activeVersions = await ctx.db
      .query("contractVersions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    const activeVersion = activeVersions[0];

    const affiliateUserId = await ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate",
      status: "active",
      contractStatus: "pending_contract",
      requiredContractVersionId: activeVersion?._id,
      stripeConnectStatus: "not_started",
      createdAt: Date.now(),
    });

    // Email de bienvenue (best-effort). L'email vit sur le compte auth.
    const user = await ctx.db.get(userId);
    if (user?.email) {
      await ctx.scheduler.runAfter(0, internal.email.send.sendAffiliateWelcome, {
        toEmail: user.email,
        firstName: user.name?.trim().split(/\s+/)[0] ?? "",
      });
    }

    return affiliateUserId;
  },
});

/* ── Internal queries ── */

export const getById = internalQuery({
  args: { affiliateUserId: v.id("affiliateUsers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.affiliateUserId);
  },
});

export const getEmailById = internalQuery({
  args: { affiliateUserId: v.id("affiliateUsers") },
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateUserId);
    if (!affiliate) return null;
    const user = await ctx.db.get(affiliate.userId);
    return user?.email ?? null;
  },
});

export const getMeInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getByStripeAccountId = internalQuery({
  args: { stripeConnectAccountId: v.string() },
  handler: async (ctx, args) => {
    // Scale <50 affiliates, scan acceptable
    const affiliates = await ctx.db.query("affiliateUsers").take(200);
    return (
      affiliates.find(
        (a) => a.stripeConnectAccountId === args.stripeConnectAccountId,
      ) ?? null
    );
  },
});

export const getByUserIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

/* ── Internal mutations (admin) ── */

export const updateStatus = internalMutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.affiliateUserId, { status: args.status });
  },
});

export const updateStripeConnectStatus = internalMutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    stripeConnectStatus: v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("disabled"),
    ),
    stripeConnectAccountId: v.optional(v.string()),
    clearAccountId: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      stripeConnectStatus: args.stripeConnectStatus,
    };
    if (args.stripeConnectAccountId) {
      patch.stripeConnectAccountId = args.stripeConnectAccountId;
    }
    if (args.clearAccountId) {
      patch.stripeConnectAccountId = undefined;
    }
    await ctx.db.patch(args.affiliateUserId, patch);
  },
});

export const syncFromStripe = internalMutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateUserId);
    if (!affiliate) return;

    const patch: Record<string, string> = {};
    if (!affiliate.firstName && args.firstName) {
      patch.firstName = args.firstName;
    }
    if (!affiliate.lastName && args.lastName) {
      patch.lastName = args.lastName;
    }
    if (!affiliate.phone && args.phone) {
      patch.phone = args.phone;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.affiliateUserId, patch);
    }
  },
});

export const updateCommissionOverride = internalMutation({
  args: {
    affiliateUserId: v.id("affiliateUsers"),
    commissionOverrideCents: v.optional(v.number()),
    discountOverridePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.commissionOverrideCents !== undefined) {
      patch.commissionOverrideCents = args.commissionOverrideCents;
    }
    if (args.discountOverridePercent !== undefined) {
      patch.discountOverridePercent = args.discountOverridePercent;
    }
    await ctx.db.patch(args.affiliateUserId, patch);
  },
});
