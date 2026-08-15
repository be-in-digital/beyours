import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { recordSaActivity } from "./saActivity";
import { DAY_MS, startOfDay, summarize } from "./saLib";

const HEALTH_RANK: Record<string, number> = {
  down: 3,
  degraded: 2,
  unknown: 1,
  healthy: 0,
};

const deploymentStatus = v.union(
  v.literal("provisioning"),
  v.literal("staging"),
  v.literal("live"),
  v.literal("degraded"),
  v.literal("suspended"),
  v.literal("offboarded"),
);
const healthStatus = v.union(
  v.literal("healthy"),
  v.literal("degraded"),
  v.literal("down"),
  v.literal("unknown"),
);
const integrationsValidator = v.array(
  v.object({
    key: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("uber_eats"),
      v.literal("deliveroo"),
      v.literal("uber_direct"),
      v.literal("ses"),
    ),
    status: v.union(
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("error"),
      v.literal("not_configured"),
    ),
    detail: v.optional(v.string()),
  }),
);

export const list = query({
  args: {
    status: v.optional(deploymentStatus),
    health: v.optional(healthStatus),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let deps: Doc<"saDeployments">[];
    if (args.status) {
      deps = await ctx.db
        .query("saDeployments")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.health) {
      deps = await ctx.db
        .query("saDeployments")
        .withIndex("by_health", (q) => q.eq("health", args.health!))
        .collect();
    } else {
      deps = await ctx.db.query("saDeployments").take(500);
    }
    if (args.status && args.health)
      deps = deps.filter((d) => d.health === args.health);
    if (args.search) {
      const s = args.search.toLowerCase();
      deps = deps.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.restaurantName.toLowerCase().includes(s) ||
          d.domain.toLowerCase().includes(s),
      );
    }
    return deps
      .map((d) => ({
        ...d,
        integrationErrors: d.integrations.filter((i) => i.status === "error")
          .length,
      }))
      .sort((a, b) => {
        const h = (HEALTH_RANK[b.health] ?? 0) - (HEALTH_RANK[a.health] ?? 0);
        return h !== 0 ? h : a.restaurantName.localeCompare(b.restaurantName);
      });
  },
});

export const get = query({
  args: { deploymentId: v.id("saDeployments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dep = await ctx.db.get(args.deploymentId);
    if (!dep) return null;

    const stores = await ctx.db
      .query("saStores")
      .withIndex("by_deployment", (q) => q.eq("deploymentId", args.deploymentId))
      .collect();

    const recentChecks = await ctx.db
      .query("saMonitoringChecks")
      .withIndex("by_deployment_time", (q) =>
        q.eq("deploymentId", args.deploymentId),
      )
      .order("desc")
      .take(16);

    const incidents = (
      await ctx.db
        .query("saIncidents")
        .withIndex("by_deployment", (q) =>
          q.eq("deploymentId", args.deploymentId),
        )
        .collect()
    ).sort((a, b) => b.startedAt - a.startedAt);

    const since = startOfDay(Date.now()) - 29 * DAY_MS;
    const snaps = await ctx.db
      .query("saSalesSnapshots")
      .withIndex("by_deployment_day", (q) =>
        q.eq("deploymentId", args.deploymentId).gte("dayTs", since),
      )
      .collect();

    return {
      ...dep,
      stores,
      recentChecks,
      latestCheck: recentChecks[0] ?? null,
      incidents: incidents.slice(0, 12),
      openIncidentCount: incidents.filter((i) => i.status !== "resolved").length,
      sales30: summarize(snaps),
    };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const deps = await ctx.db.query("saDeployments").take(500);
    const byStatus: Record<string, number> = {};
    const byHealth: Record<string, number> = {};
    let uptimeSum = 0;
    let liveCount = 0;
    for (const d of deps) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      byHealth[d.health] = (byHealth[d.health] ?? 0) + 1;
      if (d.status === "live" || d.status === "degraded") {
        uptimeSum += d.uptime30d;
        liveCount += 1;
      }
    }
    return {
      total: deps.length,
      byStatus,
      byHealth,
      live: byStatus["live"] ?? 0,
      provisioning: byStatus["provisioning"] ?? 0,
      degraded: byHealth["degraded"] ?? 0,
      down: byHealth["down"] ?? 0,
      avgUptime: liveCount ? uptimeSum / liveCount : 100,
    };
  },
});

export const create = mutation({
  args: {
    customerEmail: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    name: v.string(),
    domain: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    region: v.optional(v.string()),
    convexUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("saDeployments", {
      customerEmail: args.customerEmail,
      restaurantName: args.restaurantName,
      city: args.city,
      name: args.name,
      domain: args.domain,
      convexUrl: args.convexUrl,
      environment: "production",
      status: "provisioning",
      health: "unknown",
      region: args.region ?? "eu-west-3",
      plan: args.plan,
      uptime30d: 100,
      storeCount: 0,
      provisionedAt: now,
      integrations: [],
      maintenance: { status: "none", autoRenew: false },
      createdAt: now,
      updatedAt: now,
    });
    await recordSaActivity(ctx, {
      kind: "deployment",
      action: "deployment.created",
      summary: `Déploiement « ${args.name} » provisionné (${args.restaurantName})`,
      actorName: `${admin.firstName ?? "Admin"}`,
      customerEmail: args.customerEmail,
      deploymentId: id,
    });
    return id;
  },
});

export const updateStatus = mutation({
  args: { deploymentId: v.id("saDeployments"), status: deploymentStatus },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const dep = await ctx.db.get(args.deploymentId);
    if (!dep) throw new Error("Déploiement introuvable.");
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.status === "live") {
      if (!dep.goLiveAt) patch.goLiveAt = Date.now();
      if (dep.health === "unknown") patch.health = "healthy";
    }
    await ctx.db.patch(args.deploymentId, patch);
    await recordSaActivity(ctx, {
      kind: "deployment",
      action: "deployment.status",
      summary: `« ${dep.name} » → ${args.status}`,
      actorName: `${admin.firstName ?? "Admin"}`,
      customerEmail: dep.customerEmail,
      deploymentId: dep._id,
    });
  },
});

export const update = mutation({
  args: {
    deploymentId: v.id("saDeployments"),
    domain: v.optional(v.string()),
    region: v.optional(v.string()),
    version: v.optional(v.string()),
    latestVersion: v.optional(v.string()),
    health: v.optional(healthStatus),
    uptime30d: v.optional(v.number()),
    storeCount: v.optional(v.number()),
    notes: v.optional(v.string()),
    integrations: v.optional(integrationsValidator),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { deploymentId, ...rest } = args;
    const dep = await ctx.db.get(deploymentId);
    if (!dep) throw new Error("Déploiement introuvable.");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(deploymentId, patch);
    await recordSaActivity(ctx, {
      kind: "deployment",
      action: "deployment.updated",
      summary: `« ${dep.name} » mis à jour`,
      actorName: `${admin.firstName ?? "Admin"}`,
      customerEmail: dep.customerEmail,
      deploymentId: dep._id,
    });
  },
});
