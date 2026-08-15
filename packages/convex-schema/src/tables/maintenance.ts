/**
 * Maintenance & Migration — Table Definitions
 *
 * Tables for the platform maintenance contract lifecycle:
 * - maintenanceContracts: singleton — coverage window of the deployment
 *   (1 year included at purchase, then annual renewal). While covered,
 *   the client receives platform updates; once expired, the deployment
 *   stays frozen on the last release published before `coveredUntil`.
 * - platformReleases: catalog of published engine releases (synced from
 *   the npm registry on each update check, or inserted manually).
 * - migrationRequests: client request to move the whole site (code,
 *   database, assets, domain…) to a server/team of their choice.
 */

import { defineTable } from "convex/server"
import { v } from "convex/values"

// ============================================================================
// Maintenance Contract (singleton)
// ============================================================================

/**
 * One row per deployment (1 Convex instance = 1 client).
 * Managed by the BeYours team (internal mutation or SUPER_ADMIN);
 * read-only for the client.
 */
export const maintenanceContractsTable = defineTable({
  /** Start of coverage — theme purchase / site activation */
  startedAt: v.number(),
  /** End of coverage — releases published before this date remain accessible */
  coveredUntil: v.number(),
  /** Informative: renewal handled automatically (billing) vs manual invoice */
  autoRenew: v.boolean(),
  lastRenewedAt: v.optional(v.number()),
  // Billing hooks — filled when renewal goes through Stripe (future)
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  notes: v.optional(v.string()),
  /** userId (or "seed"/"beindigital") of the last writer */
  updatedBy: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// ============================================================================
// Platform Releases
// ============================================================================

/**
 * Catalog of engine releases. `releasedAt` is compared to the contract's
 * `coveredUntil` to decide whether a client is entitled to the update.
 */
export const platformReleasesTable = defineTable({
  /** Semver, e.g. "2.1.0" */
  version: v.string(),
  releasedAt: v.number(),
  notes: v.optional(v.string()),
  source: v.union(v.literal("npm"), v.literal("manual")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_version", ["version"])
  .index("by_releasedAt", ["releasedAt"])

// ============================================================================
// Migration Requests
// ============================================================================

export const migrationRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("acknowledged"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("declined"),
)

export const migrationScopeValidator = v.union(
  v.literal("code"),
  v.literal("database"),
  v.literal("assets"),
  v.literal("domain"),
  v.literal("emails"),
)

/**
 * Request to hand the site over to another host/team.
 * Created by the client (CLIENT_ADMIN); fulfilled by the BeYours team.
 */
export const migrationRequestsTable = defineTable({
  /** Better Auth userId of the requester */
  requestedBy: v.string(),
  contactEmail: v.string(),
  contactPhone: v.optional(v.string()),
  /** Target host chosen by the client (e.g. "OVH VPS", "Vercel", "AWS") */
  targetProvider: v.string(),
  /** Team taking over the site (agency, internal dev…) */
  targetTeam: v.optional(v.string()),
  targetTeamEmail: v.optional(v.string()),
  scope: v.array(migrationScopeValidator),
  preferredDate: v.optional(v.number()),
  notes: v.optional(v.string()),
  status: migrationRequestStatusValidator,
  statusHistory: v.array(
    v.object({
      status: migrationRequestStatusValidator,
      changedAt: v.number(),
      changedBy: v.string(),
      note: v.optional(v.string()),
    }),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_status", ["status"])
  .index("by_requestedBy", ["requestedBy"])
  .index("by_createdAt", ["createdAt"])
