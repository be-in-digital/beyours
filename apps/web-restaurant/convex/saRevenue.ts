import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import {
  DAY_MS,
  startOfDay,
  monthlyEquivalentCents,
  MAINTENANCE_ANNUAL_CENTS,
} from "./saLib";

const MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function paidRevenue(orders: Doc<"orders">[]): number {
  return orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.amountCents, 0);
}

/** Vue « Ventes & revenus » — chiffre d'affaires commercial RÉEL (thème + maintenance). */
export const revenueOverview = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = args.days ?? 30;
    const now = Date.now();
    const todayStart = startOfDay(now);
    const since = todayStart - (days - 1) * DAY_MS;
    const prevSince = since - days * DAY_MS;

    const orders = await ctx.db.query("orders").take(5000);
    const paid = orders.filter((o) => o.status === "paid");

    const inRange = paid.filter((o) => o.createdAt >= since);
    const prevRange = paid.filter(
      (o) => o.createdAt >= prevSince && o.createdAt < since,
    );

    const revenueCents = inRange.reduce((s, o) => s + o.amountCents, 0);
    const prevRevenue = prevRange.reduce((s, o) => s + o.amountCents, 0);
    const deltaRevenueRatio =
      prevRevenue > 0 ? (revenueCents - prevRevenue) / prevRevenue : 0;

    const creationCents = inRange
      .filter((o) => o.orderType === "creation")
      .reduce((s, o) => s + o.amountCents, 0);
    const maintenanceCents = inRange
      .filter((o) => o.orderType === "maintenance")
      .reduce((s, o) => s + o.amountCents, 0);
    const essentielleCents = inRange
      .filter((o) => o.plan === "essentielle")
      .reduce((s, o) => s + o.amountCents, 0);
    const premiumCents = inRange
      .filter((o) => o.plan === "premium")
      .reduce((s, o) => s + o.amountCents, 0);

    // Série journalière du CA (commandes payées)
    const byDay = new Map<number, { revenueCents: number; orderCount: number }>();
    for (const o of inRange) {
      const d = startOfDay(o.createdAt);
      const cur = byDay.get(d) ?? { revenueCents: 0, orderCount: 0 };
      cur.revenueCents += o.amountCents;
      cur.orderCount += 1;
      byDay.set(d, cur);
    }
    const series: {
      day: string;
      dayTs: number;
      revenueCents: number;
      orderCount: number;
    }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayTs = todayStart - i * DAY_MS;
      const hit = byDay.get(dayTs);
      series.push({
        day: new Date(dayTs).toISOString().slice(0, 10),
        dayTs,
        revenueCents: hit?.revenueCents ?? 0,
        orderCount: hit?.orderCount ?? 0,
      });
    }

    // MRR depuis les abonnements actifs
    const subscriptions = await ctx.db.query("subscriptions").take(5000);
    const activeSubs = subscriptions.filter((s) => s.status === "active");
    const mrrCents = activeSubs.reduce(
      (s, sub) => s + monthlyEquivalentCents(sub.plan),
      0,
    );

    // CA cumulé total (all-time paid)
    const totalRevenueCents = paidRevenue(orders);

    return {
      days,
      revenueCents,
      deltaRevenueRatio,
      orderCount: inRange.length,
      aovCents: inRange.length ? Math.round(revenueCents / inRange.length) : 0,
      creationCents,
      maintenanceCents,
      essentielleCents,
      premiumCents,
      series,
      mrrCents,
      arrCents: mrrCents * 12,
      activeSubscriptions: activeSubs.length,
      totalRevenueCents,
      paidOrderCount: paid.length,
    };
  },
});

export const ordersList = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let orders: Doc<"orders">[];
    if (args.status) {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      orders = await ctx.db.query("orders").take(2000);
    }
    return orders
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 100);
  },
});

export const subscriptionsOverview = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("unpaid"),
        v.literal("incomplete"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("subscriptions").take(5000);
    const now = Date.now();
    const in30 = now + 30 * DAY_MS;
    const in90 = now + 90 * DAY_MS;

    const byStatus: Record<string, number> = {};
    let mrrCents = 0;
    let due30 = 0;
    let due30Cents = 0;
    let due90 = 0;
    for (const s of all) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      if (s.status === "active") {
        mrrCents += monthlyEquivalentCents(s.plan);
        const end = s.currentPeriodEnd ?? 0;
        if (end && end <= in30) {
          due30 += 1;
          due30Cents += MAINTENANCE_ANNUAL_CENTS[s.plan] ?? 49000;
        }
        if (end && end <= in90) due90 += 1;
      }
    }

    const filtered = (args.status ? all.filter((s) => s.status === args.status) : all)
      .sort((a, b) => (a.currentPeriodEnd ?? 0) - (b.currentPeriodEnd ?? 0))
      .map((s) => ({
        ...s,
        annualCents: MAINTENANCE_ANNUAL_CENTS[s.plan] ?? 49000,
        monthlyEqCents: monthlyEquivalentCents(s.plan),
      }));

    return {
      list: filtered,
      stats: {
        total: all.length,
        byStatus,
        active: byStatus["active"] ?? 0,
        pastDue: byStatus["past_due"] ?? 0,
        canceled: byStatus["canceled"] ?? 0,
        mrrCents,
        arrCents: mrrCents * 12,
        due30Count: due30,
        due30Cents,
        due90Count: due90,
      },
    };
  },
});

export const invoicesOverview = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("open"),
        v.literal("paid"),
        v.literal("void"),
        v.literal("uncollectible"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("invoices").take(5000);
    const now = Date.now();
    const monthStart = new Date(
      new Date(now).getFullYear(),
      new Date(now).getMonth(),
      1,
    ).getTime();

    const byStatus: Record<string, { count: number; cents: number }> = {};
    let paidThisMonthCents = 0;
    const buckets = new Map<number, number>();
    const base = new Date(now).getFullYear() * 12 + new Date(now).getMonth();
    for (const inv of all) {
      const b = byStatus[inv.status] ?? { count: 0, cents: 0 };
      b.count += 1;
      b.cents += inv.amountCents;
      byStatus[inv.status] = b;
      if (inv.status === "paid" && (inv.paidAt ?? 0) >= monthStart) {
        paidThisMonthCents += inv.amountCents;
      }
      if (inv.status === "paid" && inv.paidAt) {
        const d = new Date(inv.paidAt);
        const key = d.getFullYear() * 12 + d.getMonth();
        buckets.set(key, (buckets.get(key) ?? 0) + inv.amountCents);
      }
    }
    const monthly: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const key = base - i;
      monthly.push({
        label: MONTH_LABELS[((key % 12) + 12) % 12],
        value: buckets.get(key) ?? 0,
      });
    }

    const list = (args.status ? all.filter((i) => i.status === args.status) : all)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);

    return {
      list,
      stats: {
        total: all.length,
        byStatus,
        paidThisMonthCents,
        openCount: byStatus["open"]?.count ?? 0,
        openCents: byStatus["open"]?.cents ?? 0,
      },
      monthly,
    };
  },
});
