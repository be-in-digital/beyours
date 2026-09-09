import { query, internalQuery, type QueryCtx } from "./_generated/server";
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
