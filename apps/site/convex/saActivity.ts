import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";

type SaKind = "commerce" | "deployment" | "incident" | "client" | "system";

export async function recordSaActivity(
  ctx: MutationCtx,
  entry: {
    kind: SaKind;
    action: string;
    summary: string;
    actorName?: string;
    customerEmail?: string;
    deploymentId?: Id<"saDeployments">;
    incidentId?: Id<"saIncidents">;
  },
): Promise<void> {
  await ctx.db.insert("saActivity", {
    kind: entry.kind,
    action: entry.action,
    summary: entry.summary,
    actorName: entry.actorName,
    customerEmail: entry.customerEmail,
    deploymentId: entry.deploymentId,
    incidentId: entry.incidentId,
    createdAt: Date.now(),
  });
}

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("saActivity")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit ?? 40);
  },
});
