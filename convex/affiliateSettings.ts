import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";

/* ── Public queries ── */

export const get = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("affiliateSettings").take(1);
    if (settings.length === 0) {
      // Valeurs par défaut
      return {
        defaultCommissionCents: 50000,
        defaultDiscountPercent: 10,
        validationDelayDays: 14,
        programEnabled: true,
      };
    }
    return settings[0];
  },
});

/* ── Internal queries ── */

export const getInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("affiliateSettings").take(1);
    if (settings.length === 0) {
      return {
        defaultCommissionCents: 50000,
        defaultDiscountPercent: 10,
        validationDelayDays: 14,
        programEnabled: true,
      };
    }
    return settings[0];
  },
});

/* ── Internal mutations ── */

export const upsert = internalMutation({
  args: {
    defaultCommissionCents: v.number(),
    defaultDiscountPercent: v.number(),
    validationDelayDays: v.number(),
    programEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("affiliateSettings").take(1);
    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return existing[0]._id;
    }

    return await ctx.db.insert("affiliateSettings", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});
