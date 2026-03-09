import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  checkAutoBlogAccess,
  checkImageGenerationAccess,
  normalizeScheduleDays,
  validateConfigAgainstPlan,
} from "../blogAutoGuards"

// Mock getCurrentPeriodKey to return a stable value
vi.mock("../blogAutoUsage", () => ({
  getCurrentPeriodKey: () => "2026-03",
}))

// ============================================================================
// Helpers — fake Convex ctx
// ============================================================================

type FakeRecord = Record<string, unknown>

function makeFakeCtx(tables: Record<string, FakeRecord[]>) {
  return {
    db: {
      query(table: string) {
        const rows = tables[table] ?? []
        return {
          withIndex(_name: string, predicate: (q: any) => any) {
            const filters: Record<string, unknown> = {}
            const q: any = {
              eq(field: string, value: unknown) {
                filters[field] = value
                return q
              },
            }
            predicate(q)
            const filtered = rows.filter((row) =>
              Object.entries(filters).every(
                ([key, val]) => (row as any)[key] === val
              )
            )
            return {
              first: async () => filtered[0] ?? null,
              unique: async () => filtered[0] ?? null,
            }
          },
        }
      },
    },
  }
}

// ============================================================================
// checkAutoBlogAccess
// ============================================================================

describe("checkAutoBlogAccess", () => {
  it("should deny when no entitlements exist", async () => {
    const ctx = makeFakeCtx({ ownerEntitlements: [], blogAutoUsage: [] })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Aucun abonnement")
    expect(result.remainingQuota).toBe(0)
    expect(result.entitlements).toBeNull()
  })

  it("should deny when autoBlog is disabled", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        { ownerId: "owner_1", autoBlog: { enabled: false } },
      ],
      blogAutoUsage: [],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Aucun abonnement")
  })

  it("should deny when subscription status is canceled", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          subscriptionStatus: "canceled",
          autoBlog: { enabled: true, plan: "pro", monthlyQuota: 8 },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("inactif")
  })

  it("should allow when subscription status is active", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          subscriptionStatus: "active",
          autoBlog: { enabled: true, plan: "pro", monthlyQuota: 8 },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingQuota).toBe(8)
  })

  it("should allow when subscription status is trialing", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          subscriptionStatus: "trialing",
          autoBlog: { enabled: true, plan: "starter", monthlyQuota: 2 },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingQuota).toBe(2)
  })

  it("should allow when no subscription status (manual entitlement)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, plan: "enterprise", monthlyQuota: 30 },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingQuota).toBe(30)
  })

  it("should deny when plan is missing", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, monthlyQuota: 0 },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Aucun plan")
  })

  it("should deny when monthly quota is exhausted", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, plan: "starter", monthlyQuota: 2 },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          generatedCount: 2,
        },
      ],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Quota mensuel")
    expect(result.remainingQuota).toBe(0)
  })

  it("should return correct remaining quota with partial usage", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, plan: "pro", monthlyQuota: 8 },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          generatedCount: 5,
        },
      ],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingQuota).toBe(3)
  })

  it("should deny when usage exceeds quota (data inconsistency)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, plan: "starter", monthlyQuota: 2 },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          generatedCount: 10,
        },
      ],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.remainingQuota).toBe(0)
  })

  it("should allow when usage is from a different period", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, plan: "starter", monthlyQuota: 2 },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-02", // Previous month
          generatedCount: 10,
        },
      ],
    })
    const result = await checkAutoBlogAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingQuota).toBe(2)
  })
})

// ============================================================================
// checkImageGenerationAccess
// ============================================================================

