import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import * as defs from "@be-in-digital/convex-functions/privacy";

/**
 * Answering a diner's RGPD request, and enforcing the retention window.
 *
 * The policy is in `@be-in-digital/convex-functions/privacy` so that both this
 * bench and `apps/themes` — the template cloned for every client — apply the
 * same rules. What lives here is what cannot: the `internal` references the
 * scheduler needs, which the package has none of. Same split as
 * `stores.remove` and its cascade.
 *
 * WHY THESE ARE `query`/`mutation` RATHER THAN `storeQuery`/`storeMutation`:
 * a data-subject request spans every establishment the caller administers, and
 * three of the tables it has to reach — `customerAddresses`, `rateLimits`,
 * `userProfiles` — have no `storeId` at all. There is no single store to scope
 * to. `privacyScope` is the guard instead: it requires `customers:manage`
 * through both gates (role, then the modules on the profile) and returns the
 * establishments the caller may act on, which the report then names.
 */

// @guarded-inline: defs.previewErasure calls privacyScope, which requires
// `customers:manage` and throws `denied("permission_denied")` otherwise.
export const previewErasure = query({
  args: defs.previewErasure.args,
  handler: (ctx, args) => defs.previewErasure.handler(ctx, args),
});

// @guarded-inline: defs.exportDataSubject calls privacyScope.
export const exportDataSubject = query({
  args: defs.exportDataSubject.args,
  handler: (ctx, args) => defs.exportDataSubject.handler(ctx, args),
});

/**
 * One pass of an erasure, then as many more as it takes.
 *
 * A diner with three years of orders across two establishments is more rows
 * than one Convex transaction may touch, so the pass returns where it got to
 * and this reschedules from there. The report the operator is shown carries
 * `complete`, and the screen has to render it: a partial erasure reported as
 * finished is the failure the whole module is built to avoid.
 */
export const eraseDataSubject = mutation({
  args: defs.eraseDataSubject.args,
  handler: async (ctx, args) => {
    const result = await defs.eraseDataSubject.handler(ctx, args);
    if (!result.complete) {
      await ctx.scheduler.runAfter(0, internal.privacy.continueErasure, {
        email: args.email,
        fingerprint: args.fingerprint,
        storeIds: result.storeIds as never,
        everyStore: result.everyStore,
        actor: result.actor,
        state: result.state,
      });
    }
    return result;
  },
});

/**
 * The rest of the erasure, one pass per run, until there is nothing left.
 *
 * Internal only, and that is load-bearing: it takes the establishments to act
 * on as an argument because a scheduled job has no identity to derive them
 * from, so a public version of this would let any caller name any
 * establishment and erase inside it.
 */
export const continueErasure = internalMutation({
  args: defs.continueErasure.args,
  handler: async (ctx, args) => {
    const result = await defs.continueErasure.handler(ctx, args);
    if (!result.complete) {
      await ctx.scheduler.runAfter(0, internal.privacy.continueErasure, {
        ...args,
        state: result.state,
      });
    }
    return result;
  },
});

// @guarded-inline: defs.setRetention calls privacyScope.
export const setRetention = mutation({
  args: defs.setRetention.args,
  handler: (ctx, args) => defs.setRetention.handler(ctx, args),
});

// @public-by-design: the retention window is quoted to the diner in the game's
// consent notice, so it is not a secret from them. It returns one number and
// one boolean and names nobody.
export const getRetention = query({
  args: defs.getRetention.args,
  handler: (ctx) => defs.getRetention.handler(ctx),
});

/**
 * Carry away what has outlived the retention window.
 *
 * Reschedules itself a minute later while there is more to do, the same shape
 * as the kitchen-ticket purge: one bounded pass per run, and a backlog that
 * drains rather than a transaction that dies.
 *
 * THE CURSOR IS THE POINT OF THE RESCHEDULE, not the delay. Rows the sweep
 * skips — an order already anonymised, a subscriber still in touch — stay in
 * the range it walks, so a run that restarted from the beginning would be
 * handed the same skipped rows every night and never reach what is behind
 * them. It would report a clean run while doing nothing, which is
 * indistinguishable from having nothing to do. Passing the state back is what
 * makes the walk move.
 */
export const sweepExpiredCustomerData = internalMutation({
  args: defs.sweepExpiredCustomerData.args,
  handler: async (ctx, args) => {
    const report = await defs.sweepExpiredCustomerData.handler(ctx, args);
    if (report.hasMore && report.state) {
      await ctx.scheduler.runAfter(
        60_000,
        internal.privacy.sweepExpiredCustomerData,
        { ...args, state: report.state },
      );
    }
    return report;
  },
});
