import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ── Public queries ── */

/** Get the currently active contract version */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const versions = await ctx.db
      .query("contractVersions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    return versions[0] ?? null;
  },
});

/* ── Internal queries ── */

export const getActiveInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const versions = await ctx.db
      .query("contractVersions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    return versions[0] ?? null;
  },
});

export const getById = internalQuery({
  args: { id: v.id("contractVersions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/* ── Admin mutations ── */

/** Create a new contract version (admin only) */
export const create = mutation({
  args: {
    version: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate || affiliate.role !== "admin") {
      throw new Error("Accès refusé");
    }

    // Compute SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(args.content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const contentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return await ctx.db.insert("contractVersions", {
      version: args.version,
      title: args.title,
      content: args.content,
      contentHash,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

/** Activate a contract version (admin only) — archives all others */
export const activate = mutation({
  args: { id: v.id("contractVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!affiliate || affiliate.role !== "admin") {
      throw new Error("Accès refusé");
    }

    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version introuvable");

    // Archive all currently active versions
    const activeVersions = await ctx.db
      .query("contractVersions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(10);

    for (const v of activeVersions) {
      await ctx.db.patch(v._id, {
        status: "archived",
        archivedAt: Date.now(),
      });
    }

    // Activate the new version
    await ctx.db.patch(args.id, {
      status: "active",
      activatedAt: Date.now(),
    });

    // Block all affiliates who haven't signed this version
    const affiliates = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_contractStatus", (q) => q.eq("contractStatus", "active"))
      .take(500);

    for (const a of affiliates) {
      if (
        a.acceptedContractVersionId !== args.id
      ) {
        await ctx.db.patch(a._id, {
          contractStatus: "blocked_new_version",
          requiredContractVersionId: args.id,
        });
      }
    }
  },
});

/* ── Internal mutations ── */

/** Seed the initial contract version (called from admin setup) */
export const seedV1 = internalMutation({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if any version exists already
    const existing = await ctx.db
      .query("contractVersions")
      .take(1);
    if (existing.length > 0) return existing[0]!._id;

    const encoder = new TextEncoder();
    const data = encoder.encode(args.content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const contentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const now = Date.now();
    return await ctx.db.insert("contractVersions", {
      version: "1.0",
      title: args.title,
      content: args.content,
      contentHash,
      status: "active",
      createdAt: now,
      activatedAt: now,
    });
  },
});
