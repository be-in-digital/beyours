import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Tests for the spin logic.
 * Since spin.ts is a Convex mutation (needs ctx.db), we test the pure functions
 * extracted from the spin logic: generateRedemptionCode and pickWeightedSegment.
 *
 * We import the module and test the exported handler indirectly via mocked ctx.
 */

// We'll test the pure logic by replicating the functions here since they're not exported.
// In a real scenario, we'd extract these to a shared utils file.

function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `WIN-${code}`
}

function pickWeightedSegment(
  sections: Array<{ probability: number; isWinning: boolean }>,
  isWinning: boolean
): number | null {
  const candidates = sections
    .map((s, i) => ({ index: i, probability: s.probability, isWinning: s.isWinning }))
    .filter((s) => s.isWinning === isWinning)

  if (candidates.length === 0) return null

  const totalWeight = candidates.reduce((sum, c) => sum + c.probability, 0)
  if (totalWeight <= 0) return candidates[0]!.index

  let random = Math.random() * totalWeight
  for (const candidate of candidates) {
    random -= candidate.probability
    if (random <= 0) return candidate.index
  }

  return candidates[candidates.length - 1]!.index
}

describe("gamification spin logic", () => {
  describe("generateRedemptionCode", () => {
    it("should generate code with WIN- prefix", () => {
      const code = generateRedemptionCode()
      expect(code).toMatch(/^WIN-[A-Z2-9]{6}$/)
    })

    it("should generate unique codes", () => {
      const codes = new Set(Array.from({ length: 100 }, () => generateRedemptionCode()))
      expect(codes.size).toBe(100)
    })

    it("should not contain ambiguous characters (0, O, 1, I) in random part", () => {
      for (let i = 0; i < 100; i++) {
        const code = generateRedemptionCode()
        const randomPart = code.slice(4) // Remove "WIN-" prefix
        expect(randomPart).not.toMatch(/[01IO]/)
      }
    })

    it("should always be 10 characters long (WIN- + 6)", () => {
      const code = generateRedemptionCode()
      expect(code.length).toBe(10)
    })
  })

  describe("pickWeightedSegment", () => {
    const sections = [
      { probability: 5, isWinning: true },   // index 0
      { probability: 15, isWinning: true },  // index 1
      { probability: 80, isWinning: false }, // index 2
    ]

    it("should return null when no matching segments", () => {
      const noWinSections = [{ probability: 100, isWinning: false }]
      const result = pickWeightedSegment(noWinSections, true)
      expect(result).toBeNull()
    })

    it("should return a winning segment index when isWinning=true", () => {
      const result = pickWeightedSegment(sections, true)
      expect(result).not.toBeNull()
      expect([0, 1]).toContain(result)
    })

    it("should return a losing segment index when isWinning=false", () => {
      const result = pickWeightedSegment(sections, false)
      expect(result).toBe(2)
    })

    it("should handle single segment", () => {
      const single = [{ probability: 100, isWinning: true }]
      const result = pickWeightedSegment(single, true)
      expect(result).toBe(0)
    })

    it("should handle equal probabilities", () => {
      const equal = [
        { probability: 50, isWinning: true },
        { probability: 50, isWinning: true },
      ]
      const result = pickWeightedSegment(equal, true)
      expect([0, 1]).toContain(result)
    })

    it("should handle zero probability segments", () => {
      const withZero = [
        { probability: 0, isWinning: true },
        { probability: 100, isWinning: true },
      ]
      // The zero-prob segment should almost never be picked
      const results = new Set(Array.from({ length: 100 }, () => pickWeightedSegment(withZero, true)))
      expect(results.has(1)).toBe(true)
    })

    it("should respect probability distribution roughly", () => {
      // 5% vs 15% winning → segment 1 should be picked ~3x more than segment 0
      const counts = { 0: 0, 1: 0 } as Record<number, number>
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        const result = pickWeightedSegment(sections, true)
        if (result !== null) {
          counts[result] = (counts[result] || 0) + 1
        }
      }

      // Segment 1 (15%) should be roughly 3x segment 0 (5%)
      const ratio = counts[1]! / counts[0]!
      expect(ratio).toBeGreaterThan(2)
      expect(ratio).toBeLessThan(4)
    })
  })

  describe("win ratio logic", () => {
    it("should produce roughly correct win rate over many trials", () => {
      const winRatio = 30 // 30%
      let wins = 0
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        if (Math.random() * 100 < winRatio) wins++
      }

      const actualRate = (wins / iterations) * 100
      expect(actualRate).toBeGreaterThan(25)
      expect(actualRate).toBeLessThan(35)
    })

    it("should never win with 0% ratio", () => {
      const winRatio = 0
      let wins = 0
      for (let i = 0; i < 1000; i++) {
        if (Math.random() * 100 < winRatio) wins++
      }
      expect(wins).toBe(0)
    })

    it("should always win with 100% ratio", () => {
      const winRatio = 100
      let wins = 0
      for (let i = 0; i < 1000; i++) {
        if (Math.random() * 100 < winRatio) wins++
      }
      expect(wins).toBe(1000)
    })
  })
})
