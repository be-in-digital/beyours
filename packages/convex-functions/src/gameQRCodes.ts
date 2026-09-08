import { ConvexError, v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("gameQRCodes").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

export const create = {
  args: { storeId: v.id("stores"), code: v.string(), tableNumber: v.optional(v.string()), location: v.optional(v.string()), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    // `scannedCount` is required by the schema and never comes from the caller:
    // it is the scan counter this row will accumulate. Without it every insert
    // was rejected by the validator, so no QR code could be created and nobody
    // could ever play.
    return await ctx.db.insert("gameQRCodes", { ...args, scannedCount: 0, createdAt: now, updatedAt: now })
  },
}

/**
 * Take a QR code out of service without destroying what was played on it.
 *
 * `getSession` and `play` both refuse an inactive code, so this stops a printed
 * table tent working immediately. It exists because `remove` now refuses a code
 * that has been played, and a refusal with no way out is a dead end: the screen
 * offered create and delete and nothing in between, while the schema has
 * carried `isActive` from the start.
 */
export const setActive = {
  args: { id: v.id("gameQRCodes"), isActive: v.boolean() },
  handler: async (ctx: any, args: any) => {
    const qrCode = await ctx.db.get(args.id)
    if (!qrCode) throw new Error("QR code not found")
    await ctx.db.patch(args.id, { isActive: args.isActive, updatedAt: Date.now() })
  },
}

/**
 * Delete a QR code — unless somebody has played on it.
 *
 * WHAT WENT WRONG (#412 P3-F4). A bare `ctx.db.delete(args.id)` over
 * `gamePlays.qrCodeId`. Nothing dereferences that column, so nothing crashed
 * and nothing was noticed — and that is the whole damage: a `gamePlays` row is
 * the establishment's own evidence under art. 7.1 that it was allowed to record
 * a fingerprint, and `qrCodeId` is the only thing on it that says WHERE the
 * consent was given. Deleting the code left the play standing with a link to
 * nothing, silently, on the exact records an owner would be asked to produce.
 *
 * The same reasoning `games.remove` records, and the same way out: `setActive`
 * with `false` retires the code immediately — `getSession` answers `not_found`
 * to a scan and `play` throws `GAME_UNAVAILABLE` — and leaves every play, and
 * every consent it carries, exactly where it is.
 *
 * A code nobody has ever played still deletes; `by_qrCodeId` was declared for
 * this check and until now had no reader at all.
 */
export const remove = {
  args: { id: v.id("gameQRCodes") },
  handler: async (ctx: any, args: any) => {
    const qrCode = await ctx.db.get(args.id)
    if (!qrCode) throw new Error("QR code not found")

    // `.first()`: one row is all a refusal needs, and a delete must not cost
    // more the longer the table has been in service.
    const play = await ctx.db
      .query("gamePlays")
      .withIndex("by_qrCodeId", (q: any) => q.eq("qrCodeId", args.id))
      .first()

    if (play) {
      const table = qrCode.tableNumber ? ` (table ${qrCode.tableNumber})` : ""
      throw new ConvexError({
        code: "qr_code_has_plays",
        message:
          `Des parties ont été jouées avec le code « ${qrCode.code} »${table} : ` +
          "le supprimer effacerait la seule trace de l'endroit où le consentement " +
          "de ces joueurs a été recueilli. " +
          "Désactivez-le — le QR code cesse aussitôt de fonctionner et les parties restent.",
      })
    }

    await ctx.db.delete(args.id)
  },
}
