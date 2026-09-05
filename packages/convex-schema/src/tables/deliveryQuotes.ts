import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Delivery quotes
 *
 * Server-side record of an Uber Direct estimate, so the delivery fee charged at
 * checkout comes from something the server issued rather than from the browser.
 *
 * WHY THIS EXISTS: in `percentage` fee mode, `orders.create` took the Uber
 * Direct fee as a client argument (`uberDirectFee`) and billed a percentage of
 * whatever number arrived. Sending `uberDirectFee: 0` bought free delivery —
 * the same class of hole as the client-supplied discount. The order now carries
 * only the estimate id, and the fee is read from this table.
 */
export const deliveryQuotesTable = defineTable({
  /** Uber Direct's estimate id — the handle the storefront sends back. */
  estimateId: v.string(),
  storeId: v.id("stores"),
  /** Quoted delivery fee in cents, exactly as Uber Direct returned it. */
  fee: v.number(),
  currency: v.string(),
  /** Dropoff the quote was issued for, to detect a changed address. */
  dropoffLatitude: v.number(),
  dropoffLongitude: v.number(),
  /** Uber's own expiry for the quote, in ms. */
  expiresAt: v.number(),
  /**
   * The order this quote paid for, once it has been used.
   *
   * A quote was reusable: the same estimate id could price an unlimited number
   * of orders, and nothing tied it to the address it was issued for. One cheap
   * quote for a nearby street bought delivery anywhere, indefinitely.
   */
  consumedByOrderId: v.optional(v.id("orders")),
  createdAt: v.number(),
})
  .index("by_estimateId", ["estimateId"])
  .index("by_storeId", ["storeId"])
  // Retention. A quote holds the coordinates of somebody's front door and is
  // spent minutes after it is issued. An unconsumed one is attached to no order
  // and therefore reachable by no data-subject request — the clock is the only
  // thing that can carry it away.
  .index("by_expiresAt", ["expiresAt"])
