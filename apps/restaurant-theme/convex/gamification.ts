import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

// === Public Queries (no auth — game page is accessible to anyone) ===

export const getGameByStoreSlug = query({
  args: {
    storeSlug: v.string(),
    gameType: v.optional(v.union(v.literal("wheel"), v.literal("scratch_card"))),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db
      .query("stores")
      .withIndex("by_slug", (q) => q.eq("slug", args.storeSlug))
      .first()

    if (!store) return null

    // Global: query all active games (restaurant-level config)
    const activeGames = await ctx.db
      .query("games")
      .withIndex("by_isActive", (q) =>
        q.eq("isActive", true)
      )
      .collect()

    // If gameType specified, pick that type; otherwise pick the first active game
    const game = args.gameType
      ? activeGames.find((g) => g.type === args.gameType) ?? null
      : activeGames[0] ?? null

    if (!game) return null

    // Global: query all active required actions
    const actions = await ctx.db
      .query("requiredActions")
      .withIndex("by_isActive", (q) =>
        q.eq("isActive", true)
      )
      .collect()

    const sortedActions = actions
      .filter((a) => a.isRequired)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    // Global: query all active prizes
    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_isActive", (q) =>
        q.eq("isActive", true)
      )
      .collect()

    const prizeMap = new Map(prizes.map((p) => [p._id, p]))

    const sections = (game.config?.wheelSections ?? []).map((section: { label: string; color: string; probability: number; prizeId?: Id<"prizes">; isWinning: boolean }) => ({
      ...section,
      prizeName: section.prizeId ? prizeMap.get(section.prizeId)?.name : undefined,
    }))

    return {
      store: { _id: store._id, name: store.name, slug: store.slug },
      game: { _id: game._id, name: game.name, type: game.type, winRatio: game.winRatio },
      sections,
      actions: sortedActions.map((a) => ({
        _id: a._id,
        name: a.name,
        type: a.type,
        description: a.description,
        url: a.url,
        icon: a.icon,
        timerSeconds: a.timerSeconds,
      })),
      settings: {
        primaryColor: game.config?.primaryColor ?? "#000000",
        secondaryColor: game.config?.secondaryColor ?? "#ffffff",
        backgroundImage: game.config?.backgroundImage,
        cooldownHours: game.config?.cooldownHours ?? 24,
      },
    }
  },
})

export const checkCooldown = query({
  args: {
    storeId: v.optional(v.id("stores")), // Legacy, kept for backward compat
    fingerprint: v.string(),
    cooldownHours: v.number(),
  },
  handler: async (ctx, args) => {
    const cooldownMs = args.cooldownHours * 60 * 60 * 1000
    const cutoff = Date.now() - cooldownMs

    // Global cooldown by fingerprint (across all stores)
    const recentByFingerprint = await ctx.db
      .query("gamePlays")
      .withIndex("by_fingerprint", (q) =>
        q.eq("fingerprint", args.fingerprint)
      )
      .order("desc")
      .first()

    if (recentByFingerprint && recentByFingerprint.playedAt > cutoff) {
      return { canPlay: false, nextPlayAt: recentByFingerprint.playedAt + cooldownMs }
    }

    return { canPlay: true }
  },
})

// === Public Mutations (no auth — players are unauthenticated) ===

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

