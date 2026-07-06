import { describe, it, expect } from "vitest"
import {
  computeMaintenanceStatus,
  daysRemaining,
  isReleaseCovered,
  compareVersions,
  resolveUpdateEntitlement,
  parseNpmTimeMap,
  canTransitionMigrationStatus,
  isOpenMigrationStatus,
  createMigrationRequest,
  updateMigrationRequestStatus,
  isMaintenanceSubscription,
  extractPeriodEndMs,
  buildRenewalPatch,
  EXPIRING_SOON_DAYS,
  MAINTENANCE_BID_PRODUCT,
} from "../maintenance"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-07-05T12:00:00Z")

function contract(coveredUntil: number, startedAt = NOW - 365 * DAY) {
  return { startedAt, coveredUntil }
}

// ============================================================================
// computeMaintenanceStatus
// ============================================================================

describe("computeMaintenanceStatus", () => {
  it("returns none without a contract", () => {
    expect(computeMaintenanceStatus(null, NOW)).toBe("none")
    expect(computeMaintenanceStatus(undefined, NOW)).toBe("none")
  })

  it("returns active when coverage ends far in the future", () => {
    expect(computeMaintenanceStatus(contract(NOW + 200 * DAY), NOW)).toBe(
      "active"
    )
  })

  it("returns expiring_soon within the notice window", () => {
    expect(
      computeMaintenanceStatus(contract(NOW + EXPIRING_SOON_DAYS * DAY), NOW)
    ).toBe("expiring_soon")
    expect(computeMaintenanceStatus(contract(NOW + 1 * DAY), NOW)).toBe(
      "expiring_soon"
    )
  })

  it("returns expiring_soon on the exact end date (not yet expired)", () => {
    expect(computeMaintenanceStatus(contract(NOW), NOW)).toBe("expiring_soon")
  })

  it("returns expired after the end date", () => {
    expect(computeMaintenanceStatus(contract(NOW - 1), NOW)).toBe("expired")
    expect(computeMaintenanceStatus(contract(NOW - 90 * DAY), NOW)).toBe(
      "expired"
    )
  })

  it("switches from active to expiring_soon exactly at the boundary", () => {
    const justOutside = contract(NOW + EXPIRING_SOON_DAYS * DAY + 1)
    expect(computeMaintenanceStatus(justOutside, NOW)).toBe("active")
  })
})

// ============================================================================
// daysRemaining
// ============================================================================

describe("daysRemaining", () => {
  it("returns 0 without contract or when expired", () => {
    expect(daysRemaining(null, NOW)).toBe(0)
    expect(daysRemaining(contract(NOW - DAY), NOW)).toBe(0)
  })

  it("returns whole days left", () => {
    expect(daysRemaining(contract(NOW + 10 * DAY), NOW)).toBe(10)
    expect(daysRemaining(contract(NOW + 10 * DAY + DAY / 2), NOW)).toBe(10)
  })
})

// ============================================================================
// isReleaseCovered
// ============================================================================

describe("isReleaseCovered", () => {
  const c = contract(NOW)

  it("returns false without a contract", () => {
    expect(isReleaseCovered(NOW - DAY, null)).toBe(false)
  })

  it("covers releases published before or at coveredUntil", () => {
    expect(isReleaseCovered(NOW - 100 * DAY, c)).toBe(true)
    expect(isReleaseCovered(NOW, c)).toBe(true)
  })

  it("does not cover releases published after coveredUntil", () => {
    expect(isReleaseCovered(NOW + 1, c)).toBe(false)
  })
})

// ============================================================================
// compareVersions
// ============================================================================

