import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { recordSaActivity } from "./saActivity";
import { DAY_MS, startOfDay, summarize } from "./saLib";
import { newLicenseKey } from "./maintenance";

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
    let monitored = 0;
    for (const d of deps) {
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      byHealth[d.health] = (byHealth[d.health] ?? 0) + 1;
      /* Only deployments the prober has actually reached carry an uptime.
         Averaging in the provisioning placeholder is how the console came to
         quote a fleet-wide figure nobody had measured. */
      if (
        (d.status === "live" || d.status === "degraded") &&
        d.lastCheckAt !== undefined
      ) {
        uptimeSum += d.uptime30d;
        monitored += 1;
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
      monitored,
      avgUptime: monitored ? uptimeSum / monitored : null,
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
      /* Placeholder, not a measurement. `uptime30d` is owned by
         convex/saMonitoring.ts and means nothing until the prober has run, so
         every reader gates it on `lastCheckAt`. It starts at 0 rather than 100
         so a reader that forgets to gate shows something obviously wrong
         instead of a plausible perfect score. */
      uptime30d: 0,
      storeCount: 0,
      provisionedAt: now,
      integrations: [],
      maintenance: { status: "none", autoRenew: false },
      /* Stamped now so the site can be provisioned with it in its sentinel;
         without one its update scripts read as unregistered. */
      licenseKey: newLicenseKey(),
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
    /* Going live stamps the date and nothing else. This used to promote
       `health` from "unknown" to "healthy", which was an assertion about a
       system nobody had contacted; `health` is now written only by the prober
       (convex/saMonitoring.ts), and stays "unknown" until it has run. */
    if (args.status === "live" && !dep.goLiveAt) {
      patch.goLiveAt = Date.now();
    }
    /* Marking a client gone revokes nothing on its own — the deployment keeps
       the credentials it was provisioned with. Stamp the date so the console
       can show that revocation is still outstanding, rather than letting the
       "Sorti" badge read as done. See tasks/client-offboarding-runbook.md. */
    if (args.status === "offboarded" && !dep.offboardedAt) {
      patch.offboardedAt = Date.now();
    }
    /* Coming back out of offboarding drops both stamps: they describe the
       current departure, not a past one. */
    if (dep.status === "offboarded" && args.status !== "offboarded") {
      patch.offboardedAt = undefined;
      patch.accessRevokedAt = undefined;
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
    if (args.status === "offboarded" && !dep.accessRevokedAt) {
      await recordSaActivity(ctx, {
        kind: "system",
        action: "deployment.revocation_pending",
        summary:
          `« ${dep.name} » est sorti, mais ses accès ne sont pas encore ` +
          `révoqués (clés AWS, GitHub, Convex, licence).`,
        actorName: `${admin.firstName ?? "Admin"}`,
        customerEmail: dep.customerEmail,
        deploymentId: dep._id,
      });
    }
  },
});

/* Records that the revocation steps in tasks/client-offboarding-runbook.md have
   been carried out. It cannot verify them — revoking an IAM key or a GitHub
   invitation happens outside this backend — so this is an attestation by an
   admin, not a measurement. Its value is that an unticked deployment stays
   visibly unfinished instead of disappearing behind a status badge. */
export const recordAccessRevoked = mutation({
  args: { deploymentId: v.id("saDeployments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const dep = await ctx.db.get(args.deploymentId);
    if (!dep) throw new Error("Déploiement introuvable.");
    if (dep.status !== "offboarded") {
      throw new Error(
        "Seul un déploiement sorti peut voir ses accès marqués révoqués.",
      );
    }
    if (dep.accessRevokedAt) return;

    const now = Date.now();
    await ctx.db.patch(args.deploymentId, {
      accessRevokedAt: now,
      updatedAt: now,
    });
    await recordSaActivity(ctx, {
      kind: "system",
      action: "deployment.access_revoked",
      summary: `Accès de « ${dep.name} » déclarés révoqués.`,
      actorName: `${admin.firstName ?? "Admin"}`,
      customerEmail: dep.customerEmail,
      deploymentId: dep._id,
    });
  },
});

/* ── Operator corrections ──
   The fields a human keeps up to date by hand, and only those.

   `health` and `uptime30d` used to be settable here and no longer are: since
   convex/saMonitoring.ts probes the fleet, they are computed from
   `saMonitoringChecks` on every round. Leaving them writable would let an
   operator type a figure that the next probe silently overwrites ten minutes
   later — a worse failure than the one this replaced, because it looks like it
   worked. Health is corrected by fixing the instance, or by « Sonder
   maintenant ». */
export const update = mutation({
  args: {
    deploymentId: v.id("saDeployments"),
    domain: v.optional(v.string()),
    region: v.optional(v.string()),
    version: v.optional(v.string()),
    latestVersion: v.optional(v.string()),
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
    /* `lastDeployAt` had no writer at all. Recording a new running version is
       the one moment we know a deploy happened, so stamp it here rather than
       leaving the console's « Dernier déploiement » permanently empty. */
    if (args.version !== undefined && args.version !== dep.version) {
      patch.lastDeployAt = Date.now();
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

/* ── License key ──
   Issues (or rotates) the key a site presents to /maintenance/status. Sites
   provisioned before the entitlement gate existed have none and read as
   unregistered until this runs; rotating one invalidates the key held by the
   site, so it has to be written back into its .beindigital-site.json. */
export const issueLicenseKey = mutation({
  args: { deploymentId: v.id("saDeployments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const dep = await ctx.db.get(args.deploymentId);
    if (!dep) throw new Error("Déploiement introuvable.");

    const licenseKey = newLicenseKey();
    await ctx.db.patch(args.deploymentId, {
      licenseKey,
      updatedAt: Date.now(),
    });
    await recordSaActivity(ctx, {
      kind: "deployment",
      action: "deployment.license_issued",
      summary: dep.licenseKey
        ? `Clé de licence de « ${dep.name} » régénérée — à reporter dans son .beindigital-site.json`
        : `Clé de licence émise pour « ${dep.name} »`,
      actorName: `${admin.firstName ?? "Admin"}`,
      customerEmail: dep.customerEmail,
      deploymentId: dep._id,
    });
    return licenseKey;
  },
});
