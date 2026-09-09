import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { recordSaActivity } from "./saActivity";

const SEV_LABEL: Record<string, string> = {
  sev1: "SEV1",
  sev2: "SEV2",
  sev3: "SEV3",
  sev4: "SEV4",
};

const severity = v.union(
  v.literal("sev1"),
  v.literal("sev2"),
  v.literal("sev3"),
  v.literal("sev4"),
);
const incidentStatus = v.union(
  v.literal("open"),
  v.literal("investigating"),
  v.literal("identified"),
  v.literal("monitoring"),
  v.literal("resolved"),
);
const area = v.union(
  v.literal("payments"),
  v.literal("orders"),
  v.literal("kitchen"),
  v.literal("integrations"),
  v.literal("site"),
  v.literal("delivery"),
  v.literal("auth"),
  v.literal("other"),
);

async function nextNumber(ctx: MutationCtx): Promise<string> {
  const all = await ctx.db.query("saIncidents").collect();
  return `INC-${new Date().getFullYear()}-${String(all.length + 1).padStart(4, "0")}`;
}

function adminName(a: { firstName?: string; lastName?: string }): string {
  return `${a.firstName ?? "Admin"}${a.lastName ? " " + a.lastName : ""}`;
}

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const list = query({
  args: {
    status: v.optional(incidentStatus),
    severity: v.optional(severity),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let incidents: Doc<"saIncidents">[];
    if (args.status) {
      incidents = await ctx.db
        .query("saIncidents")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else if (args.severity) {
      incidents = await ctx.db
        .query("saIncidents")
        .withIndex("by_severity", (q) => q.eq("severity", args.severity!))
        .collect();
    } else {
      incidents = await ctx.db
        .query("saIncidents")
        .withIndex("by_startedAt")
        .order("desc")
        .take(200);
    }
    if (args.status && args.severity)
      incidents = incidents.filter((i) => i.severity === args.severity);
    return incidents
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, args.limit ?? 200);
  },
});

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const get = query({
  args: { incidentId: v.id("saIncidents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) return null;
    const updates = (
      await ctx.db
        .query("saIncidentUpdates")
        .withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId))
        .collect()
    ).sort((a, b) => a.createdAt - b.createdAt);
    const deployment = incident.deploymentId
      ? await ctx.db.get(incident.deploymentId)
      : null;
    return { ...incident, updates, deployment };
  },
});

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const incidents = await ctx.db.query("saIncidents").take(1000);
    const now = Date.now();
    const monthStart = new Date(
      new Date(now).getFullYear(),
      new Date(now).getMonth(),
      1,
    ).getTime();
    const ninetyDaysAgo = now - 90 * 86_400_000;

    const open = incidents.filter((i) => i.status !== "resolved");
    const openBySeverity: Record<string, number> = {
      sev1: 0,
      sev2: 0,
      sev3: 0,
      sev4: 0,
    };
    for (const i of open)
      openBySeverity[i.severity] = (openBySeverity[i.severity] ?? 0) + 1;

    const resolvedRecent = incidents.filter(
      (i) =>
        i.status === "resolved" && i.resolvedAt && i.resolvedAt >= ninetyDaysAgo,
    );
    const mttrMs = resolvedRecent.length
      ? Math.round(
          resolvedRecent.reduce(
            (sum, i) => sum + ((i.resolvedAt ?? 0) - i.startedAt),
            0,
          ) / resolvedRecent.length,
        )
      : 0;

    return {
      total: incidents.length,
      openCount: open.length,
      openBySeverity: {
        sev1: openBySeverity.sev1 ?? 0,
        sev2: openBySeverity.sev2 ?? 0,
        sev3: openBySeverity.sev3 ?? 0,
        sev4: openBySeverity.sev4 ?? 0,
      },
      sev1Open: openBySeverity.sev1 ?? 0,
      resolvedThisMonth: incidents.filter(
        (i) => i.status === "resolved" && (i.resolvedAt ?? 0) >= monthStart,
      ).length,
      mttrMs,
    };
  },
});

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const create = mutation({
  args: {
    title: v.string(),
    severity,
    deploymentId: v.optional(v.id("saDeployments")),
    area: v.optional(v.array(area)),
    detectedBy: v.optional(
      v.union(v.literal("monitoring"), v.literal("client"), v.literal("team")),
    ),
    impact: v.optional(v.string()),
    description: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    let customerEmail: string | undefined;
    let restaurantName: string | undefined;
    if (args.deploymentId) {
      const dep = await ctx.db.get(args.deploymentId);
      customerEmail = dep?.customerEmail;
      restaurantName = dep?.restaurantName;
    }
    const number = await nextNumber(ctx);
    const id = await ctx.db.insert("saIncidents", {
      number,
      title: args.title,
      description: args.description,
      deploymentId: args.deploymentId,
      customerEmail,
      restaurantName,
      severity: args.severity,
      status: "open",
      area: args.area ?? ["other"],
      detectedBy: args.detectedBy ?? "team",
      assigneeName: args.assigneeName,
      impact: args.impact,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("saIncidentUpdates", {
      incidentId: id,
      status: "open",
      message: `Incident ouvert (${SEV_LABEL[args.severity]}).`,
      authorName: adminName(admin),
      createdAt: now,
    });
    await recordSaActivity(ctx, {
      kind: "incident",
      action: "incident.created",
      summary: `${number} · ${args.title} (${SEV_LABEL[args.severity]})`,
      actorName: adminName(admin),
      customerEmail,
      deploymentId: args.deploymentId,
      incidentId: id,
    });
    return id;
  },
});

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const addUpdate = mutation({
  args: {
    incidentId: v.id("saIncidents"),
    message: v.string(),
    status: v.optional(incidentStatus),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new Error("Incident introuvable.");
    const now = Date.now();
    await ctx.db.insert("saIncidentUpdates", {
      incidentId: args.incidentId,
      status: args.status,
      message: args.message,
      authorName: adminName(admin),
      createdAt: now,
    });
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.status) {
      patch.status = args.status;
      if (!incident.acknowledgedAt && args.status !== "open") {
        patch.acknowledgedAt = now;
      }
      if (args.status === "resolved") {
        patch.resolvedAt = now;
        patch.resolutionSummary = args.message;
      } else if (incident.resolvedAt) {
        patch.resolvedAt = undefined;
      }
    }
    await ctx.db.patch(args.incidentId, patch);
    await recordSaActivity(ctx, {
      kind: "incident",
      action: args.status ? "incident.status" : "incident.update",
      summary: `${incident.number} · ${args.status ?? "note"}`,
      actorName: adminName(admin),
      customerEmail: incident.customerEmail,
      deploymentId: incident.deploymentId,
      incidentId: incident._id,
    });
  },
});

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const assign = mutation({
  args: {
    incidentId: v.id("saIncidents"),
    assigneeName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new Error("Incident introuvable.");
    await ctx.db.patch(args.incidentId, {
      assigneeName: args.assigneeName,
      updatedAt: Date.now(),
    });
    await recordSaActivity(ctx, {
      kind: "incident",
      action: "incident.assigned",
      summary: `${incident.number} assigné à ${args.assigneeName ?? "personne"}`,
      actorName: adminName(admin),
      incidentId: incident._id,
    });
  },
});