describe("compareVersions", () => {
  it("orders patch, minor and major", () => {
    expect(compareVersions("2.0.1", "2.0.0")).toBeGreaterThan(0)
    expect(compareVersions("2.1.0", "2.0.9")).toBeGreaterThan(0)
    expect(compareVersions("3.0.0", "2.9.9")).toBeGreaterThan(0)
    expect(compareVersions("2.0.0", "2.0.1")).toBeLessThan(0)
  })

  it("compares numerically, not lexicographically", () => {
    expect(compareVersions("2.10.0", "2.9.0")).toBeGreaterThan(0)
  })

  it("handles versions of different lengths", () => {
    expect(compareVersions("2.1", "2.1.0")).toBe(0)
    expect(compareVersions("2.1.1", "2.1")).toBeGreaterThan(0)
  })

  it("sorts prereleases before their final release", () => {
    expect(compareVersions("2.1.0-beta.1", "2.1.0")).toBeLessThan(0)
    expect(compareVersions("2.1.0", "2.1.0-rc.2")).toBeGreaterThan(0)
  })

  it("returns 0 for equal versions", () => {
    expect(compareVersions("2.0.3", "2.0.3")).toBe(0)
  })
})

// ============================================================================
// resolveUpdateEntitlement
// ============================================================================

describe("resolveUpdateEntitlement", () => {
  const releases = [
    { version: "2.0.0", releasedAt: NOW - 300 * DAY },
    { version: "2.1.0", releasedAt: NOW - 200 * DAY },
    { version: "2.2.0", releasedAt: NOW - 20 * DAY },
    { version: "3.0.0", releasedAt: NOW - 5 * DAY },
  ]

  it("returns empty result without releases", () => {
    const result = resolveUpdateEntitlement({
      releases: [],
      contract: contract(NOW + 100 * DAY),
      currentVersion: "2.0.0",
      nowMs: NOW,
    })
    expect(result.latestVersion).toBeNull()
    expect(result.entitledVersion).toBeNull()
    expect(result.hasUpdate).toBe(false)
    expect(result.hasEntitledUpdate).toBe(false)
    expect(result.lockedVersions).toEqual([])
  })

  it("entitles everything while the contract is active", () => {
    const result = resolveUpdateEntitlement({
      releases,
      contract: contract(NOW + 100 * DAY),
      currentVersion: "2.1.0",
      nowMs: NOW,
    })
    expect(result.latestVersion).toBe("3.0.0")
    expect(result.entitledVersion).toBe("3.0.0")
    expect(result.hasUpdate).toBe(true)
    expect(result.hasEntitledUpdate).toBe(true)
    expect(result.lockedVersions).toEqual([])
    expect(result.maintenanceStatus).toBe("active")
  })

  it("freezes on the last covered release once expired", () => {
    // Coverage ended 100 days ago: 2.2.0 (J-20) and 3.0.0 (J-5) are locked
    const result = resolveUpdateEntitlement({
      releases,
      contract: contract(NOW - 100 * DAY),
      currentVersion: "2.0.0",
      nowMs: NOW,
    })
    expect(result.latestVersion).toBe("3.0.0")
    expect(result.entitledVersion).toBe("2.1.0")
    expect(result.hasUpdate).toBe(true)
    expect(result.hasEntitledUpdate).toBe(true) // 2.0.0 → 2.1.0 still covered
    expect(result.lockedVersions).toEqual(["2.2.0", "3.0.0"])
    expect(result.maintenanceStatus).toBe("expired")
  })

  it("reports no entitled update when already on the last covered release", () => {
    const result = resolveUpdateEntitlement({
      releases,
      contract: contract(NOW - 100 * DAY),
      currentVersion: "2.1.0",
      nowMs: NOW,
    })
    expect(result.hasUpdate).toBe(true)
    expect(result.hasEntitledUpdate).toBe(false)
    expect(result.lockedVersions).toEqual(["2.2.0", "3.0.0"])
  })

  it("locks everything without a contract", () => {
    const result = resolveUpdateEntitlement({
      releases,
      contract: null,
      currentVersion: "2.0.0",
      nowMs: NOW,
    })
    expect(result.entitledVersion).toBeNull()
    expect(result.hasEntitledUpdate).toBe(false)
    expect(result.lockedVersions).toEqual(["2.0.0", "2.1.0", "2.2.0", "3.0.0"])
    expect(result.maintenanceStatus).toBe("none")
  })

  it("resolves order by semver even when input is unsorted", () => {
    const shuffled = [releases[2]!, releases[0]!, releases[3]!, releases[1]!]
    const result = resolveUpdateEntitlement({
      releases: shuffled,
      contract: contract(NOW + 100 * DAY),
      currentVersion: "3.0.0",
      nowMs: NOW,
    })
    expect(result.latestVersion).toBe("3.0.0")
    expect(result.hasUpdate).toBe(false)
    expect(result.hasEntitledUpdate).toBe(false)
  })
})

