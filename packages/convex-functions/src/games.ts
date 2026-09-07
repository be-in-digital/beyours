import { ConvexError, v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("games").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: { storeId: v.id("stores"), type: v.union(v.literal("wheel"), v.literal("scratch_card")), name: v.string(), description: v.optional(v.string()), winRatio: v.number(), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    if (args.winRatio < 0 || args.winRatio > 100) throw new Error("Win ratio must be between 0 and 100")
    const now = Date.now()
    return await ctx.db.insert("games", { ...args, createdAt: now, updatedAt: now })
  },
}

export const updateWinRatio = {
  args: { id: v.id("games"), winRatio: v.number() },
  handler: async (ctx: any, args: any) => {
    if (args.winRatio < 0 || args.winRatio > 100) throw new Error("Win ratio must be between 0 and 100")
    await ctx.db.patch(args.id, { winRatio: args.winRatio, updatedAt: Date.now() })
  },
}

export const update = {
  args: { id: v.id("games"), name: v.optional(v.string()), description: v.optional(v.string()), isActive: v.optional(v.boolean()), winRatio: v.optional(v.number()), config: v.optional(v.any()) },
  handler: async (ctx: any, args: any) => {
    if (args.winRatio !== undefined && (args.winRatio < 0 || args.winRatio > 100)) throw new Error("Win ratio must be between 0 and 100")
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete a game.
 *
 * This was a bare `ctx.db.delete(args.id)`, and `gamePlays.gameId` is REQUIRED.
 * Deleting a game a diner had played left every one of its plays holding an id
 * that resolves to nothing — and a play is not an anonymous counter: it carries
 * the diner's consent (art. 7.1), the prize they won, and the redemption that
 * hangs off it. `getStats` and the play history dereference the game to name it,
 * so the establishment's own record of what it ran went with the row.
 *
 * `v.id("games")` validates how an id is encoded, not that it still resolves,
 * so nothing complained.
 *
 * REFUSED rather than cascaded, and the difference matters here more than
 * anywhere: cascading would delete the plays, which is the establishment's
 * evidence that it collected the diner's consent before recording a fingerprint.
 * That evidence is the controller's to keep until the retention sweep carries it
 * away — see `privacy.ts` — not a delete button's to discard.
 *
 * The way out already exists and is already on the screen: `isActive: false`
 * takes the game out of play immediately without touching a single record. That
 * is what the refusal tells the owner to do.
 *
 * `ConvexError`, not plain `Error`, for the reason `products.remove` records:
 * Convex redacts a plain error's message in production and the owner would read
 * "Server Error".
 */
export const remove = {
  args: { id: v.id("games") },
  handler: async (ctx: any, args: any) => {
    const game = await ctx.db.get(args.id)
    if (!game) throw new Error("Game not found")

    // `.first()` rather than a count: one row is all a refusal needs, and a
    // delete must not cost more the longer the game has been running.
    const play = await ctx.db
      .query("gamePlays")
      .withIndex("by_gameId", (q: any) => q.eq("gameId", args.id))
      .first()

    if (play) {
      throw new ConvexError({
        code: "game_has_plays",
        message:
          `« ${game.name} » a déjà été joué : il ne peut pas être supprimé, sinon les parties ` +
          "enregistrées — et les lots gagnés — perdent le jeu auquel elles se rattachent. " +
          "Désactivez-le pour le retirer immédiatement des QR codes.",
      })
    }

    await ctx.db.delete(args.id)
  },
}
