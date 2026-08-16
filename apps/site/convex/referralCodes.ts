import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ── Helpers ── */

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BID-";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isValidCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{3,20}$/.test(code);
}

/* ── Public queries ── */

export const getMyCode = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) return null;

    return await ctx.db
      .query("referralCodes")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();
  },
});

export const validateCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const normalizedCode = args.code.toUpperCase().trim();

    const referralCode = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();

    if (!referralCode || !referralCode.isActive) {
      return { valid: false, error: "Code invalide ou désactivé" };
    }

    const affiliate = await ctx.db.get(referralCode.affiliateUserId);
    if (!affiliate || affiliate.status !== "active") {
      return { valid: false, error: "Code invalide ou désactivé" };
    }

    // Read the settings to get the default discount
    const settings = await ctx.db.query("affiliateSettings").take(1);
    const defaultDiscount = settings[0]?.defaultDiscountPercent ?? 10;
    const discountPercent = affiliate.discountOverridePercent ?? defaultDiscount;

    return {
      valid: true,
      code: referralCode.code,
      referralCodeId: referralCode._id,
      affiliateUserId: affiliate._id,
      discountPercent,
    };
  },
});

/* ── Public mutations ── */

export const generateMyCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    // Make sure they do not already have an active code
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();
    if (existing) return existing;

    // Generate a unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      const exists = await ctx.db
        .query("referralCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error("Impossible de générer un code unique");
    }

    const codeId = await ctx.db.insert("referralCodes", {
      affiliateUserId: affiliate._id,
      code,
      isCustom: false,
      isActive: true,
      createdAt: Date.now(),
    });

    return await ctx.db.get(codeId);
  },
});

export const customizeMyCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    const normalizedCode = args.code.toUpperCase().trim();

    if (!isValidCode(normalizedCode)) {
      throw new Error(
        "Le code doit contenir entre 3 et 20 caractères alphanumériques",
      );
    }

    // Make sure the code is not already taken
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();
    if (existing) {
      throw new Error("Ce code est déjà utilisé");
    }

    // Deactivate the previously active code
    const currentCode = await ctx.db
      .query("referralCodes")
      .withIndex("by_affiliateUserId", (q) =>
        q.eq("affiliateUserId", affiliate._id),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();
    if (currentCode) {
      await ctx.db.patch(currentCode._id, { isActive: false });
    }

    // Create the new custom code
    const codeId = await ctx.db.insert("referralCodes", {
      affiliateUserId: affiliate._id,
      code: normalizedCode,
      isCustom: true,
      isActive: true,
      createdAt: Date.now(),
    });

    return await ctx.db.get(codeId);
  },
});

/* ── Internal queries ── */

export const getByCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase().trim()))
      .unique();
  },
});
