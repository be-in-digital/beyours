import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Why the stock number changed (#99).
 *
 * WHAT WAS MISSING. `products.stock.quantity` was a number with no history. An
 * owner opening Inventaire saw "3 portions" and had no way to learn whether that
 * was three sold and two cancelled or five sold and four restocked by hand — and
 * when the number was wrong, which it is the first time anybody miscounts, there
 * was nothing to reconcile against. The audit lists "stock decrement /
 * reservation / release / history" as one finding; the first three exist, the
 * fourth did not.
 *
 * WHAT IT IS NOT. Not a reservation system. This product sells stock at the
 * moment an order is created and gives it back if that order is cancelled —
 * `moveTrackedStock` in `convex-functions/orders.ts` — and that is the honest
 * model for a restaurant, where the gap between ordering and cooking is minutes.
 * A ledger records what that model did; it does not change it.
 *
 * ONE ROW PER MOVEMENT, and the row says who moved it and why. `before` and
 * `after` are both stored rather than a delta alone: a delta is only meaningful
 * against a number nobody recorded, and two concurrent movements would leave a
 * reader unable to tell which order they landed in.
 */
export const stockMovementsTable = defineTable({
  storeId: v.id("stores"),
  productId: v.id("products"),
  /** The dish as it was named then. An owner renames; a ledger should not move. */
  productName: v.string(),

  /**
   * What moved the stock.
   *
   * `sale` and `restock` are the order path — a sale when an order is created,
   * a restock when one is cancelled. `adjustment` is an owner retyping the
   * number in Inventaire. `tracking_on` and `tracking_off` are the switch itself,
   * which is a movement in the sense that matters: the number stops meaning
   * anything until it is turned back on.
   */
  reason: v.union(
    v.literal("sale"),
    v.literal("restock"),
    v.literal("adjustment"),
    v.literal("tracking_on"),
    v.literal("tracking_off")
  ),

  /** The quantity before and after. Both, for the reason in the header. */
  before: v.number(),
  after: v.number(),
  /** `after - before`, stored so a reader does not have to subtract. */
  delta: v.number(),

  /**
   * The order that caused it, for a `sale` or a `restock`.
   *
   * Optional rather than required: an adjustment has no order, and a `v.id`
   * that is required would make the ledger impossible to write for the case an
   * owner actually looks at it for.
   */
  orderId: v.optional(v.id("orders")),
  /** The order number, so a row reads without a second lookup. */
  orderNumber: v.optional(v.string()),

  /**
   * Who did it, when a person did.
   *
   * Absent for a sale: the diner is not staff, and recording which customer
   * bought the last portion in a table the whole team reads would put a purchase
   * history in a screen that is about dishes. The order number is the link.
   */
  actorId: v.optional(v.string()),

  createdAt: v.number(),
})
  .index("by_storeId_createdAt", ["storeId", "createdAt"])
  .index("by_storeId_productId", ["storeId", "productId"])