describe("checkImageGenerationAccess", () => {
  it("should deny when no entitlements exist", async () => {
    const ctx = makeFakeCtx({ ownerEntitlements: [], blogAutoUsage: [] })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Aucun abonnement")
    expect(result.remainingImageQuota).toBe(0)
  })

  it("should deny when autoBlog is disabled", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        { ownerId: "owner_1", autoBlog: { enabled: false } },
      ],
      blogAutoUsage: [],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
  })

  it("should deny when subscription is canceled", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          subscriptionStatus: "canceled",
          autoBlog: {
            enabled: true,
            plan: "pro",
            monthlyImageQuota: 20,
          },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("inactif")
  })

  it("should deny when plan is missing", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: { enabled: true, monthlyImageQuota: 5 },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Aucun plan")
  })

  it("should deny when monthlyImageQuota is 0", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: {
            enabled: true,
            plan: "starter",
            monthlyImageQuota: 0,
          },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("non disponible")
  })

  it("should deny when monthlyImageQuota is undefined (migration safe)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: {
            enabled: true,
            plan: "starter",
            // monthlyImageQuota is undefined
          },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("non disponible")
    expect(result.remainingImageQuota).toBe(0)
  })

  it("should allow with full quota (starter plan, 5 images)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: {
            enabled: true,
            plan: "starter",
            monthlyImageQuota: 5,
          },
        },
      ],
      blogAutoUsage: [],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingImageQuota).toBe(5)
  })

  it("should allow with partial usage (pro plan)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: {
            enabled: true,
            plan: "pro",
            monthlyImageQuota: 20,
          },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          imageGeneratedCount: 12,
        },
      ],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingImageQuota).toBe(8)
  })

  it("should deny when image quota is exhausted", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: {
            enabled: true,
            plan: "starter",
            monthlyImageQuota: 5,
          },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          imageGeneratedCount: 5,
        },
      ],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("Quota mensuel d'images")
    expect(result.remainingImageQuota).toBe(0)
  })

  it("should allow with enterprise plan (100 images)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          subscriptionStatus: "active",
          autoBlog: {
            enabled: true,
            plan: "enterprise",
            monthlyImageQuota: 100,
          },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          imageGeneratedCount: 50,
        },
      ],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingImageQuota).toBe(50)
  })

  it("should handle imageGeneratedCount undefined (fallback to 0)", async () => {
    const ctx = makeFakeCtx({
      ownerEntitlements: [
        {
          ownerId: "owner_1",
          autoBlog: {
            enabled: true,
            plan: "pro",
            monthlyImageQuota: 20,
          },
        },
      ],
      blogAutoUsage: [
        {
          ownerId: "owner_1",
          periodKey: "2026-03",
          generatedCount: 3,
          // imageGeneratedCount is undefined (old record)
        },
      ],
    })
    const result = await checkImageGenerationAccess(ctx, "owner_1")

    expect(result.allowed).toBe(true)
    expect(result.remainingImageQuota).toBe(20)
  })
})

// ============================================================================
// normalizeScheduleDays
// ============================================================================

describe("normalizeScheduleDays", () => {
  it("should use preferredWeekdays when available", () => {
    const result = normalizeScheduleDays({
      frequency: "weekly",
      preferredWeekdays: [1, 3, 5],
    })

    expect(result.weekdays).toEqual([1, 3, 5])
    expect(result.monthDays).toEqual([])
  })

  it("should fallback to single preferredWeekday", () => {
    const result = normalizeScheduleDays({
      frequency: "weekly",
      preferredWeekday: 2,
    })

    expect(result.weekdays).toEqual([2])
  })

  it("should use preferredMonthDays when available", () => {
    const result = normalizeScheduleDays({
      frequency: "monthly",
      preferredMonthDays: [1, 15],
    })

    expect(result.monthDays).toEqual([1, 15])
    expect(result.weekdays).toEqual([])
  })

  it("should fallback to single preferredMonthDay", () => {
    const result = normalizeScheduleDays({
      frequency: "monthly",
      preferredMonthDay: 10,
    })

    expect(result.monthDays).toEqual([10])
  })

  it("should return empty arrays when no days specified", () => {
    const result = normalizeScheduleDays({ frequency: "weekly" })

    expect(result.weekdays).toEqual([])
    expect(result.monthDays).toEqual([])
  })
})

// ============================================================================
// validateConfigAgainstPlan
// ============================================================================

