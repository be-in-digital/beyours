import { v } from "convex/values";
import {
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import {
  AFFILIATE_SETTINGS_DEFAULTS,
  programIsEnabled,
  type AffiliateSettings,
} from "./affiliateProgram";

/**
 * The settings row, or {@link AFFILIATE_SETTINGS_DEFAULTS} when none exists.
 *
 * `get` and `getInternal` each used to carry their own copy of that default
 * object, which is how two readers of one setting start disagreeing.
 */
export async function readAffiliateSettings(
  ctx: QueryCtx,
): Promise<AffiliateSettings> {
  const settings = await ctx.db.query("affiliateSettings").take(1);
  return settings[0] ?? AFFILIATE_SETTINGS_DEFAULTS;
}

/** The kill-switch, read from the database. See ./affiliateProgram. */
export async function affiliateProgramEnabled(ctx: QueryCtx): Promise<boolean> {
  return programIsEnabled(await readAffiliateSettings(ctx));
}

/* ── Public queries ── */

export const get = query({
  args: {},
  handler: async (ctx) => await readAffiliateSettings(ctx),
});

/* ── Internal queries ── */

export const getInternal = internalQuery({
  args: {},
  handler: async (ctx) => await readAffiliateSettings(ctx),
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
      await ctx.db.patch(existing[0]!._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return existing[0]!._id;
    }

    return await ctx.db.insert("affiliateSettings", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});