// ============================================================================
// parseNpmTimeMap
// ============================================================================

describe("parseNpmTimeMap", () => {
  it("parses versions and skips meta keys", () => {
    const releases = parseNpmTimeMap({
      created: "2025-01-01T00:00:00.000Z",
      modified: "2026-06-01T00:00:00.000Z",
      "2.0.0": "2025-06-15T10:00:00.000Z",
      "2.0.1": "2025-07-20T10:00:00.000Z",
    })
    expect(releases).toHaveLength(2)
    expect(releases[0]).toEqual({
      version: "2.0.0",
      releasedAt: Date.parse("2025-06-15T10:00:00.000Z"),
    })
  })

  it("skips invalid dates", () => {
    expect(parseNpmTimeMap({ "1.0.0": "not-a-date" })).toEqual([])
  })

  it("handles null/undefined maps", () => {
    expect(parseNpmTimeMap(null)).toEqual([])
    expect(parseNpmTimeMap(undefined)).toEqual([])
  })
})

// ============================================================================
// Migration request status machine
// ============================================================================

describe("canTransitionMigrationStatus", () => {
  it("allows the nominal fulfilment path", () => {
    expect(canTransitionMigrationStatus("pending", "acknowledged")).toBe(true)
    expect(canTransitionMigrationStatus("acknowledged", "in_progress")).toBe(true)
    expect(canTransitionMigrationStatus("in_progress", "completed")).toBe(true)
  })

  it("allows cancellation while open", () => {
    expect(canTransitionMigrationStatus("pending", "cancelled")).toBe(true)
    expect(canTransitionMigrationStatus("acknowledged", "cancelled")).toBe(true)
    expect(canTransitionMigrationStatus("in_progress", "cancelled")).toBe(true)
  })

  it("rejects transitions out of terminal states", () => {
    expect(canTransitionMigrationStatus("completed", "pending")).toBe(false)
    expect(canTransitionMigrationStatus("cancelled", "in_progress")).toBe(false)
    expect(canTransitionMigrationStatus("declined", "acknowledged")).toBe(false)
  })

  it("rejects skipping backwards", () => {
    expect(canTransitionMigrationStatus("in_progress", "pending")).toBe(false)
    expect(canTransitionMigrationStatus("completed", "in_progress")).toBe(false)
  })
})

describe("isOpenMigrationStatus", () => {
  it("flags open statuses", () => {
    expect(isOpenMigrationStatus("pending")).toBe(true)
    expect(isOpenMigrationStatus("acknowledged")).toBe(true)
    expect(isOpenMigrationStatus("in_progress")).toBe(true)
  })

  it("flags terminal statuses as closed", () => {
    expect(isOpenMigrationStatus("completed")).toBe(false)
    expect(isOpenMigrationStatus("cancelled")).toBe(false)
    expect(isOpenMigrationStatus("declined")).toBe(false)
  })
})

// ============================================================================
// Stripe renewal helpers
// ============================================================================

describe("isMaintenanceSubscription", () => {
  const env = { STRIPE_BID_PRICE_MAINTENANCE: "price_maint" }

  it("detects via metadata.bidProduct", () => {
    expect(
      isMaintenanceSubscription(
        { metadata: { bidProduct: MAINTENANCE_BID_PRODUCT } },
        {}
      )
    ).toBe(true)
  })

  it("detects via configured price id", () => {
    expect(
      isMaintenanceSubscription(
        { items: { data: [{ price: { id: "price_maint" } }] } },
        env
      )
    ).toBe(true)
  })

  it("rejects autoBlog plan subscriptions", () => {
    expect(
      isMaintenanceSubscription(
        {
          metadata: { ownerId: "user_1" },
          items: { data: [{ price: { id: "price_pro_monthly" } }] },
        },
        env
      )
    ).toBe(false)
  })

  it("rejects price match when env is not configured", () => {
    expect(
      isMaintenanceSubscription(
        { items: { data: [{ price: { id: "price_maint" } }] } },
        {}
      )
    ).toBe(false)
  })

  it("handles null subscription", () => {
    expect(isMaintenanceSubscription(null, env)).toBe(false)
  })
})

