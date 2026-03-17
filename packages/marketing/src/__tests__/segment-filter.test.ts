import { describe, it, expect } from "vitest"
import {
  evaluateRule,
  buildSegmentFilter,
  getNestedValue,
  type SegmentRule,
} from "../segment-filter"

describe("getNestedValue", () => {
  it("devrait accéder à une valeur de premier niveau", () => {
    expect(getNestedValue({ name: "Alice" }, "name")).toBe("Alice")
  })

  it("devrait accéder à une valeur imbriquée via dot-notation", () => {
    const obj = { metadata: { totalOrders: 5 } }
    expect(getNestedValue(obj, "metadata.totalOrders")).toBe(5)
  })

  it("devrait retourner undefined pour un chemin inexistant", () => {
    expect(getNestedValue({ a: 1 }, "b")).toBeUndefined()
    expect(getNestedValue({ a: { b: 1 } }, "a.c")).toBeUndefined()
  })
})

describe("evaluateRule", () => {
  const subscriber = {
    email: "alice@example.com",
    status: "active",
    tags: ["vip", "premium"],
    metadata: {
      totalOrders: 10,
      totalSpent: 50000,
      lastOrderAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 jours
    },
  }

  function rule(overrides: Partial<SegmentRule>): SegmentRule {
    return { id: "r1", field: "status", operator: "equals", value: "active", ...overrides }
  }

  describe("equals / not_equals", () => {
    it("equals devrait correspondre à une valeur identique", () => {
      expect(evaluateRule(subscriber, rule({ field: "status", operator: "equals", value: "active" }))).toBe(true)
    })

    it("equals devrait échouer pour une valeur différente", () => {
      expect(evaluateRule(subscriber, rule({ field: "status", operator: "equals", value: "pending" }))).toBe(false)
    })

    it("not_equals devrait correspondre à une valeur différente", () => {
      expect(evaluateRule(subscriber, rule({ field: "status", operator: "not_equals", value: "pending" }))).toBe(true)
    })
  })

  describe("gt / lt / gte / lte", () => {
    it("gt devrait comparer numériquement", () => {
      expect(evaluateRule(subscriber, rule({ field: "metadata.totalOrders", operator: "gt", value: "5" }))).toBe(true)
      expect(evaluateRule(subscriber, rule({ field: "metadata.totalOrders", operator: "gt", value: "10" }))).toBe(false)
    })

    it("lte devrait inclure l'égalité", () => {
      expect(evaluateRule(subscriber, rule({ field: "metadata.totalOrders", operator: "lte", value: "10" }))).toBe(true)
    })
  })

  describe("contains / not_contains", () => {
    it("contains devrait vérifier les tableaux", () => {
      expect(evaluateRule(subscriber, rule({ field: "tags", operator: "contains", value: "vip" }))).toBe(true)
      expect(evaluateRule(subscriber, rule({ field: "tags", operator: "contains", value: "gold" }))).toBe(false)
    })

    it("contains devrait vérifier les chaînes (insensible à la casse)", () => {
      expect(evaluateRule(subscriber, rule({ field: "email", operator: "contains", value: "alice" }))).toBe(true)
      expect(evaluateRule(subscriber, rule({ field: "email", operator: "contains", value: "ALICE" }))).toBe(true)
    })

    it("not_contains devrait fonctionner inversement", () => {
      expect(evaluateRule(subscriber, rule({ field: "tags", operator: "not_contains", value: "gold" }))).toBe(true)
      expect(evaluateRule(subscriber, rule({ field: "tags", operator: "not_contains", value: "vip" }))).toBe(false)
    })
  })

  describe("before / after", () => {
    it("before devrait comparer les timestamps", () => {
      const now = Date.now()
      expect(evaluateRule(subscriber, rule({ field: "metadata.lastOrderAt", operator: "before", value: String(now) }))).toBe(true)
    })

    it("after devrait comparer inversement", () => {
      const farPast = Date.now() - 30 * 24 * 60 * 60 * 1000
      expect(evaluateRule(subscriber, rule({ field: "metadata.lastOrderAt", operator: "after", value: String(farPast) }))).toBe(true)
    })
  })

  describe("in_last_days", () => {
    it("devrait retourner true si la valeur est dans les N derniers jours", () => {
      expect(evaluateRule(subscriber, rule({ field: "metadata.lastOrderAt", operator: "in_last_days", value: "7" }))).toBe(true)
    })

    it("devrait retourner false si la valeur est trop ancienne", () => {
      expect(evaluateRule(subscriber, rule({ field: "metadata.lastOrderAt", operator: "in_last_days", value: "2" }))).toBe(false)
    })

    it("devrait retourner false pour une valeur non numérique", () => {
      expect(evaluateRule(subscriber, rule({ field: "metadata.lastOrderAt", operator: "in_last_days", value: "abc" }))).toBe(false)
    })
  })
})

describe("buildSegmentFilter", () => {
  const subscribers = [
    { email: "a@test.com", status: "active", metadata: { totalOrders: 5 } },
    { email: "b@test.com", status: "active", metadata: { totalOrders: 15 } },
    { email: "c@test.com", status: "pending", metadata: { totalOrders: 3 } },
  ]

  it("devrait retourner tous les abonnés si pas de règles", () => {
    const filter = buildSegmentFilter([], "and")
    const result = subscribers.filter(filter)
    expect(result).toHaveLength(3)
  })

  it("devrait filtrer avec AND (toutes les règles)", () => {
    const rules: SegmentRule[] = [
      { id: "r1", field: "status", operator: "equals", value: "active" },
      { id: "r2", field: "metadata.totalOrders", operator: "gt", value: "10" },
    ]
    const filter = buildSegmentFilter(rules, "and")
    const result = subscribers.filter(filter)
    expect(result).toHaveLength(1)
    expect(result[0]?.email).toBe("b@test.com")
  })

  it("devrait filtrer avec OR (au moins une règle)", () => {
    const rules: SegmentRule[] = [
      { id: "r1", field: "status", operator: "equals", value: "pending" },
      { id: "r2", field: "metadata.totalOrders", operator: "gt", value: "10" },
    ]
    const filter = buildSegmentFilter(rules, "or")
    const result = subscribers.filter(filter)
    expect(result).toHaveLength(2) // b (totalOrders > 10) + c (pending)
  })
})
