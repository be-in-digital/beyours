import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import {
  DAY_MS,
  startOfDay,
  summarize,
  buildDailySeries,
  readSnapshotsInRange,
} from "./saLib";

/** GMV agrégée de la flotte de restaurants déployés (ventes RÉELLES des restos). */
export const fleetOverview = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = args.days ?? 30;
    const todayStart = startOfDay(Date.now());
    const since = todayStart - (days - 1) * DAY_MS;
    const prevSince = since - days * DAY_MS;

    const current = await readSnapshotsInRange(ctx, since);
    const previous = await readSnapshotsInRange(ctx, prevSince, since);

    const totals = summarize(current);
    const prevTotals = summarize(previous);
    const deltaGrossRatio =
      prevTotals.grossCents > 0
        ? (totals.grossCents - prevTotals.grossCents) / prevTotals.grossCents
        : 0;
    const deltaOrdersRatio =
      prevTotals.orderCount > 0
        ? (totals.orderCount - prevTotals.orderCount) / prevTotals.orderCount
        : 0;

    const series = buildDailySeries(current, days, todayStart);

    const deployments = await ctx.db.query("saDeployments").take(500);
    const depMap = new Map(
      deployments.map((d) => [d._id as Id<"saDeployments">, d]),
    );
    const perDep = new Map<string, { grossCents: number; orderCount: number }>();
    for (const s of current) {
      const cur = perDep.get(s.deploymentId) ?? { grossCents: 0, orderCount: 0 };
      cur.grossCents += s.grossCents;
      cur.orderCount += s.orderCount;
      perDep.set(s.deploymentId, cur);
    }
    const restaurants = [...perDep.entries()]
      .map(([deploymentId, agg]) => {
        const d = depMap.get(deploymentId as Id<"saDeployments">);
        return {
          deploymentId,
          name: d?.restaurantName ?? d?.name ?? "—",
          city: d?.city ?? "",
          plan: d?.plan ?? "essentielle",
          health: d?.health ?? "unknown",
          grossCents: agg.grossCents,
          orderCount: agg.orderCount,
        };
      })
      .sort((a, b) => b.grossCents - a.grossCents);

    return {
      days,
      totals,
      deltaGrossRatio,
      deltaOrdersRatio,
      series,
      restaurants,
      activeDeployments: perDep.size,
    };
  },
});

export const forDeployment = query({
  args: { deploymentId: v.id("saDeployments"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = args.days ?? 30;
    const todayStart = startOfDay(Date.now());
    const since = todayStart - (days - 1) * DAY_MS;
    const snaps = await ctx.db
      .query("saSalesSnapshots")
      .withIndex("by_deployment_day", (q) =>
        q.eq("deploymentId", args.deploymentId).gte("dayTs", since),
      )
      .collect();
    return {
      days,
      totals: summarize(snaps),
      series: buildDailySeries(snaps, days, todayStart),
    };
  },
});