describe("extractPeriodEndMs", () => {
  it("reads the Basil shape (period end on items)", () => {
    expect(
      extractPeriodEndMs({
        items: { data: [{ current_period_end: 1_800_000_000 }] },
      })
    ).toBe(1_800_000_000_000)
  })

  it("falls back to the legacy shape", () => {
    expect(extractPeriodEndMs({ current_period_end: 1_800_000_000 })).toBe(
      1_800_000_000_000
    )
  })

  it("prefers the item value over the legacy one", () => {
    expect(
      extractPeriodEndMs({
        current_period_end: 1,
        items: { data: [{ current_period_end: 2 }] },
      })
    ).toBe(2000)
  })

  it("returns null when absent or invalid", () => {
    expect(extractPeriodEndMs({})).toBeNull()
    expect(extractPeriodEndMs(null)).toBeNull()
    expect(extractPeriodEndMs({ current_period_end: 0 })).toBeNull()
  })
})

describe("buildRenewalPatch", () => {
  it("creates coverage on first purchase (no contract)", () => {
    const patch = buildRenewalPatch({
      existingCoveredUntil: null,
      periodEndMs: NOW + 365 * DAY,
      autoRenew: true,
      nowMs: NOW,
    })
    expect(patch.coveredUntil).toBe(NOW + 365 * DAY)
    expect(patch.autoRenew).toBe(true)
    expect(patch.lastRenewedAt).toBeUndefined()
  })

  it("extends coverage and stamps lastRenewedAt on renewal", () => {
    const patch = buildRenewalPatch({
      existingCoveredUntil: NOW + 10 * DAY,
      periodEndMs: NOW + 375 * DAY,
      autoRenew: true,
      nowMs: NOW,
    })
    expect(patch.coveredUntil).toBe(NOW + 375 * DAY)
    expect(patch.lastRenewedAt).toBe(NOW)
  })

  it("never shrinks coverage", () => {
    const patch = buildRenewalPatch({
      existingCoveredUntil: NOW + 300 * DAY,
      periodEndMs: NOW + 30 * DAY,
      autoRenew: true,
      nowMs: NOW,
    })
    expect(patch.coveredUntil).toBeUndefined()
    expect(patch.lastRenewedAt).toBeUndefined()
  })

  it("only flips autoRenew on cancellation (no period end)", () => {
    const patch = buildRenewalPatch({
      existingCoveredUntil: NOW + 100 * DAY,
      periodEndMs: null,
      autoRenew: false,
      nowMs: NOW,
    })
    expect(patch).toEqual({ autoRenew: false })
  })
})

// ============================================================================
// Handlers (fake ctx)
// ============================================================================

/** Minimal in-memory ctx.db covering the handlers under test */
function makeFakeCtx() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>()
  let nextId = 1

  function tableOf(name: string) {
    if (!tables.has(name)) tables.set(name, new Map())
    return tables.get(name)!
  }

  const db = {
    insert: async (table: string, doc: Record<string, unknown>) => {
      const id = `${table}:${nextId++}`
      tableOf(table).set(id, { ...doc, _id: id })
      return id
    },
    get: async (id: string) => {
      const table = id.split(":")[0]!
      return tableOf(table).get(id) ?? null
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const table = id.split(":")[0]!
      const doc = tableOf(table).get(id)
      if (!doc) throw new Error(`Doc ${id} not found`)
      tableOf(table).set(id, { ...doc, ...patch })
    },
    query: (table: string) => {
      let docs = [...tableOf(table).values()]
      const chain = {
        withIndex: (_name: string, fn?: (q: unknown) => unknown) => {
          if (fn) {
            const filters: Array<[string, unknown]> = []
            const q = {
              eq: (field: string, value: unknown) => {
                filters.push([field, value])
                return q
              },
            }
            fn(q)
            docs = docs.filter((d) =>
              filters.every(([field, value]) => d[field] === value)
            )
          }
          return chain
        },
        order: () => chain,
        first: async () => docs[0] ?? null,
        take: async (n: number) => docs.slice(0, n),
      }
      return chain
    },
  }

  return { db }
}

