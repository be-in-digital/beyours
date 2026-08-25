import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import {
  DAY_MS,
  startOfDay,
  summarize,
  buildDailySeries,
  readSnapshotsInRange,
  monthlyEquivalentCents,
  annualMaintenanceCents,
} from "./saLib";

/** KPI bundle for the superadmin overview (real sales + fleet + GMV). */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const todayStart = startOfDay(now);
    const since30 = todayStart - 29 * DAY_MS;
    const prevSince = since30 - 30 * DAY_MS;
    const monthStart = new Date(
      new Date(now).getFullYear(),
      new Date(now).getMonth(),
      1,
    ).getTime();
    const in30 = now + 30 * DAY_MS;

    const [orders, subscriptions, invoices, prospects, deployments, incidents, current, previous, activity] =
      await Promise.all([
        ctx.db.query("orders").take(5000),
        ctx.db.query("subscriptions").take(5000),
        ctx.db.query("invoices").take(5000),
        ctx.db.query("whitelist").take(2000),
        ctx.db.query("saDeployments").take(500),
        ctx.db.query("saIncidents").take(1000),
        readSnapshotsInRange(ctx, since30),
        readSnapshotsInRange(ctx, prevSince, since30),
        ctx.db.query("saActivity").withIndex("by_createdAt").order("desc").take(8),
      ]);

    /* Sales (real) */
    const paid = orders.filter((o) => o.status === "paid");
    const rev30 = paid
      .filter((o) => o.createdAt >= since30)
      .reduce((s, o) => s + o.amountCents, 0);
    const revPrev = paid
      .filter((o) => o.createdAt >= prevSince && o.createdAt < since30)
      .reduce((s, o) => s + o.amountCents, 0);
    const deltaRevenueRatio = revPrev > 0 ? (rev30 - revPrev) / revPrev : 0;

    const byDay = new Map<number, number>();
    for (const o of paid) {
      if (o.createdAt < since30) continue;
      const d = startOfDay(o.createdAt);
      byDay.set(d, (byDay.get(d) ?? 0) + o.amountCents);
    }
    const revenueSeries: { day: string; dayTs: number; revenueCents: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayTs = todayStart - i * DAY_MS;
      revenueSeries.push({
        day: new Date(dayTs).toISOString().slice(0, 10),
        dayTs,
        revenueCents: byDay.get(dayTs) ?? 0,
      });
    }

    const activeSubs = subscriptions.filter((s) => s.status === "active");
    const mrrCents = activeSubs.reduce(
      (s, sub) => s + monthlyEquivalentCents(sub.plan),
      0,
    );
    let due30Count = 0;
    let due30Cents = 0;
    for (const s of activeSubs) {
      if ((s.currentPeriodEnd ?? 0) && (s.currentPeriodEnd ?? 0) <= in30) {
        due30Count += 1;
        due30Cents += annualMaintenanceCents(s.plan);
      }
    }
    const pastDueSubs = subscriptions.filter((s) => s.status === "past_due").length;

    const paidThisMonthCents = invoices
      .filter((i) => i.status === "paid" && (i.paidAt ?? 0) >= monthStart)
      .reduce((s, i) => s + i.amountCents, 0);
    const openInvoices = invoices.filter((i) => i.status === "open").length;

    /* Flotte */
    const byHealth: Record<string, number> = {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    const byStatus: Record<string, number> = {};
    let uptimeSum = 0;
    let liveish = 0;
    let integrationErrors = 0;
    for (const d of deployments) {
      byHealth[d.health] = (byHealth[d.health] ?? 0) + 1;
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      integrationErrors += d.integrations.filter((i) => i.status === "error").length;
      if (d.status === "live" || d.status === "degraded") {
        uptimeSum += d.uptime30d;
        liveish += 1;
      }
    }

    /* GMV flotte */
    const gmvTotals = summarize(current);
    const gmvPrev = summarize(previous);
    const deltaGrossRatio =
      gmvPrev.grossCents > 0
        ? (gmvTotals.grossCents - gmvPrev.grossCents) / gmvPrev.grossCents
        : 0;
    const gmvSeries = buildDailySeries(current, 30, todayStart);

    /* Incidents */
    const open = incidents.filter((i) => i.status !== "resolved");
    const openBySeverity: Record<string, number> = {
      sev1: 0,
      sev2: 0,
      sev3: 0,
      sev4: 0,
    };
    for (const i of open)
      openBySeverity[i.severity] = (openBySeverity[i.severity] ?? 0) + 1;
    const recentIncidents = open
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 5)
      .map((i) => ({
        _id: i._id as Id<"saIncidents">,
        number: i.number,
        title: i.title,
        severity: i.severity,
        status: i.status,
        startedAt: i.startedAt,
        restaurantName: i.restaurantName ?? null,
      }));

    const clientEmails = new Set(orders.map((o) => o.customerEmail));

    return {
      commerce: {
        revenue30Cents: rev30,
        deltaRevenueRatio,
        mrrCents,
        arrCents: mrrCents * 12,
        orderCount30: paid.filter((o) => o.createdAt >= since30).length,
        revenueSeries,
        paidThisMonthCents,
        openInvoices,
        totalClients: clientEmails.size,
        prospects: prospects.length,
        activeSubscriptions: activeSubs.length,
      },
      gmv: {
        grossCents: gmvTotals.grossCents,
        deltaGrossRatio,
        orderCount: gmvTotals.orderCount,
        series: gmvSeries,
        bySource: gmvTotals.bySource,
        activeDeployments: new Set(current.map((s) => s.deploymentId)).size,
      },
      fleet: {
        total: deployments.length,
        live: byStatus["live"] ?? 0,
        byHealth: {
          healthy: byHealth.healthy ?? 0,
          degraded: byHealth.degraded ?? 0,
          down: byHealth.down ?? 0,
          unknown: byHealth.unknown ?? 0,
        },
        avgUptime: liveish ? uptimeSum / liveish : 100,
        integrationErrors,
      },
      incidents: {
        open: open.length,
        openBySeverity: {
          sev1: openBySeverity.sev1 ?? 0,
          sev2: openBySeverity.sev2 ?? 0,
          sev3: openBySeverity.sev3 ?? 0,
          sev4: openBySeverity.sev4 ?? 0,
        },
        sev1Open: openBySeverity.sev1 ?? 0,
        recent: recentIncidents,
      },
      renewals: { due30Count, due30Cents, pastDueSubs },
      activity,
    };
  },
});
