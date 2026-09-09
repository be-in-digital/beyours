import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  APPORTEUR_CONTRACT_CONTENT,
  APPORTEUR_CONTRACT_TITLE,
} from "./contractContent";

/** SHA-256 hex digest of a contract's content (audit trail / integrity). */
async function sha256Hex(content: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── Public queries ── */

/** Get the currently active contract version */
// @public-by-design: the apporteur contract an affiliate has to READ before
//   signing it, so it has to render before they have an account
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
// @guarded-inline: reads the caller from the session with getAuthUserId and
//   answers only about that account
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
// @guarded-inline: reads the caller from the session with getAuthUserId and
//   answers only about that account
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

/**
 * Publishes and activates the REAL affiliate contract (the canonical text from
 * `contractContent.ts`), replacing any « (TEST) » placeholder.
 *
 * Run once, in dev as well as in prod, through the Convex CLI:
 *   npx convex run contractVersions:publishApporteurContract
 *
 * Effects: archives the active version, inserts the real contract as « active »,
 * and moves back to « blocked_new_version » every affiliate who has not signed
 * this version yet (they will have to re-sign). Idempotent: does nothing if the
 * active version already carries this content.
 */
export const publishApporteurContract = internalMutation({
  args: {},
  handler: async (ctx) => {
    const content = APPORTEUR_CONTRACT_CONTENT;
    const contentHash = await sha256Hex(content);

    const active = await ctx.db
      .query("contractVersions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(10);

    if (active.some((cv) => cv.contentHash === contentHash)) {
      return { status: "unchanged" as const };
    }

    const now = Date.now();
    for (const cv of active) {
      await ctx.db.patch(cv._id, { status: "archived", archivedAt: now });
    }

    const id = await ctx.db.insert("contractVersions", {
      version: "1.0",
      title: APPORTEUR_CONTRACT_TITLE,
      content,
      contentHash,
      status: "active",
      createdAt: now,
      activatedAt: now,
    });

    // Force affiliates still active on the previous version to re-sign.
    const affiliates = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_contractStatus", (q) => q.eq("contractStatus", "active"))
      .take(500);

    let blocked = 0;
    for (const a of affiliates) {
      if (a.acceptedContractVersionId !== id) {
        await ctx.db.patch(a._id, {
          contractStatus: "blocked_new_version",
          requiredContractVersionId: id,
        });
        blocked += 1;
      }
    }

    return { status: "published" as const, id, blocked };
  },
});
