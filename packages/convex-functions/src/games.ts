import { v } from "convex/values"

const wheelSectionValidator = v.object({
  label: v.string(),
  color: v.string(),
  probability: v.number(),
  prizeId: v.optional(v.id("prizes")),
  isWinning: v.boolean(),
})

const configValidator = v.optional(v.object({
  wheelSections: v.optional(v.array(wheelSectionValidator)),
  scratchCardDesign: v.optional(v.string()),
  primaryColor: v.optional(v.string()),
  secondaryColor: v.optional(v.string()),
  backgroundImage: v.optional(v.string()),
  cooldownHours: v.optional(v.number()),
}))

export const list = {
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx: any, args: any) => {
    // Global: list all games (ignore storeId)
    return await ctx.db.query("games").collect()
  },
}

export const create = {
  args: {
    storeId: v.optional(v.id("stores")), // Legacy, ignored
    type: v.union(v.literal("wheel"), v.literal("scratch_card")),
    name: v.string(),
    description: v.optional(v.string()),
    winRatio: v.number(),
    isActive: v.boolean(),
    config: configValidator,
  },
  handler: async (ctx: any, args: any) => {
    if (args.winRatio < 0 || args.winRatio > 100) throw new Error("Win ratio must be between 0 and 100")
    const now = Date.now()
    const { storeId: _storeId, ...rest } = args
    return await ctx.db.insert("games", { ...rest, createdAt: now, updatedAt: now })
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
  args: {
    id: v.id("games"),
    type: v.optional(v.union(v.literal("wheel"), v.literal("scratch_card"))),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    winRatio: v.optional(v.number()),
    config: configValidator,
  },
  handler: async (ctx: any, args: any) => {
    if (args.winRatio !== undefined && (args.winRatio < 0 || args.winRatio > 100)) throw new Error("Win ratio must be between 0 and 100")
    const { id, config, ...fields } = args

    // Merge config intelligently: don't overwrite existing fields not provided
    let mergedConfig = undefined
    if (config) {
      const existing = await ctx.db.get(id)
      const existingConfig = existing?.config ?? {}
      mergedConfig = { ...existingConfig, ...config }
    }

    await ctx.db.patch(id, {
      ...fields,
      ...(mergedConfig !== undefined ? { config: mergedConfig } : {}),
      updatedAt: Date.now(),
    })
  },
}

export const remove = {
  args: { id: v.id("games") },
  handler: async (ctx: any, args: any) => { await ctx.db.delete(args.id) },
}
