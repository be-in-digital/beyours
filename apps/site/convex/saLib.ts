import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/* Shared helpers for the superadmin console (GMV, aggregates, constants). */

export const DAY_MS = 86_400_000;

export function startOfDay(ts: number): number {
  return Math.floor(ts / DAY_MS) * DAY_MS;
}

/** Annual maintenance prices (cents) per plan — used to compute MRR. */
export const MAINTENANCE_ANNUAL_CENTS: Record<string, number> = {
  essentielle: 49000,
  premium: 89000,
};

/** Monthly equivalent (cents) of an annual maintenance fee. */
export function monthlyEquivalentCents(plan: string): number {
  return Math.round((MAINTENANCE_ANNUAL_CENTS[plan] ?? 49000) / 12);
}

export type SalesSummary = {
  grossCents: number;
  netCents: number;
  refundedCents: number;
  orderCount: number;
  avgOrderValueCents: number;
  bySource: { website: number; uber_eats: number; deliveroo: number; pos: number };
  byType: { delivery: number; pickup: number; dine_in: number };
};

export function emptySummary(): SalesSummary {
  return {
    grossCents: 0,
    netCents: 0,
    refundedCents: 0,
    orderCount: 0,
    avgOrderValueCents: 0,
    bySource: { website: 0, uber_eats: 0, deliveroo: 0, pos: 0 },
    byType: { delivery: 0, pickup: 0, dine_in: 0 },
  };
}

export function summarize(snaps: Doc<"saSalesSnapshots">[]): SalesSummary {
  const s = emptySummary();
  for (const snap of snaps) {
    s.grossCents += snap.grossCents;
    s.netCents += snap.netCents;
    s.refundedCents += snap.refundedCents;
    s.orderCount += snap.orderCount;
    s.bySource.website += snap.bySource.website;
    s.bySource.uber_eats += snap.bySource.uber_eats;
    s.bySource.deliveroo += snap.bySource.deliveroo;
    s.bySource.pos += snap.bySource.pos;
    s.byType.delivery += snap.byType.delivery;
    s.byType.pickup += snap.byType.pickup;
    s.byType.dine_in += snap.byType.dine_in;
  }
  s.avgOrderValueCents = s.orderCount
    ? Math.round(s.grossCents / s.orderCount)
    : 0;
  return s;
}

export async function readSnapshotsInRange(
  ctx: QueryCtx,
  sinceTs: number,
  untilTs?: number,
): Promise<Doc<"saSalesSnapshots">[]> {
  return await ctx.db
    .query("saSalesSnapshots")
    .withIndex("by_day", (q) =>
      untilTs === undefined
        ? q.gte("dayTs", sinceTs)
        : q.gte("dayTs", sinceTs).lt("dayTs", untilTs),
    )
    .collect();
}

export function buildDailySeries(
  snaps: Doc<"saSalesSnapshots">[],
  days: number,
  todayStart: number,
): { day: string; dayTs: number; grossCents: number; orderCount: number }[] {
  const byDay = new Map<number, { grossCents: number; orderCount: number }>();
  for (const s of snaps) {
    const cur = byDay.get(s.dayTs) ?? { grossCents: 0, orderCount: 0 };
    cur.grossCents += s.grossCents;
    cur.orderCount += s.orderCount;
    byDay.set(s.dayTs, cur);
  }
  const out: {
    day: string;
    dayTs: number;
    grossCents: number;
    orderCount: number;
  }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayTs = todayStart - i * DAY_MS;
    const hit = byDay.get(dayTs);
    out.push({
      day: new Date(dayTs).toISOString().slice(0, 10),
      dayTs,
      grossCents: hit?.grossCents ?? 0,
      orderCount: hit?.orderCount ?? 0,
    });
  }
  return out;
}
