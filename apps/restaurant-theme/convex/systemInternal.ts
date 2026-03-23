import { internalQuery, internalMutation } from "./_generated/server"
import { v } from "convex/values"

// ─── Internal Queries ────────────────────────────────────────────────────────

/** Get globalSettings for internal use (no auth) */
export const getSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("globalSettings").first()
  },
})

/** Export all rows from a given table */
export const exportTable = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const rows = await (ctx.db.query(args.tableName as never) as any).collect()
    return rows
  },
})

// ─── Internal Mutations ──────────────────────────────────────────────────────

/** Import rows into a table — clears existing data, then inserts */
export const importTable = internalMutation({
  args: {
    tableName: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    // 1. Delete all existing rows
    const existing = await (ctx.db.query(args.tableName as never) as any).collect()
    for (const row of existing) {
      await ctx.db.delete(row._id)
    }

    // 2. Insert new rows (strip Convex system fields)
    for (const row of args.rows) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, _creationTime, ...data } = row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.db as any).insert(args.tableName, data)
    }
  },
})
