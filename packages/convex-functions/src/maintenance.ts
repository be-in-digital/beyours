/**
 * Maintenance Functions (Package Layer)
 *
 * Pure logic — no auth. Auth is handled in app wrappers.
 *
 * Business model: the theme is sold once with 1 year of maintenance
 * included, then renewed annually. While the contract is covered, the
 * client receives every platform update. Once it expires, the deployment
 * stays frozen on the last release published before `coveredUntil`, and
 * the client can request a migration of the whole site to the host/team
 * of their choice.
 */

import { v } from "convex/values"
import { now } from "./helpers"

// ============================================================================
// Types & constants
// ============================================================================

export type MaintenanceStatus = "none" | "active" | "expiring_soon" | "expired"

export interface MaintenanceContractLike {
  startedAt: number
  coveredUntil: number
}

export interface ReleaseLike {
  version: string
  releasedAt: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Coverage ending within this window is flagged "expiring_soon" */
export const EXPIRING_SOON_DAYS = 30

export const MIGRATION_SCOPES = [
  "code",
  "database",
  "assets",
  "domain",
  "emails",
] as const
export type MigrationScope = (typeof MIGRATION_SCOPES)[number]

export type MigrationRequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined"

/** Statuses considered "open" — only one open request at a time */
export const OPEN_MIGRATION_STATUSES = [
  "pending",
  "acknowledged",
  "in_progress",
] as const

/** Allowed status transitions (fulfilment by BeInDigital, cancel by client) */
export const MIGRATION_STATUS_TRANSITIONS: Record<
  MigrationRequestStatus,
  readonly MigrationRequestStatus[]
> = {
  pending: ["acknowledged", "in_progress", "declined", "cancelled"],
  acknowledged: ["in_progress", "declined", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  declined: [],
}

// ============================================================================
// Validators (reusable)
// ============================================================================

export const migrationScopeValidator = v.union(
  v.literal("code"),
  v.literal("database"),
  v.literal("assets"),
  v.literal("domain"),
  v.literal("emails"),
)

export const migrationRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("acknowledged"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("declined"),
)

// ============================================================================
// Pure logic
// ============================================================================

/** Derive the maintenance status of a contract at a given time */
export function computeMaintenanceStatus(
  contract: MaintenanceContractLike | null | undefined,
  nowMs: number,
): MaintenanceStatus {
  if (!contract) return "none"
  if (nowMs > contract.coveredUntil) return "expired"
  if (contract.coveredUntil - nowMs <= EXPIRING_SOON_DAYS * DAY_MS) {
    return "expiring_soon"
  }
  return "active"
}

/** Whole days of coverage left (0 when expired or no contract) */
export function daysRemaining(
  contract: MaintenanceContractLike | null | undefined,
  nowMs: number,
): number {
  if (!contract || nowMs > contract.coveredUntil) return 0
  return Math.floor((contract.coveredUntil - nowMs) / DAY_MS)
}

/**
 * A release is covered when it was published before the end of coverage.
 * No contract → nothing is covered.
 */
export function isReleaseCovered(
  releasedAt: number,
  contract: MaintenanceContractLike | null | undefined,
): boolean {
  if (!contract) return false
  return releasedAt <= contract.coveredUntil
}

/**
 * Compare two semver-ish versions ("2.1.0" vs "2.0.3").
 * Numeric segment comparison; prerelease suffixes ("2.1.0-beta.1") sort
 * before their release. Returns <0, 0 or >0.
 */
export function compareVersions(a: string, b: string): number {
  const [aBase, aPre] = a.split("-", 2)
  const [bBase, bPre] = b.split("-", 2)

  const aParts = (aBase ?? "").split(".").map((s) => parseInt(s, 10))
  const bParts = (bBase ?? "").split(".").map((s) => parseInt(s, 10))
  const len = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < len; i++) {
    const ai = Number.isFinite(aParts[i]) ? (aParts[i] as number) : 0
    const bi = Number.isFinite(bParts[i]) ? (bParts[i] as number) : 0
    if (ai !== bi) return ai - bi
  }

  // Same base version: a prerelease sorts before the final release
  if (aPre && !bPre) return -1
  if (!aPre && bPre) return 1
  if (aPre && bPre) return aPre.localeCompare(bPre)
  return 0
}

export interface UpdateEntitlement {
  /** Latest published version, regardless of coverage */
  latestVersion: string | null
  /** Latest version the contract entitles the client to */
  entitledVersion: string | null
  /** A newer version than the current one exists (covered or not) */
  hasUpdate: boolean
  /** A newer version than the current one is covered by the contract */
  hasEntitledUpdate: boolean
  /** Versions newer than the entitled one — visible but locked */
  lockedVersions: string[]
  maintenanceStatus: MaintenanceStatus
}

/**
 * Resolve which update the client is entitled to.
 * `releases` may be unsorted; order is resolved by semver.
 */
export function resolveUpdateEntitlement(params: {
  releases: ReleaseLike[]
  contract: MaintenanceContractLike | null | undefined
  currentVersion: string
  nowMs: number
}): UpdateEntitlement {
  const { releases, contract, currentVersion, nowMs } = params

  const sorted = [...releases].sort((r1, r2) =>
    compareVersions(r1.version, r2.version),
  )

  const latest = sorted.length > 0 ? sorted[sorted.length - 1]! : null

  const covered = sorted.filter((r) => isReleaseCovered(r.releasedAt, contract))
  const entitled = covered.length > 0 ? covered[covered.length - 1]! : null

  const entitledVersion = entitled?.version ?? null
  const lockedVersions = sorted
    .filter((r) =>
      entitledVersion === null
        ? true
        : compareVersions(r.version, entitledVersion) > 0,
    )
    .map((r) => r.version)

  return {
    latestVersion: latest?.version ?? null,
    entitledVersion,
    hasUpdate:
      latest !== null && compareVersions(latest.version, currentVersion) > 0,
    hasEntitledUpdate:
      entitled !== null &&
      compareVersions(entitled.version, currentVersion) > 0,
    lockedVersions,
    maintenanceStatus: computeMaintenanceStatus(contract, nowMs),
  }
}

/**
 * Parse the `time` map of an npm packument into releases.
 * Skips the "created"/"modified" meta keys and invalid dates.
 */
export function parseNpmTimeMap(
  timeMap: Record<string, string> | null | undefined,
): ReleaseLike[] {
  if (!timeMap) return []
  const releases: ReleaseLike[] = []
  for (const [version, iso] of Object.entries(timeMap)) {
    if (version === "created" || version === "modified") continue
    const releasedAt = Date.parse(iso)
    if (Number.isNaN(releasedAt)) continue
    releases.push({ version, releasedAt })
  }
  return releases
}

/** Whether a migration request can move from one status to another */
export function canTransitionMigrationStatus(
  from: MigrationRequestStatus,
  to: MigrationRequestStatus,
): boolean {
  return MIGRATION_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// Stripe renewal helpers (pure — structural types, no Stripe dependency)
// ============================================================================

/** Marker stored in Stripe metadata to route webhook events */
export const MAINTENANCE_BID_PRODUCT = "maintenance"

export interface StripeSubscriptionLike {
  metadata?: Record<string, string> | null
  cancel_at_period_end?: boolean | null
  status?: string | null
  items?: {
    data?: Array<{
      price?: { id?: string | null } | null
      current_period_end?: number | null
    } | null> | null
  } | null
  /** Legacy API shape (pre-Basil): period end on the subscription itself */
  current_period_end?: number | null
}

/**
 * Detect whether a Stripe subscription is the maintenance contract
 * (vs an autoBlog plan). Primary signal: `metadata.bidProduct`;
 * fallback: the configured maintenance price id.
 */
export function isMaintenanceSubscription(
  subscription: StripeSubscriptionLike | null | undefined,
  env: { STRIPE_BID_PRICE_MAINTENANCE?: string },
): boolean {
  if (!subscription) return false
  if (subscription.metadata?.bidProduct === MAINTENANCE_BID_PRODUCT) return true
  const priceId = subscription.items?.data?.[0]?.price?.id
  return Boolean(
    priceId &&
      env.STRIPE_BID_PRICE_MAINTENANCE &&
      priceId === env.STRIPE_BID_PRICE_MAINTENANCE,
  )
}

/**
 * Period end of a Stripe subscription in ms.
 * Stripe returns seconds; the Basil API (stripe-node v18+) moved
 * `current_period_end` from the subscription onto its items.
 */
export function extractPeriodEndMs(
  subscription: StripeSubscriptionLike | null | undefined,
): number | null {
  if (!subscription) return null
  const end =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end
  if (typeof end !== "number" || !Number.isFinite(end) || end <= 0) return null
  return end * 1000
}

export interface RenewalPatch {
  autoRenew: boolean
  coveredUntil?: number
  lastRenewedAt?: number
}

/**
 * Decide how a Stripe subscription event patches the contract.
 * Coverage only ever extends — a shorter or missing period end never
 * shrinks what the client already paid for.
 */
export function buildRenewalPatch(params: {
  existingCoveredUntil: number | null
  periodEndMs: number | null
  autoRenew: boolean
  nowMs: number
}): RenewalPatch {
  const { existingCoveredUntil, periodEndMs, autoRenew, nowMs } = params
  const patch: RenewalPatch = { autoRenew }
  if (
    periodEndMs !== null &&
    (existingCoveredUntil === null || periodEndMs > existingCoveredUntil)
  ) {
    patch.coveredUntil = periodEndMs
    if (existingCoveredUntil !== null) patch.lastRenewedAt = nowMs
  }
  return patch
}

export function isOpenMigrationStatus(status: string): boolean {
  return (OPEN_MIGRATION_STATUSES as readonly string[]).includes(status)
}

// ============================================================================
// Queries
// ============================================================================

/** Get the (singleton) maintenance contract of this deployment */
export const getContract = {
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("maintenanceContracts").first()
  },
}

/** List known platform releases, newest first */
export const listReleases = {
  args: { limit: v.optional(v.number()) },
  handler: async (ctx: any, args: any) => {
    const limit = Math.min(args.limit ?? 50, 200)
    return await ctx.db
      .query("platformReleases")
      .withIndex("by_releasedAt")
      .order("desc")
      .take(limit)
  },
}

/** Get the currently open migration request, if any */
export const getOpenMigrationRequest = {
  args: {},
  handler: async (ctx: any) => {
    for (const status of OPEN_MIGRATION_STATUSES) {
      const request = await ctx.db
        .query("migrationRequests")
        .withIndex("by_status", (q: any) => q.eq("status", status))
        .first()
      if (request) return request
    }
    return null
  },
}

/** List all migration requests, newest first */
export const listMigrationRequests = {
  args: { limit: v.optional(v.number()) },
  handler: async (ctx: any, args: any) => {
    const limit = Math.min(args.limit ?? 20, 100)
    return await ctx.db
      .query("migrationRequests")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit)
  },
}

