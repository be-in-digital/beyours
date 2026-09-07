import { ConvexError, v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("prizes").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: { storeId: v.id("stores"), name: v.string(), description: v.optional(v.string()), type: v.union(v.literal("discount_percentage"), v.literal("discount_fixed"), v.literal("free_product"), v.literal("free_menu"), v.literal("custom")), value: v.optional(v.number()), validityDays: v.number(), totalAvailable: v.optional(v.number()), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("prizes", { ...args, createdAt: now, updatedAt: now })
  },
}

export const update = {
  args: { id: v.id("prizes"), name: v.optional(v.string()), description: v.optional(v.string()), value: v.optional(v.number()), isActive: v.optional(v.boolean()) },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete a prize.
 *
 * This was a bare `ctx.db.delete(args.id)`, and `prizeRedemptions.prizeId` is
 * REQUIRED. So tidying the prize list voided prizes diners had actually won: the
 * redemption row survived at `pending`, holding an id that resolves to nothing,
 * and the staff scanner — `redeemByCode` dereferences `redemption.prizeId` —
 * had nothing to show the person standing at the till with a valid code. The
 * counter scan is where it surfaced, as a dangling `pending` redemption; the
 * customer's version was being told their prize did not exist.
 *
 * `v.id("prizes")` validates how an id is encoded, not that it still resolves,
 * so nothing anywhere complained.
 *
 * The split is the one `products.remove` established, on authorship:
 *
 *  - REFUSED — `prizeRedemptions` and `gamePlays`. Both record something that
 *    HAPPENED: a diner played, and a diner won. Neither is ours to rewrite to
 *    make a delete succeed, and `gamePlays.prizeId` being optional is not
 *    permission to null it — that field IS the record of what was won.
 *  - DETACHED — `games.config.wheelSections[].prizeId`. The section is a label
 *    and a colour the owner drew and it survives; only the dead link goes.
 *    Nothing pays out from it (`gamePlay.play` draws from the prizes table via
 *    `loadAvailablePrizes`), so this is a display link, not a payout one.
 *
 * The way out is the one that already exists and is already on the screen:
 * `isActive: false` takes the prize out of the draw immediately —
 * `loadAvailablePrizes` filters on it — and leaves every won prize claimable.
 * That is what the refusal tells the owner to do.
 *
 * The refusals are `ConvexError`, not plain `Error`: Convex redacts a plain
 * error's message in production, so the owner would read "Server Error" and
 * file a bug against the delete button. `data` survives, and the admin's
 * `convexErrorMessage` already renders an unrecognised code's own message.
 */
export const remove = {
  args: { id: v.id("prizes") },
  handler: async (ctx: any, args: any) => {
    const prize = await ctx.db.get(args.id)
    if (!prize) throw new Error("Prize not found")

    // `.first()` rather than a count: one row is all a refusal needs, and this
    // is a delete path — the cost must not grow with how long the game has run.
    const redemption = await ctx.db
      .query("prizeRedemptions")
      .withIndex("by_prizeId", (q: any) => q.eq("prizeId", args.id))
      .first()

    if (redemption) {
      throw new ConvexError({
        code: "prize_has_redemptions",
        message:
          `« ${prize.name} » a déjà été gagné par des joueurs : il ne peut pas être supprimé, ` +
          "sinon les lots remis restent introuvables au comptoir. " +
          "Désactivez-le pour le retirer du jeu — les lots déjà gagnés restent valables.",
      })
    }

    const play = await ctx.db
      .query("gamePlays")
      .withIndex("by_prizeId", (q: any) => q.eq("prizeId", args.id))
      .first()

    if (play) {
      throw new ConvexError({
        code: "prize_has_plays",
        message:
          `« ${prize.name} » figure dans l'historique des parties : il ne peut pas être supprimé ` +
          "sans falsifier ce que des joueurs ont gagné. " +
          "Désactivez-le pour le retirer du jeu.",
      })
    }

    // The wheel keeps its section; only the link to a prize that is going.
    // Read through the establishment's games, which is a handful of rows — the
    // same cost profile as the rest of this module.
    const games = await ctx.db
      .query("games")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", prize.storeId))
      .collect()

    for (const game of games) {
      const sections = game.config?.wheelSections
      if (!Array.isArray(sections)) continue
      if (!sections.some((section: any) => section.prizeId === args.id)) continue

      await ctx.db.patch(game._id, {
        config: {
          ...game.config,
          wheelSections: sections.map((section: any) =>
            section.prizeId === args.id ? { ...section, prizeId: undefined } : section
          ),
        },
        updatedAt: Date.now(),
      })
    }

    await ctx.db.delete(args.id)
  },
}
