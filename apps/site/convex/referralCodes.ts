import { v } from "convex/values";
import { query, mutation, internalQuery, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  deriveDiscountPercent,
  isBillableDiscountPercent,
  requireBillableDiscountPercent,
} from "./referralDiscount";
import { Doc, Id } from "./_generated/dataModel";

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

/* ── The one lookup ──
   `validateCode` (what the storefront shows) and `resolveForCheckout` (what
   the customer is charged) must never be able to disagree about a code, so
   they walk the same three checks here rather than each keeping its own copy.
   Returns the code row AND its owner, because the owner is what decides both
   the discount and who gets the commission — the checkout used to take that
   id from the caller. */
async function lookupUsableCode(
  ctx: QueryCtx,
  rawCode: string,
): Promise<{ code: Doc<"referralCodes">; affiliate: Doc<"affiliateUsers"> } | null> {
  const normalizedCode = rawCode.toUpperCase().trim();

  const referralCode = await ctx.db
    .query("referralCodes")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .unique();
  if (!referralCode || !referralCode.isActive) return null;

  const affiliate = await ctx.db.get(referralCode.affiliateUserId);
  if (!affiliate || affiliate.status !== "active") return null;

  return { code: referralCode, affiliate };
}

/** The programme-wide discount, or `undefined` when no settings row exists. */
async function settingsDiscountPercent(
  ctx: QueryCtx,
): Promise<number | undefined> {
  const settings = await ctx.db.query("affiliateSettings").take(1);
  return settings[0]?.defaultDiscountPercent;
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

/* Public and unauthenticated on purpose: affiliate codes are handed out to be
   typed in by strangers, so the storefront has to be able to price one before
   anybody signs in. What changed is what the answer is FOR — it is now a
   display value only. `createCheckoutSession` no longer accepts a percent, an
   affiliate id or a code id from its caller; it repeats this lookup itself.
   Forging the reply here therefore changes what the page draws and nothing
   about what is charged. */
export const validateCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const found = await lookupUsableCode(ctx, args.code);
    if (!found) {
      return { valid: false, error: "Code invalide ou désactivé" };
    }

    /* Bounded with the SAME rule the checkout applies. Without this the two
       could still disagree in one direction: a misconfigured percent (an admin
       typo in `defaultDiscountPercent`, which `admin.updateSettings` stores
       unchecked) was advertised here as a valid code and then hard-refused at
       payment. Telling a customer their code is good and then failing the sale
       is worse than declining it up front. */
    const percent = deriveDiscountPercent({
      overridePercent: found.affiliate.discountOverridePercent,
      settingsPercent: await settingsDiscountPercent(ctx),
    });
    if (!isBillableDiscountPercent(percent)) {
      console.error(
        `[REFERRAL] Le code « ${found.code.code} » vaut ${percent} %, hors de ` +
          `l'intervalle facturable : présenté comme invalide au client. ` +
          `Corriger defaultDiscountPercent des réglages ou ` +
          `discountOverridePercent de l'apporteur.`,
      );
      return { valid: false, error: "Code invalide ou désactivé" };
    }

    return {
      valid: true,
      code: found.code.code,
      referralCodeId: found.code._id,
      affiliateUserId: found.affiliate._id,
      discountPercent: percent,
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

/**
 * The affiliate a code belongs to, or `null`.
 *
 * Used by the webhook to check that the referrer named in a session's metadata
 * really owns the code named beside it. The checkout writes both, so they
 * agree by construction today — but a Stripe session lives up to 24 h, so any
 * session opened before `createCheckoutSession` stopped accepting a caller's
 * `referrerId` still carries whatever that caller chose. This is what stops
 * one of those paying out.
 */
export const ownerOf = internalQuery({
  args: { referralCodeId: v.id("referralCodes") },
  handler: async (ctx, args): Promise<Id<"affiliateUsers"> | null> => {
    const code = await ctx.db.get(args.referralCodeId);
    return code?.affiliateUserId ?? null;
  },
});

/* ── What a referral code is worth, for the checkout ──
   The three values `createCheckoutSession` used to accept from its caller —
   the code id, the affiliate who earns the commission, and the percent off —
   all come from here now. The customer supplies the code string and nothing
   else, so there is no longer an argument to forge: a wrong code resolves to
   `null` and the sale is billed at list price.

   `internalQuery`, so no client can reach it and hand itself a different
   answer than the one the checkout computed. */
export const resolveForCheckout = internalQuery({
  args: { code: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    referralCodeId: Id<"referralCodes">;
    referrerId: Id<"affiliateUsers">;
    referrerEmail: string | null;
    discountPercent: number;
  } | null> => {
    const found = await lookupUsableCode(ctx, args.code);
    if (!found) return null;

    /* Throws rather than returns on an out-of-range percent: that is a
       misconfiguration, not an invalid code, and the two must not read the
       same to the customer. See ./referralDiscount. */
    const discountPercent = requireBillableDiscountPercent({
      overridePercent: found.affiliate.discountOverridePercent,
      settingsPercent: await settingsDiscountPercent(ctx),
      code: found.code.code,
    });

    /* The affiliate's own email, read here so the checkout's anti-self-referral
       check compares against the owner of THIS code rather than against an
       affiliate id the caller chose. */
    const user = await ctx.db.get(found.affiliate.userId);

    return {
      referralCodeId: found.code._id,
      referrerId: found.affiliate._id,
      referrerEmail: user?.email ?? null,
      discountPercent,
    };
  },
});