// ============================================================================
// Mutations
// ============================================================================

/** Upsert the singleton maintenance contract (BeInDigital side) */
export const upsertContract = {
  args: {
    startedAt: v.number(),
    coveredUntil: v.number(),
    autoRenew: v.boolean(),
    lastRenewedAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    notes: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    if (args.coveredUntil < args.startedAt) {
      throw new Error("coveredUntil doit etre posterieur a startedAt")
    }

    const timestamp = now()
    const existing = await ctx.db.query("maintenanceContracts").first()

    const patch: Record<string, unknown> = {
      startedAt: args.startedAt,
      coveredUntil: args.coveredUntil,
      autoRenew: args.autoRenew,
      updatedAt: timestamp,
    }
    if (args.lastRenewedAt !== undefined) patch.lastRenewedAt = args.lastRenewedAt
    if (args.stripeCustomerId !== undefined) patch.stripeCustomerId = args.stripeCustomerId
    if (args.stripeSubscriptionId !== undefined) patch.stripeSubscriptionId = args.stripeSubscriptionId
    if (args.notes !== undefined) patch.notes = args.notes
    if (args.updatedBy !== undefined) patch.updatedBy = args.updatedBy

    if (existing) {
      await ctx.db.patch(existing._id, patch)
      return existing._id
    }

    return await ctx.db.insert("maintenanceContracts", {
      ...patch,
      createdAt: timestamp,
    })
  },
}