describe("createMigrationRequest handler", () => {
  const validArgs = {
    requestedBy: "user_1",
    contactEmail: "owner@resto.fr",
    targetProvider: "OVH VPS",
    scope: ["code", "database"],
  }

  it("creates a pending request with initial history", async () => {
    const ctx = makeFakeCtx()
    const id = await createMigrationRequest.handler(ctx, validArgs)
    const doc = (await ctx.db.get(id)) as Record<string, unknown> & {
      status: string
      statusHistory: Array<{ status: string; changedBy: string }>
    }
    expect(doc.status).toBe("pending")
    expect(doc.statusHistory).toHaveLength(1)
    expect(doc.statusHistory[0]!.changedBy).toBe("user_1")
  })

  it("rejects a second open request", async () => {
    const ctx = makeFakeCtx()
    await createMigrationRequest.handler(ctx, validArgs)
    await expect(
      createMigrationRequest.handler(ctx, validArgs)
    ).rejects.toThrow(/deja en cours/)
  })

  it("allows a new request after the previous one is closed", async () => {
    const ctx = makeFakeCtx()
    const firstId = await createMigrationRequest.handler(ctx, validArgs)
    await updateMigrationRequestStatus.handler(ctx, {
      requestId: firstId,
      status: "cancelled",
      changedBy: "user_1",
    })
    const secondId = await createMigrationRequest.handler(ctx, validArgs)
    expect(secondId).not.toBe(firstId)
  })

  it("rejects an empty scope", async () => {
    const ctx = makeFakeCtx()
    await expect(
      createMigrationRequest.handler(ctx, { ...validArgs, scope: [] })
    ).rejects.toThrow(/au moins un element/)
  })

  it("rejects a blank target provider", async () => {
    const ctx = makeFakeCtx()
    await expect(
      createMigrationRequest.handler(ctx, { ...validArgs, targetProvider: "  " })
    ).rejects.toThrow(/cible est requis/)
  })
})

describe("updateMigrationRequestStatus handler", () => {
  it("appends to status history on valid transition", async () => {
    const ctx = makeFakeCtx()
    const id = await createMigrationRequest.handler(ctx, {
      requestedBy: "user_1",
      contactEmail: "owner@resto.fr",
      targetProvider: "Vercel",
      scope: ["code"],
    })

    await updateMigrationRequestStatus.handler(ctx, {
      requestId: id,
      status: "acknowledged",
      changedBy: "beindigital",
      note: "Pris en compte",
    })

    const doc = (await ctx.db.get(id)) as Record<string, unknown> & {
      status: string
      statusHistory: Array<{ status: string; note?: string }>
    }
    expect(doc.status).toBe("acknowledged")
    expect(doc.statusHistory).toHaveLength(2)
    expect(doc.statusHistory[1]!.note).toBe("Pris en compte")
  })

  it("rejects invalid transitions", async () => {
    const ctx = makeFakeCtx()
    const id = await createMigrationRequest.handler(ctx, {
      requestedBy: "user_1",
      contactEmail: "owner@resto.fr",
      targetProvider: "AWS",
      scope: ["code"],
    })

    await expect(
      updateMigrationRequestStatus.handler(ctx, {
        requestId: id,
        status: "completed",
        changedBy: "beindigital",
      })
    ).rejects.toThrow(/Transition de statut invalide/)
  })

  it("throws for unknown requests", async () => {
    const ctx = makeFakeCtx()
    await expect(
      updateMigrationRequestStatus.handler(ctx, {
        requestId: "migrationRequests:999",
        status: "acknowledged",
        changedBy: "beindigital",
      })
    ).rejects.toThrow(/introuvable/)
  })
})
