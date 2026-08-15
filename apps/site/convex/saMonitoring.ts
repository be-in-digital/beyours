import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { recordSaActivity } from "./saActivity";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const deps = await ctx.db.query("saDeployments").take(500);
    const rows = await Promise.all(
      deps.map(async (d) => {
        const latest = await ctx.db
          .query("saMonitoringChecks")
          .withIndex("by_deployment_time", (q) => q.eq("deploymentId", d._id))
          .order("desc")
          .first();
        return {
          _id: d._id,
          name: d.name,
          restaurantName: d.restaurantName,
          domain: d.domain,
          status: d.status,
          health: d.health,
          uptime30d: d.uptime30d,
          version: d.version,
          region: d.region,
          latestCheck: latest,
          integrationErrors: d.integrations.filter((i) => i.status === "error"),
        };
      }),
    );
    const byHealth: Record<string, number> = {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    let uptimeSum = 0;
    let monitored = 0;
    let integrationErrors = 0;
    for (const r of rows) {
      byHealth[r.health] = (byHealth[r.health] ?? 0) + 1;
      integrationErrors += r.integrationErrors.length;
      if (r.status === "live" || r.status === "degraded") {
        uptimeSum += r.uptime30d;
        monitored += 1;
      }
    }
    const rank: Record<string, number> = {
      down: 3,
      degraded: 2,
      unknown: 1,
      healthy: 0,
    };
    return {
      deployments: rows.sort(
        (a, b) => (rank[b.health] ?? 0) - (rank[a.health] ?? 0),
      ),
      rollup: {
        total: deps.length,
        byHealth: {
          healthy: byHealth.healthy ?? 0,
          degraded: byHealth.degraded ?? 0,
          down: byHealth.down ?? 0,
          unknown: byHealth.unknown ?? 0,
        },
        integrationErrors,
        avgUptime: monitored ? uptimeSum / monitored : 100,
      },
    };
  },
});

export const recentChecks = query({
  args: {
    deploymentId: v.optional(v.id("saDeployments")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 40;
    let checks: Doc<"saMonitoringChecks">[];
    if (args.deploymentId) {
      checks = await ctx.db
        .query("saMonitoringChecks")
        .withIndex("by_deployment_time", (q) =>
          q.eq("deploymentId", args.deploymentId!),
        )
        .order("desc")
        .take(limit);
    } else {
      checks = await ctx.db
        .query("saMonitoringChecks")
        .withIndex("by_checkedAt")
        .order("desc")
        .take(limit);
    }
    const deps = await ctx.db.query("saDeployments").take(500);
    const depMap = new Map(deps.map((d) => [d._id as Id<"saDeployments">, d]));
    return checks.map((c) => ({
      ...c,
      deploymentName: depMap.get(c.deploymentId)?.restaurantName ?? "—",
    }));
  },
});

export const recordCheck = mutation({
  args: {
    deploymentId: v.id("saDeployments"),
    kind: v.union(
      v.literal("http"),
      v.literal("convex"),
      v.literal("integration"),
      v.literal("webhook"),
    ),
    target: v.string(),
    status: v.union(
      v.literal("up"),
      v.literal("down"),
      v.literal("degraded"),
    ),
    latencyMs: v.optional(v.number()),
    statusCode: v.optional(v.number()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const dep = await ctx.db.get(args.deploymentId);
    if (!dep) throw new Error("Déploiement introuvable.");
    const now = Date.now();
    await ctx.db.insert("saMonitoringChecks", {
      deploymentId: args.deploymentId,
      kind: args.kind,
      target: args.target,
      status: args.status,
      latencyMs: args.latencyMs,
      statusCode: args.statusCode,
      message: args.message,
      checkedAt: now,
    });
    const patch: Record<string, unknown> = { lastCheckAt: now };
    if (args.kind === "http" || args.kind === "convex") {
      patch.health =
        args.status === "up"
          ? "healthy"
          : args.status === "degraded"
            ? "degraded"
            : "down";
    }
    await ctx.db.patch(args.deploymentId, patch);
    if (args.status !== "up") {
      await recordSaActivity(ctx, {
        kind: "system",
        action: "monitoring.check",
        summary: `${dep.restaurantName} · ${args.target} → ${args.status}`,
        actorName: `${admin.firstName ?? "Admin"}`,
        customerEmail: dep.customerEmail,
        deploymentId: dep._id,
      });
    }
  },
});
