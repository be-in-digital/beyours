import { v } from "convex/values"

/**
 * Get the active game configuration for a store by its slug.
 * Returns store info, game config, wheel sections, and required actions.
 * This is a public query (no auth required) for the game page.
 */
export const getGameByStoreSlug = {
  args: {
    storeSlug: v.string(),
    gameType: v.optional(v.union(v.literal("wheel"), v.literal("scratch_card"))),
  },
  handler: async (ctx: any, args: { storeSlug: string; gameType?: "wheel" | "scratch_card" }) => {
    // Find store by slug
    const store = await ctx.db
      .query("stores")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.storeSlug))
      .first()

    if (!store) return null

    // Find active games globally (restaurant-level config)
    const activeGames = await ctx.db
      .query("games")
      .withIndex("by_isActive", (q: any) =>
        q.eq("isActive", true)
      )
      .collect()

    // If gameType specified, pick that type; otherwise pick the first active game
    const game = args.gameType
      ? activeGames.find((g: any) => g.type === args.gameType) ?? null
      : activeGames[0] ?? null

    if (!game) return null

    // Get active required actions globally, sorted by sortOrder
    const actions = await ctx.db
      .query("requiredActions")
      .withIndex("by_isActive", (q: any) =>
        q.eq("isActive", true)
      )
      .collect()

    const sortedActions = actions
      .filter((a: any) => a.isRequired)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)

    // Get active prizes globally
    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_isActive", (q: any) =>
        q.eq("isActive", true)
      )
      .collect()

    // Build prize map for segment enrichment
    const prizeMap = new Map<string, any>(prizes.map((p: any) => [p._id, p]))

    // Enrich wheel sections with prize names
    const sections = (game.config?.wheelSections ?? []).map((section: any) => ({
      ...section,
      prizeName: section.prizeId ? prizeMap.get(section.prizeId)?.name : undefined,
    }))

    return {
      store: {
        _id: store._id,
        name: store.name,
        slug: store.slug,
      },
      game: {
        _id: game._id,
        name: game.name,
        type: game.type,
        winRatio: game.winRatio,
      },
      sections,
      actions: sortedActions.map((a: any) => ({
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
}
