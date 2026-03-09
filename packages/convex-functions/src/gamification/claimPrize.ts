import { v } from "convex/values"

/**
 * Claim a prize after winning.
 * Updates prizeRedemption and gamePlay with player info.
 * Public mutation (no auth required).
 */
export const claimPrize = {
  args: {
    redemptionId: v.id("prizeRedemptions"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: {
      redemptionId: string
      firstName: string
      lastName: string
      email: string
      phone?: string
    }
  ) => {
    const now = Date.now()

    // 1. Get the redemption
    const redemption = await ctx.db.get(args.redemptionId)
    if (!redemption) {
      throw new Error("Redemption not found")
    }

    if (redemption.status !== "pending") {
      throw new Error("Prize already claimed or expired")
    }

    if (redemption.expiresAt < now) {
      // Mark as expired
      await ctx.db.patch(args.redemptionId, {
        status: "expired",
        updatedAt: now,
      })
      throw new Error("Prize has expired")
    }

    // 2. Update prizeRedemption with player info
    await ctx.db.patch(args.redemptionId, {
      playerFirstName: args.firstName,
      playerLastName: args.lastName,
      playerEmail: args.email,
      status: "claimed",
      updatedAt: now,
    })

    // 3. Update gamePlay with player info
    await ctx.db.patch(redemption.gamePlayId, {
      playerFirstName: args.firstName,
      playerLastName: args.lastName,
      playerEmail: args.email,
      playerPhone: args.phone,
      updatedAt: now,
    })

    // 4. Get prize details for the response
    const prize = await ctx.db.get(redemption.prizeId)

    return {
      success: true,
      redemptionCode: redemption.redemptionCode,
      prizeName: prize?.name ?? "Prize",
      expiresAt: redemption.expiresAt,
      email: args.email,
    }
  },
}