export const spin = mutation({
  args: {
    gameId: v.id("games"),
    storeId: v.id("stores"),
    fingerprint: v.string(),
    completedActions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const game = await ctx.db.get(args.gameId)
    if (!game || !game.isActive) {
      throw new Error("Game not found or inactive")
    }

    const cooldownHours = game.config?.cooldownHours ?? 24
    const cooldownMs = cooldownHours * 60 * 60 * 1000
    const cutoff = now - cooldownMs

    // Global cooldown by fingerprint
    const recentPlay = await ctx.db
      .query("gamePlays")
      .withIndex("by_fingerprint", (q) =>
        q.eq("fingerprint", args.fingerprint)
      )
      .order("desc")
      .first()

    if (recentPlay && recentPlay.playedAt > cutoff) {
      throw new Error("Cooldown active. Please try again later.")
    }

    const isWin = Math.random() * 100 < game.winRatio

    let segmentIndex: number = 0
    let prizeId: Id<"prizes"> | undefined
    let didWin = false
    let prizeName: string | undefined

    if (game.type === "scratch_card") {
      // Scratch card: pick a random active prize globally
      if (isWin) {
        const prizes = await ctx.db
          .query("prizes")
          .withIndex("by_isActive", (q) =>
            q.eq("isActive", true)
          )
          .collect()

        // Find a prize with remaining stock
        const availablePrizes = prizes.filter(
          (p) => p.remainingCount === undefined || p.remainingCount === null || p.remainingCount > 0
        )

        if (availablePrizes.length > 0) {
          const picked = availablePrizes[Math.floor(Math.random() * availablePrizes.length)]!
          prizeId = picked._id
          prizeName = picked.name
          didWin = true

          if (picked.remainingCount !== undefined && picked.remainingCount !== null) {
            await ctx.db.patch(picked._id, {
              remainingCount: picked.remainingCount - 1,
              updatedAt: now,
            })
          }
        }
      }
    } else {
      // Wheel: use weighted segments
      const sections = game.config?.wheelSections ?? []
      if (sections.length === 0) {
        throw new Error("No wheel sections configured")
      }

      if (isWin) {
        const winIndex = pickWeightedSegment(sections, true)

        if (winIndex !== null) {
          const winSection = sections[winIndex]

          if (winSection?.prizeId) {
            const prize = await ctx.db.get(winSection.prizeId)

            if (
              prize &&
              prize.isActive &&
              (prize.remainingCount === undefined || prize.remainingCount === null || prize.remainingCount > 0)
            ) {
              segmentIndex = winIndex
              prizeId = winSection.prizeId
              didWin = true
              prizeName = sections[winIndex]?.label

              if (prize.remainingCount !== undefined && prize.remainingCount !== null) {
                await ctx.db.patch(prize._id, {
                  remainingCount: prize.remainingCount - 1,
                  updatedAt: now,
                })
              }
            } else {
              const loseIndex = pickWeightedSegment(sections, false)
              segmentIndex = loseIndex ?? 0
            }
          } else {
            const loseIndex = pickWeightedSegment(sections, false)
            segmentIndex = loseIndex ?? 0
          }
        } else {
          const loseIndex = pickWeightedSegment(sections, false)
          segmentIndex = loseIndex ?? 0
        }
      } else {
        const loseIndex = pickWeightedSegment(sections, false)
        segmentIndex = loseIndex ?? 0
      }
    }

    const gamePlayId = await ctx.db.insert("gamePlays", {
      storeId: args.storeId,
      gameId: args.gameId,
      fingerprint: args.fingerprint,
      completedActions: args.completedActions,
      didWin,
      prizeId,
      playedAt: now,
      createdAt: now,
      updatedAt: now,
    })

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
      prizeName: prizeName ?? undefined,
      redemptionId: redemptionId ?? undefined,
    }
  },
})

export const claimPrize = mutation({
  args: {
    redemptionId: v.id("prizeRedemptions"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const redemption = await ctx.db.get(args.redemptionId)
    if (!redemption) throw new Error("Redemption not found")
    if (redemption.status !== "pending") throw new Error("Prize already claimed or expired")

    if (redemption.expiresAt < now) {
      await ctx.db.patch(args.redemptionId, { status: "expired", updatedAt: now })
      throw new Error("Prize has expired")
    }

    await ctx.db.patch(args.redemptionId, {
      playerFirstName: args.firstName,
      playerLastName: args.lastName,
      playerEmail: args.email,
      status: "claimed",
      updatedAt: now,
    })

    await ctx.db.patch(redemption.gamePlayId, {
      playerFirstName: args.firstName,
      playerLastName: args.lastName,
      playerEmail: args.email,
      playerPhone: args.phone,
      updatedAt: now,
    })

    const prize = await ctx.db.get(redemption.prizeId)

    return {
      success: true,
      redemptionCode: redemption.redemptionCode,
      prizeName: prize?.name ?? "Prize",
      expiresAt: redemption.expiresAt,
      email: args.email,
    }
  },
})
