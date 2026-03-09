import { v } from "convex/values"

/**
 * Generate a unique redemption code.
 * Format: WIN-XXXXXX (6 alphanumeric chars)
 */
function generateRedemptionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed ambiguous chars (0,O,1,I)
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `WIN-${code}`
}

/**
 * Pick a segment index based on weighted probabilities.
 * Only considers segments matching the isWinning filter.
 */
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

/**
 * Spin the wheel. Determines win/lose, creates gamePlay and prizeRedemption atomically.
 * Public mutation (no auth required) — the game page is accessible to anyone.
 */
export const spin = {
  args: {
    gameId: v.id("games"),
    storeId: v.id("stores"),
    fingerprint: v.string(),
    completedActions: v.array(v.string()),
  },
  handler: async (
    ctx: any,
    args: {
      gameId: string
      storeId: string
      fingerprint: string
      completedActions: string[]
    }
  ) => {
    const now = Date.now()

    // 1. Load game config
    const game = await ctx.db.get(args.gameId)
    if (!game || !game.isActive) {
      throw new Error("Game not found or inactive")
    }

    // 2. Re-check cooldown server-side (global by fingerprint)
    const cooldownHours = game.config?.cooldownHours ?? 24
    const cooldownMs = cooldownHours * 60 * 60 * 1000
    const cutoff = now - cooldownMs

    const recentPlay = await ctx.db
      .query("gamePlays")
      .withIndex("by_fingerprint", (q: any) =>
        q.eq("fingerprint", args.fingerprint)
      )
      .order("desc")
      .first()

    if (recentPlay && recentPlay.playedAt > cutoff) {
      throw new Error("Cooldown active. Please try again later.")
    }

    // 3. Get wheel sections
    const sections = game.config?.wheelSections ?? []
    if (sections.length === 0) {
      throw new Error("No wheel sections configured")
    }

    // 4. Determine win/lose based on global winRatio
    const isWin = Math.random() * 100 < game.winRatio

    let segmentIndex: number
    let prizeId: string | undefined
    let didWin = false

    if (isWin) {
      // Try to find a winning segment with available stock
      const winIndex = pickWeightedSegment(sections, true)

      if (winIndex !== null) {
        const winSection = sections[winIndex]

        if (winSection.prizeId) {
          // Check prize stock atomically
          const prize = await ctx.db.get(winSection.prizeId)

          if (
            prize &&
            prize.isActive &&
            (prize.remainingCount === undefined || prize.remainingCount === null || prize.remainingCount > 0)
          ) {
            segmentIndex = winIndex
            prizeId = winSection.prizeId
            didWin = true

            // Decrement stock if tracked
            if (prize.remainingCount !== undefined && prize.remainingCount !== null) {
              await ctx.db.patch(prize._id, {
                remainingCount: prize.remainingCount - 1,
                updatedAt: now,
              })
            }
          } else {
            // Prize out of stock — fallback to LOSE
            const loseIndex = pickWeightedSegment(sections, false)
            segmentIndex = loseIndex ?? 0
          }
        } else {
          // Winning segment without a prize (shouldn't happen, fallback to LOSE)
          const loseIndex = pickWeightedSegment(sections, false)
          segmentIndex = loseIndex ?? 0
        }
      } else {
        // No winning segments configured — fallback to LOSE
        const loseIndex = pickWeightedSegment(sections, false)
        segmentIndex = loseIndex ?? 0
      }
    } else {
      // LOSE — pick a losing segment
      const loseIndex = pickWeightedSegment(sections, false)
      segmentIndex = loseIndex ?? 0
    }

    // 5. Create gamePlay record
    const gamePlayId = await ctx.db.insert("gamePlays", {
      storeId: args.storeId,
      gameId: args.gameId,
      fingerprint: args.fingerprint,
      completedActions: args.completedActions,
      didWin,
      prizeId: prizeId ?? undefined,
      playedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    // 6. If win, create pending prizeRedemption
    let redemptionId: string | undefined
    if (didWin && prizeId) {
      const prize = await ctx.db.get(prizeId)
      const validityMs = (prize?.validityDays ?? 1) * 24 * 60 * 60 * 1000

      redemptionId = await ctx.db.insert("prizeRedemptions", {
        storeId: args.storeId,
        gamePlayId,
        prizeId,
        redemptionCode: generateRedemptionCode(),
        status: "pending",
        expiresAt: now + validityMs,
        createdAt: now,
        updatedAt: now,
      })
    }

    return {
      didWin,
      segmentIndex,
      prizeName: didWin && prizeId ? sections[segmentIndex]?.label : undefined,
      redemptionId: redemptionId ?? undefined,
    }
  },
}
