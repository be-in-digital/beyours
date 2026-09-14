/**
 * Recording why the stock number changed (#99).
 *
 * `products.stock.quantity` was a number with no history: an owner saw "3
 * portions" and could not learn whether that was three sold and two cancelled or
 * five sold and four restocked by hand. When the number is wrong — which it is
 * the first time anybody miscounts — there was nothing to reconcile against.
 *
 * ONE WRITER, CALLED FROM EVERY PATH THAT MOVES STOCK. There are four, and until
 * this existed each one patched `stock.quantity` and said nothing:
 *
 *   - `orders.create`         sells it     → `sale`
 *   - `orders.updateStatus`   gives it back → `restock`
 *   - `products.updateStock`  an owner retypes it → `adjustment`
 *   - `products.toggleStockTracking` turns the number on or off
 *
 * A rule that lives in one caller is a rule the others skip — the same argument
 * `stockPatch` makes about auto-disable, one level up.
 *
 * WRITES NOTHING WHEN NOTHING MOVED. A patch that sets 3 to 3 is not a movement,
 * and a ledger padded with them is a ledger nobody reads.
 */

import { v } from "convex/values"

/** Why a quantity changed. */
export type StockMovementReason =
  | "sale"
  | "restock"
  | "adjustment"
  | "tracking_on"
  | "tracking_off"

export interface RecordMovementArgs {
  storeId: unknown
  productId: unknown
  productName: string
  reason: StockMovementReason
  before: number
  after: number
  orderId?: unknown
  orderNumber?: string
  actorId?: string
  now: number
}

/**
 * Write one row, if there is anything to write.
 *
 * `tracking_on` and `tracking_off` are recorded even at an unchanged quantity:
 * the switch IS the movement there — the number stops meaning anything until it
 * is turned back on, and an owner reading the ledger a week later needs to see
 * where it went quiet.
 */
export async function recordStockMovement(
  ctx: any,
  args: RecordMovementArgs
): Promise<void> {
  const delta = args.after - args.before
  const isSwitch = args.reason === "tracking_on" || args.reason === "tracking_off"
  if (delta === 0 && !isSwitch) return

  await ctx.db.insert("stockMovements", {
    storeId: args.storeId,
    productId: args.productId,
    productName: args.productName,
    reason: args.reason,
    before: args.before,
    after: args.after,
    delta,
    ...(args.orderId === undefined ? {} : { orderId: args.orderId }),
    ...(args.orderNumber === undefined ? {} : { orderNumber: args.orderNumber }),
    ...(args.actorId === undefined ? {} : { actorId: args.actorId }),
    createdAt: args.now,
  })
}

/** How many movements one screen reads at a time. */
export const STOCK_MOVEMENT_PAGE = 50

/**
 * The establishment's stock movements, newest first.
 *
 * Bounded and paginated, on `by_storeId_createdAt`: a busy restaurant writes one
 * row per tracked dish per order, so this table grows faster than any other the
 * admin reads. `productId` narrows it to one dish's history, which is the
 * question an owner actually asks — "where did the six go?".
 */
export const list = {
  args: {
    storeId: v.id("stores"),
    productId: v.optional(v.id("products")),
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: {
      storeId: string
      productId?: string
      cursor?: string | null
      numItems?: number
    }
  ) => {
    const numItems = Math.min(Math.max(args.numItems ?? STOCK_MOVEMENT_PAGE, 1), 200)

    if (args.productId) {
      // `by_storeId_productId` has no time in its key, so the page is ordered by
      // insertion — which for this table is chronological, because a row is only
      // ever appended.
      const page = await ctx.db
        .query("stockMovements")
        .withIndex("by_storeId_productId", (q: any) =>
          q.eq("storeId", args.storeId).eq("productId", args.productId)
        )
        .order("desc")
        .paginate({ numItems, cursor: args.cursor ?? null })
      return { movements: page.page, cursor: page.continueCursor, isDone: page.isDone }
    }

    const page = await ctx.db
      .query("stockMovements")
      .withIndex("by_storeId_createdAt", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate({ numItems, cursor: args.cursor ?? null })
    return { movements: page.page, cursor: page.continueCursor, isDone: page.isDone }
  },
}