/**
 * Upsert releases into the catalog (idempotent by version).
 * Existing versions are left untouched — npm publish dates never change.
 */
export const upsertReleases = {
  args: {
    releases: v.array(
      v.object({
        version: v.string(),
        releasedAt: v.number(),
        notes: v.optional(v.string()),
      }),
    ),
    source: v.union(v.literal("npm"), v.literal("manual")),
  },
  handler: async (ctx: any, args: any) => {
    const timestamp = now()
    let inserted = 0

    for (const release of args.releases) {
      const existing = await ctx.db
        .query("platformReleases")
        .withIndex("by_version", (q: any) => q.eq("version", release.version))
        .first()
      if (existing) continue

      const doc: Record<string, unknown> = {
        version: release.version,
        releasedAt: release.releasedAt,
        source: args.source,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      if (release.notes !== undefined) doc.notes = release.notes

      await ctx.db.insert("platformReleases", doc)
      inserted++
    }

    return { inserted }
  },
}

/** Create a migration request — one open request at a time */
export const createMigrationRequest = {
  args: {
    requestedBy: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    targetProvider: v.string(),
    targetTeam: v.optional(v.string()),
    targetTeamEmail: v.optional(v.string()),
    scope: v.array(migrationScopeValidator),
    preferredDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    if (!args.targetProvider.trim()) {
      throw new Error("Le serveur/hebergeur cible est requis")
    }
    if (!args.contactEmail.trim()) {
      throw new Error("L'email de contact est requis")
    }
    if (args.scope.length === 0) {
      throw new Error("Selectionnez au moins un element a migrer")
    }

    const open = await getOpenMigrationRequest.handler(ctx)
    if (open) {
      throw new Error(
        "Une demande de migration est deja en cours. Annulez-la avant d'en creer une nouvelle.",
      )
    }

    const timestamp = now()

    const doc: Record<string, unknown> = {
      requestedBy: args.requestedBy,
      contactEmail: args.contactEmail.trim(),
      targetProvider: args.targetProvider.trim(),
      scope: args.scope,
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          changedAt: timestamp,
          changedBy: args.requestedBy,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    if (args.contactPhone !== undefined) doc.contactPhone = args.contactPhone
    if (args.targetTeam !== undefined) doc.targetTeam = args.targetTeam
    if (args.targetTeamEmail !== undefined) doc.targetTeamEmail = args.targetTeamEmail
    if (args.preferredDate !== undefined) doc.preferredDate = args.preferredDate
    if (args.notes !== undefined) doc.notes = args.notes

    return await ctx.db.insert("migrationRequests", doc)
  },
}

/** Change the status of a migration request (guarded transitions) */
export const updateMigrationRequestStatus = {
  args: {
    requestId: v.id("migrationRequests"),
    status: migrationRequestStatusValidator,
    changedBy: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const request = await ctx.db.get(args.requestId)
    if (!request) throw new Error("Demande de migration introuvable")

    if (!canTransitionMigrationStatus(request.status, args.status)) {
      throw new Error(
        `Transition de statut invalide : ${request.status} → ${args.status}`,
      )
    }

    const timestamp = now()
    const historyEntry: Record<string, unknown> = {
      status: args.status,
      changedAt: timestamp,
      changedBy: args.changedBy,
    }
    if (args.note !== undefined) historyEntry.note = args.note

    await ctx.db.patch(args.requestId, {
      status: args.status,
      statusHistory: [...request.statusHistory, historyEntry],
      updatedAt: timestamp,
    })

    return args.requestId
  },
}
