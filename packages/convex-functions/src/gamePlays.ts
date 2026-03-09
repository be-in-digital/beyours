import { v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("gamePlays").withIndex("by_storeId_playedAt", (q: any) => q.eq("storeId", args.storeId)).order("desc").collect()
  },
}

export const stats = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const plays = await ctx.db.query("gamePlays").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
    const total = plays.length
    const wins = plays.filter((p: any) => p.didWin).length
    return {
      totalPlays: total,
      totalWins: wins,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    }
  },
}