describe("validateConfigAgainstPlan", () => {
  const starterEntitlements = {
    autoBlog: {
      enabled: true,
      plan: "starter",
      maxTopics: 3,
      monthlyQuota: 2,
      allowAutoPublish: false,
      allowMultiLanguage: false,
    },
  }

  const proEntitlements = {
    autoBlog: {
      enabled: true,
      plan: "pro",
      monthlyQuota: 8,
      allowAutoPublish: true,
      allowMultiLanguage: false,
    },
  }

  const enterpriseEntitlements = {
    autoBlog: {
      enabled: true,
      plan: "enterprise",
      monthlyQuota: 30,
      allowAutoPublish: true,
      allowMultiLanguage: true,
    },
  }

  it("should throw when autoBlog is not enabled", () => {
    expect(() =>
      validateConfigAgainstPlan({ autoBlog: { enabled: false } }, {})
    ).toThrow("Aucun abonnement")
  })

  it("should throw when entitlements are null", () => {
    expect(() => validateConfigAgainstPlan(null, {})).toThrow(
      "Aucun abonnement"
    )
  })

  it("should throw when themes exceed maxTopics (starter)", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        themes: ["a", "b", "c", "d"],
      })
    ).toThrow("limite a 3")
  })

  it("should allow themes within maxTopics", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        themes: ["a", "b", "c"],
      })
    ).not.toThrow()
  })

  it("should allow unlimited themes for pro (maxTopics undefined)", () => {
    expect(() =>
      validateConfigAgainstPlan(proEntitlements, {
        themes: Array.from({ length: 20 }, (_, i) => `theme_${i}`),
      })
    ).not.toThrow()
  })

  it("should throw when auto_publish on starter plan", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        approvalMode: "auto_publish",
      })
    ).toThrow("publication automatique")
  })

  it("should allow auto_publish on pro plan", () => {
    expect(() =>
      validateConfigAgainstPlan(proEntitlements, {
        approvalMode: "auto_publish",
      })
    ).not.toThrow()
  })

  it("should throw when autoTranslate on starter plan", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, { autoTranslate: true })
    ).toThrow("traduction automatique")
  })

  it("should throw when autoTranslate on pro plan", () => {
    expect(() =>
      validateConfigAgainstPlan(proEntitlements, { autoTranslate: true })
    ).toThrow("traduction automatique")
  })

  it("should allow autoTranslate on enterprise plan", () => {
    expect(() =>
      validateConfigAgainstPlan(enterpriseEntitlements, {
        autoTranslate: true,
      })
    ).not.toThrow()
  })

  // Schedule validation — weekly
  it("should throw when weekly days are empty", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [],
      })
    ).toThrow("au moins un jour")
  })

  it("should throw when weekly day is out of bounds", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [7],
      })
    ).toThrow("invalides")
  })

  it("should throw when weekly day is negative", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [-1],
      })
    ).toThrow("invalides")
  })

  it("should throw when weekly day is not integer", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [1.5],
      })
    ).toThrow("invalides")
  })

  it("should throw when weekly days are not unique", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [1, 1],
      })
    ).toThrow("uniques")
  })

  it("should throw when weekly days exceed quota", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [0, 1, 2],
      })
    ).toThrow("maximum 2")
  })

  it("should throw when weekly mode has monthDays", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [1],
        preferredMonthDays: [10],
      })
    ).toThrow("jours du mois ne doivent pas")
  })

  it("should allow valid weekly config", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "weekly",
        preferredWeekdays: [1, 4],
      })
    ).not.toThrow()
  })

  // Schedule validation — monthly
  it("should throw when monthly days are empty", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "monthly",
        preferredMonthDays: [],
      })
    ).toThrow("au moins un jour")
  })

  it("should throw when monthly day is out of bounds (0)", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "monthly",
        preferredMonthDays: [0],
      })
    ).toThrow("invalides")
  })

  it("should throw when monthly day is out of bounds (29)", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "monthly",
        preferredMonthDays: [29],
      })
    ).toThrow("invalides")
  })

  it("should throw when monthly days are not unique", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "monthly",
        preferredMonthDays: [5, 5],
      })
    ).toThrow("uniques")
  })

  it("should throw when monthly mode has weekdays", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "monthly",
        preferredMonthDays: [1],
        preferredWeekdays: [1],
      })
    ).toThrow("jours de la semaine ne doivent pas")
  })

  it("should allow valid monthly config", () => {
    expect(() =>
      validateConfigAgainstPlan(starterEntitlements, {
        frequency: "monthly",
        preferredMonthDays: [1, 15],
      })
    ).not.toThrow()
  })
})
